import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import DateTimePicker from "@react-native-community/datetimepicker";
import { triggerGlobalScheduleRefresh, useSchedule } from "../hooks/useSchedule";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { useRemoteFeedContext } from "../remoteFeed/RemoteFeedContext";
import { parseRemoteJsonText } from "../remoteFeed/api";
import { mapPlanDaysToGithubSyncDays, parseMealMeta, syncMonthToGithub } from "../remoteFeed/githubSync";
import { fonts, spacing } from "../theme";
import type { LoadedSchedule, PlanDay } from "../types";
import { addDays, addPlanDays, formatDateStr, updatePlanDay as updatePlanDayStorage } from "../data/planDays";
import { generateId } from "../utils/id";

type ScheduleJson = {
  month: number;
  signs_of_readiness?: string[];
  safety_guidelines?: string[];
  weekly_schedule: {
    week: number;
    days: {
      day: number;
      time: string;
      food_type: string;
      food: string;
      amount_grams: number;
      substitutions?: string[];
      notes?: string;
    }[];
  }[];
};

function formatDateDisplay(dateStr: string, locale?: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function dayIndexFromStart(startDateStr: string, dateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00").getTime();
  const cur = new Date(dateStr + "T00:00:00").getTime();
  const diffDays = Math.floor((cur - start) / 86400000);
  return diffDays + 1;
}

type MealDraftMeta = {
  notes: string;
  lunchFood: string;
  lunchAmount: string;
  eveningFood: string;
  eveningAmount: string;
};

function mealFromDay(day: { meals?: Array<{ mealType: string; product: string; amountGrams: number }> } | undefined, type: "lunch" | "evening") {
  if (!day?.meals?.length) return { product: "", amount: "" };
  const items = day.meals.filter((m) => m.mealType === type);
  if (!items.length) return { product: "", amount: "" };
  return {
    product: items.map((m) => m.product).filter(Boolean).join(", "),
    amount: items.map((m) => String(m.amountGrams)).join(", "),
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function mealRows(foodCsv: string, amountCsv: string): Array<{ food: string; amount: string }> {
  const foods = splitCsv(foodCsv);
  const amounts = splitCsv(amountCsv);
  const len = Math.max(foods.length, amounts.length, 1);
  return Array.from({ length: len }, (_, i) => ({
    food: foods[i] ?? "",
    amount: amounts[i] ?? "",
  }));
}

function joinMealRows(rows: Array<{ food: string; amount: string }>): { food: string; amount: string } {
  const filtered = rows.filter((r) => r.food.trim() || r.amount.trim());
  return {
    food: filtered.map((r) => r.food.trim()).filter(Boolean).join(", "),
    amount: filtered.map((r) => r.amount.trim()).filter(Boolean).join(", "),
  };
}

function buildMealMeta(meta: MealDraftMeta): string | undefined {
  const lines: string[] = [];
  if (meta.lunchFood || meta.lunchAmount) lines.push(`__lunch=${meta.lunchFood}|${meta.lunchAmount}`);
  if (meta.eveningFood || meta.eveningAmount) lines.push(`__evening=${meta.eveningFood}|${meta.eveningAmount}`);
  if (meta.notes.trim()) lines.push(meta.notes.trim());
  const out = lines.join("\n").trim();
  return out || undefined;
}

function listChangedFields(params: {
  originalById: Record<string, PlanDay>;
  draftById: Record<string, PlanDay>;
  amountTextById: Record<string, string>;
  subsTextById: Record<string, string>;
}): { day: PlanDay; fields: string[] }[] {
  const out: { day: PlanDay; fields: string[] }[] = [];
  for (const id of Object.keys(params.draftById)) {
    const draft = params.draftById[id];
    const orig = params.originalById[id];
    if (!draft || !orig) continue;

    const fields: string[] = [];
    if (draft.time !== orig.time) fields.push("time");
    if (draft.foodType !== orig.foodType) fields.push("type");
    if (draft.food !== orig.food) fields.push("food");
    if (draft.notes !== orig.notes) fields.push("notes");

    const amtDraft = parseInt((params.amountTextById[id] ?? String(draft.amountGrams)).trim() || "0", 10);
    const amtOrig = orig.amountGrams;
    if (!isNaN(amtDraft) && amtDraft !== amtOrig) fields.push("amount");

    const subsDraft = (params.subsTextById[id] ?? draft.substitutions.join(", "))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
    const subsOrig = orig.substitutions.join(", ");
    if (subsDraft !== subsOrig) fields.push("subs");

    if (fields.length) out.push({ day: draft, fields });
  }
  return out.sort((a, b) => a.day.date.localeCompare(b.day.date));
}

function toBase64Utf8(text: string): string | null {
  try {
    const anyGlobal = globalThis as any;
    if (anyGlobal?.Buffer?.from) {
      return anyGlobal.Buffer.from(text, "utf8").toString("base64");
    }

    const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const bytes = enc ? enc.encode(text) : null;
    if (!bytes) return null;

    const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i] ?? 0;
      const b = bytes[i + 1] ?? 0;
      const c = bytes[i + 2] ?? 0;
      const triple = (a << 16) | (b << 8) | c;

      out += table[(triple >> 18) & 63]!;
      out += table[(triple >> 12) & 63]!;
      out += i + 1 < bytes.length ? table[(triple >> 6) & 63]! : "=";
      out += i + 2 < bytes.length ? table[triple & 63]! : "=";
    }
    return out;
  } catch {
    return null;
  }
}


function jsonString(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function readEnv(name: string): string | undefined {
  const v = (process.env as any)?.[name] as unknown;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}


function normalizeDraftDays(days: PlanDay[], amountTextById: Record<string, string>, subsTextById: Record<string, string>): PlanDay[] {
  return days.map((d) => {
    const amountTxt = amountTextById[d.id] ?? String(d.amountGrams);
    const amountParsed = parseInt(amountTxt || "0", 10);
    const subsTxt = subsTextById[d.id] ?? d.substitutions.join(", ");
    return {
      ...d,
      amountGrams: isNaN(amountParsed) ? 0 : amountParsed,
      substitutions: subsTxt
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}


function buildScheduleJson(schedule: LoadedSchedule, days: PlanDay[]): ScheduleJson {
  const weekly = new Map<number, PlanDay[]>();
  for (const d of days) {
    const list = weekly.get(d.weekNumber) ?? [];
    list.push(d);
    weekly.set(d.weekNumber, list);
  }

  const weekly_schedule = [...weekly.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, list]) => ({
      week,
      days: list
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d, idx) => ({
          day: idx + 1,
          time: d.time,
          food_type: d.foodType,
          food: d.food,
          amount_grams: d.amountGrams,
          substitutions: d.substitutions.length ? d.substitutions : undefined,
          notes: d.notes || undefined,
        })),
    }));

  return {
    month: schedule.month,
    signs_of_readiness: schedule.signsOfReadiness.length ? schedule.signsOfReadiness : undefined,
    safety_guidelines: schedule.safetyGuidelines.length ? schedule.safetyGuidelines : undefined,
    weekly_schedule,
  };
}

export function LoadDataScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t: tRaw, locale } = useLocale();
  const t = tRaw as (key: string, params?: Record<string, string | number>) => string;
  const { colors } = useTheme();
  const { isDeveloper } = usePreferences();
  const remote = useRemoteFeedContext();
  const styles = useLocalStyles(colors);

  const {
    schedules,
    loading,
    refresh,
    getDaysForSchedule,
    todayPlan,
    progressDateStr,
    setProgressDate,
    remoteDayPlans,
    isMealEaten,
    dayEatenByDate,
    shiftedMealsByDate,
  } = useSchedule();

  const availableSchedules = schedules;

  const mainScrollRef = useRef<ScrollView | null>(null);
  const [rowYByDate, setRowYByDate] = useState<Record<string, number>>({});

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const [draftById, setDraftById] = useState<Record<string, PlanDay>>({});
  const [amountTextById, setAmountTextById] = useState<Record<string, string>>({});
  const [subsTextById, setSubsTextById] = useState<Record<string, string>>({});
  const [originalJsonText, setOriginalJsonText] = useState<string>("");
  const [originalById, setOriginalById] = useState<Record<string, PlanDay>>({});

  const [sendBarCollapsed, setSendBarCollapsed] = useState(false);
  const [payloadModalVisible, setPayloadModalVisible] = useState(false);
  const [payloadText, setPayloadText] = useState("");
  const [githubSending, setGithubSending] = useState(false);
  const [githubResultText, setGithubResultText] = useState<string>("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [startDateModalVisible, setStartDateModalVisible] = useState(false);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState(() => new Date());

  const progressDayStr = progressDateStr;
  const isDarkUi = colors.background === "#1a1a1a";
  const glassBg = isDarkUi ? "rgba(45,45,45,0.65)" : "rgba(255,255,255,0.72)";
  const glassBorder = isDarkUi ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.8)";

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (selectedScheduleId) return;
    if (availableSchedules.length) setSelectedScheduleId(availableSchedules[0].id);
  }, [availableSchedules, selectedScheduleId]);

  const selectedSchedule = useMemo(
    () => (selectedScheduleId ? availableSchedules.find((s) => s.id === selectedScheduleId) ?? null : null),
    [availableSchedules, selectedScheduleId],
  );

  const draftDaysSorted = useMemo(() => {
    return Object.values(draftById).sort((a, b) => a.date.localeCompare(b.date));
  }, [draftById]);

  const amountInvalidCount = useMemo(() => {
    return draftDaysSorted.reduce((acc, d) => {
      const txt = amountTextById[d.id] ?? String(d.amountGrams);
      if (!txt.trim()) return acc + 1;
      const n = parseInt(txt, 10);
      if (isNaN(n) || n < 0) return acc + 1;
      return acc;
    }, 0);
  }, [amountTextById, draftDaysSorted]);

  const draftJsonText = useMemo(() => {
    if (!selectedSchedule) return "";
    const normalizedDays = normalizeDraftDays(draftDaysSorted, amountTextById, subsTextById);
    return jsonString(buildScheduleJson(selectedSchedule, normalizedDays));
  }, [amountTextById, draftDaysSorted, selectedSchedule, subsTextById]);

  const dirty = useMemo(() => {
    if (!originalJsonText) return false;
    return draftJsonText !== originalJsonText;
  }, [draftJsonText, originalJsonText]);

  useEffect(() => {
    if (!selectedSchedule) return;
    const days = getDaysForSchedule(selectedSchedule.id);
    const byId: Record<string, PlanDay> = {};
    const amt: Record<string, string> = {};
    const subs: Record<string, string> = {};
    for (const d of days) {
      byId[d.id] = d;
      amt[d.id] = String(d.amountGrams);
      subs[d.id] = d.substitutions.join(", ");
    }
    setOriginalById(byId);
    setDraftById(byId);
    setAmountTextById(amt);
    setSubsTextById(subs);

    const scheduleJson = buildScheduleJson(selectedSchedule, days);
    const text = jsonString(scheduleJson);
    setOriginalJsonText(text);
  }, [getDaysForSchedule, selectedSchedule]);

  const updateDay = useCallback((id: string, updates: Partial<PlanDay>) => {
    setDraftById((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...updates } };
    });
  }, []);

  const upsertDay = useCallback((day: PlanDay, updates: Partial<PlanDay>) => {
    setDraftById((prev) => ({ ...prev, [day.id]: { ...(prev[day.id] ?? day), ...updates } }));
  }, []);

  const openPayloadPreview = useCallback(() => {
    if (!selectedSchedule) return;
    const content = draftJsonText;
    const contentBase64 = toBase64Utf8(content);
    const payload = {
      message: "Update schedule",
      content: contentBase64 ?? "",
      owner: readEnv("EXPO_PUBLIC_GITHUB_OWNER") ?? readEnv("GITHUB_OWNER") ?? "",
      repo: readEnv("EXPO_PUBLIC_GITHUB_REPO") ?? readEnv("GITHUB_REPO") ?? "",
      branch: readEnv("EXPO_PUBLIC_GITHUB_BRANCH") ?? readEnv("GITHUB_BRANCH") ?? "main",
      path: readEnv("EXPO_PUBLIC_GITHUB_DATA_JSON_PATH") ?? readEnv("GITHUB_DATA_JSON_PATH") ?? "data.json",
    };
    setPayloadText(
      jsonString({
        payload,
        contentPreview: content,
        base64Available: !!contentBase64,
      }),
    );
    setGithubResultText("");
    setPayloadModalVisible(true);
  }, [draftJsonText, selectedSchedule]);

  const performGithubSend = useCallback(async (): Promise<{ ok: boolean; text: string; scheduleText?: string }> => {
    if (!selectedSchedule) return { ok: false, text: "No schedule selected." };
    if (!dirty) return { ok: false, text: "No changes to send." };
    if (amountInvalidCount > 0) return { ok: false, text: "Fix invalid amount cells before sending." };
    const syncDays = mapPlanDaysToGithubSyncDays(draftDaysSorted, amountTextById, subsTextById);
    const changes = listChangedFields({ originalById, draftById, amountTextById, subsTextById });
    const start = selectedSchedule.startDate;
    const first = changes[0];
    const message =
      changes.length === 1 && first
        ? `${t("loadDataDay")} ${dayIndexFromStart(start, first.day.date)}: ${first.fields.join(", ")}`
        : changes.length
          ? `${changes.length} days updated`
          : "Update";
    const result = await syncMonthToGithub({
      month: selectedSchedule.month,
      days: syncDays,
      message,
    });
    if (!result.ok) return { ok: false, text: result.text, scheduleText: undefined };
    const text = [
      t("loadDataSendSuccess"),
      result.commitSha ? `commitSha: ${result.commitSha}` : "",
      result.commitUrl ? `commitUrl: ${result.commitUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: true, text, scheduleText: result.scheduleText };
  }, [amountInvalidCount, amountTextById, dirty, draftById, draftDaysSorted, originalById, selectedSchedule, subsTextById, t]);

  const refreshAfterSuccessfulSend = useCallback(async (scheduleText?: string) => {
    if (scheduleText && remote?.applySchedule) {
      const parsed = parseRemoteJsonText(scheduleText);
      if (parsed) {
        await remote.applySchedule(parsed);
      }
    }
    triggerGlobalScheduleRefresh();
  }, [remote]);

  const sendToGithub = useCallback(async () => {
    if (!selectedSchedule) return;
    setGithubSending(true);
    setGithubResultText("Sending...");
    const result = await performGithubSend();
    if (result.ok) {
      await refreshAfterSuccessfulSend(result.scheduleText);
    }
    setGithubResultText(result.text);
    if (!isDeveloper) {
      setToast({
        kind: result.ok ? "success" : "error",
        text: result.ok ? t("loadDataSendSuccess") : t("loadDataSendError"),
      });
    }
    setGithubSending(false);
  }, [isDeveloper, performGithubSend, refreshAfterSuccessfulSend, selectedSchedule, t]);

  const onPressSendData = useCallback(async () => {
    if (isDeveloper) {
      openPayloadPreview();
      return;
    }
    if (!selectedSchedule) return;
    setGithubSending(true);
    const result = await performGithubSend();
    if (result.ok) {
      await refreshAfterSuccessfulSend(result.scheduleText);
    }
    setGithubSending(false);
    setToast({
      kind: result.ok ? "success" : "error",
      text: result.ok ? t("loadDataSendSuccess") : `${t("loadDataSendError")}: ${result.text}`,
    });
  }, [isDeveloper, openPayloadPreview, performGithubSend, refreshAfterSuccessfulSend, selectedSchedule, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const persistDay = useCallback(
    async (dayId: string, updates: Partial<PlanDay>) => {
      const day = draftById[dayId];
      if (!day) return;
      try {
        await updatePlanDayStorage(day.id, updates);
      } catch {
        await addPlanDays([
          {
            ...day,
            ...updates,
            id: generateId(),
            scheduleId: day.scheduleId,
          },
        ]);
      }
      await refresh();
    },
    [draftById, refresh],
  );

  const todayRow = useMemo(() => {
    const plan = todayPlan();
    if (!plan) return null;
    return draftById[plan.id] ?? plan;
  }, [draftById, selectedScheduleId, todayPlan]);

  const selectedStartDate = selectedSchedule?.startDate ?? null;
  const feedingStartDate = remote?.startDate ?? null;

  const openStartDateModal = useCallback(() => {
    const base = feedingStartDate ? new Date(feedingStartDate + "T00:00:00") : new Date();
    setStartDateDraft(base);
    setStartDatePickerVisible(Platform.OS === "ios");
    setStartDateModalVisible(true);
  }, [feedingStartDate]);

  const saveStartDate = useCallback(async () => {
    if (!remote?.setStartDate) return;
    await remote.setStartDate(formatDateStr(startDateDraft));
    setStartDatePickerVisible(false);
    setStartDateModalVisible(false);
  }, [remote, startDateDraft]);

  const scheduleForDate = useCallback(
    (dateStr: string) =>
      availableSchedules.find((s) => dateStr >= s.startDate && dateStr <= s.endDate) ?? null,
    [availableSchedules],
  );

  const prevSchedule = scheduleForDate(addDays(progressDayStr, -1));
  const nextSchedule = scheduleForDate(addDays(progressDayStr, 1));
  const canGoPrev = !!prevSchedule;
  const canGoNext = !!nextSchedule;
  const isLastDay = selectedSchedule && progressDayStr === selectedSchedule.endDate && !canGoNext;

  const goPrev = useCallback(() => {
    const targetDate = addDays(progressDayStr, -1);
    const targetSchedule = scheduleForDate(targetDate);
    if (!targetSchedule) return;
    if (targetSchedule.id !== selectedScheduleId) setSelectedScheduleId(targetSchedule.id);
    setProgressDate(targetDate);
  }, [progressDayStr, scheduleForDate, selectedScheduleId, setProgressDate]);

  const goNext = useCallback(() => {
    const targetDate = addDays(progressDayStr, 1);
    const targetSchedule = scheduleForDate(targetDate);
    if (!targetSchedule) return;
    if (targetSchedule.id !== selectedScheduleId) setSelectedScheduleId(targetSchedule.id);
    setProgressDate(targetDate);
  }, [progressDayStr, scheduleForDate, selectedScheduleId, setProgressDate]);

  const scrollToCurrentDayRow = useCallback(() => {
    const y = rowYByDate[progressDayStr];
    if (typeof y !== "number") return;
    mainScrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }, [progressDayStr, rowYByDate]);

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={g.screenContainer}>
      <ScrollView
        ref={(r) => {
          mainScrollRef.current = r;
        }}
        contentContainerStyle={[
          g.screenContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
      >
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>{t("loadDataTitle")}</Text>

        {availableSchedules.length === 0 ? (
          <View style={g.emptyBox}>
            <Text style={g.emptyText}>{t("loadDataEmpty")}</Text>
          </View>
        ) : (
          <>
            {selectedSchedule ? (
              <View style={[styles.todayWrap, { borderColor: colors.borderLight, backgroundColor: colors.card }]}>
                <Text style={[styles.todayTitle, { color: colors.text }]}>
                  {t("loadDataCurrentDay")}
                </Text>
                <View style={styles.progressControls}>
                  <View style={styles.progressMainRow}>
                    <TouchableOpacity
                      style={[styles.progressBtn, { borderColor: colors.borderLight }, !canGoPrev && g.buttonDisabled]}
                      disabled={!canGoPrev}
                      onPress={goPrev}
                    >
                      <Text style={[styles.progressBtnText, { color: colors.text }]}>{t("loadDataPrev")}</Text>
                    </TouchableOpacity>
                    <View style={styles.progressLabelWrap}>
                      <Text style={[styles.progressMonthLabel, { color: colors.textMuted }]}>
                        {selectedSchedule ? `${t("loadDataMonth")} ${selectedSchedule.month}` : ""}
                      </Text>
                      <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                        {selectedStartDate
                          ? `${t("loadDataDay")} ${dayIndexFromStart(selectedStartDate, progressDayStr)}`
                          : formatDateDisplay(progressDayStr, locale)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.progressBtn, { borderColor: colors.borderLight }, !canGoNext && g.buttonDisabled]}
                      disabled={!canGoNext}
                      onPress={goNext}
                    >
                      <Text style={[styles.progressBtnText, { color: colors.text }]}>{t("loadDataNext")}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.progressReset} onPress={scrollToCurrentDayRow}>
                    <Text style={[styles.progressResetText, { color: colors.primary }]}>{t("loadDataCurrentDay")}</Text>
                  </TouchableOpacity>
                  <View style={[styles.startDateRow, { borderColor: colors.borderLight }]}>
                    <Text style={[styles.startDateText, { color: colors.textMuted }]}>
                      {t("loadDataFeedingStartDate")}: {feedingStartDate ? formatDateDisplay(feedingStartDate, locale) : "—"}
                    </Text>
                    <TouchableOpacity
                      style={[styles.setCurrentBtn, { borderColor: colors.borderLight, backgroundColor: colors.card }]}
                      onPress={openStartDateModal}
                    >
                      <Text style={[styles.setCurrentBtnText, { color: colors.primary }]}>{t("loadDataSetFeedingStartDate")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {isLastDay ? (
              <View style={[styles.lastDayAlert, { backgroundColor: colors.chipBg, borderColor: colors.borderLight }]}>
                <Text style={[styles.lastDayAlertText, { color: colors.text }]}>{t("loadDataLastDayAlert")}</Text>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.schedulePicker}
            >
              {availableSchedules.map((s) => {
                const selected = s.id === selectedScheduleId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelectedScheduleId(s.id)}
                    style={[
                      styles.scheduleChip,
                      { borderColor: selected ? colors.primary : colors.borderLight },
                      selected && { backgroundColor: colors.chipBg },
                    ]}
                  >
                    <Text style={[styles.scheduleChipText, { color: selected ? colors.primary : colors.textMuted }]}>
                      {t("loadDataMonth")} {s.month} · {formatDateDisplay(s.startDate, locale)}—{formatDateDisplay(s.endDate, locale)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.rowsWrap}>
              {draftDaysSorted.map((d) => {
                const amountText = amountTextById[d.id] ?? String(d.amountGrams);
                const isProgress = d.date === progressDayStr;
                const cardInputBorderColor = isProgress
                  ? isDarkUi
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(120,120,120,0.75)"
                  : colors.borderLight;
                const remoteDay = d.scheduleId.startsWith("remote-")
                  ? remoteDayPlans.find((x) => x.date === d.date)
                  : undefined;
                const morningRemote = remoteDay?.meals.find((m) => m.mealType === "morning");
                const lunchExisting = mealFromDay(remoteDay, "lunch");
                const eveningExisting = mealFromDay(remoteDay, "evening");
                const parsedMeta = parseMealMeta(d.notes);
                const morningFoodValue = morningRemote?.product ?? d.food;
                const morningAmountValue = morningRemote?.amountGrams ?? d.amountGrams;
                const morningAmountText = morningRemote ? String(morningAmountValue) : amountText;
                const morningAmountParsed = parseInt(morningAmountText, 10);
                const morningAmountBad = !morningAmountText.trim() || isNaN(morningAmountParsed) || morningAmountParsed < 0;
                const mealMeta: MealDraftMeta = {
                  ...parsedMeta,
                  lunchFood: parsedMeta.lunchFood || lunchExisting.product,
                  lunchAmount: parsedMeta.lunchAmount || lunchExisting.amount,
                  eveningFood: parsedMeta.eveningFood || eveningExisting.product,
                  eveningAmount: parsedMeta.eveningAmount || eveningExisting.amount,
                };
                const hasBreakfast = !!(morningFoodValue || morningAmountText.trim());
                const hasLunch = !!(mealMeta.lunchFood || mealMeta.lunchAmount);
                const hasEvening = !!(mealMeta.eveningFood || mealMeta.eveningAmount);
                const lunchRows = mealRows(mealMeta.lunchFood, mealMeta.lunchAmount);
                const eveningRows = mealRows(mealMeta.eveningFood, mealMeta.eveningAmount);
                return (
                  <View
                    key={d.id}
                    style={[
                      styles.dayCard,
                      { borderColor: colors.borderLight, backgroundColor: colors.card },
                      dayEatenByDate[d.date] && { backgroundColor: colors.chipSelectedBg },
                      isProgress && { backgroundColor: colors.chipSelectedBg },
                    ]}
                    onLayout={(e) => {
                      const y = e.nativeEvent.layout.y;
                      setRowYByDate((prev) => (prev[d.date] === y ? prev : { ...prev, [d.date]: y }));
                    }}
                  >
                    <View style={styles.dayCardHeader}>
                      <Text style={[styles.dayCardDate, { color: colors.text }]}>
                        {selectedStartDate ? `${t("loadDataDay")} ${dayIndexFromStart(selectedStartDate, d.date)}` : formatDateDisplay(d.date, locale)}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {dayEatenByDate[d.date] ? (
                          <Text style={[styles.dayCardBadge, { color: colors.primary }]}>{t("loadDataDayComplete")}</Text>
                        ) : null}
                        {shiftedMealsByDate[d.date] ? (
                          <Text style={[styles.dayCardBadge, { color: colors.textMuted }]}>{t("loadDataShifted")}</Text>
                        ) : null}
                        {isProgress ? (
                          <Text style={[styles.dayCardBadge, { color: colors.primary }]}>{t("loadDataCurrentDay")}</Text>
                        ) : (
                          <TouchableOpacity
                            style={[styles.setCurrentBtn, { borderColor: colors.borderLight, backgroundColor: colors.card }]}
                            onPress={() => setProgressDate(d.date)}
                          >
                            <Text style={[styles.setCurrentBtnText, { color: colors.primary }]}>{t("loadDataCurrentDay")}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={styles.fieldsWrap}>
                      {hasBreakfast ? (
                        <View style={[styles.field, styles.fieldFull, styles.mealSection, { borderColor: colors.borderLight }]}>
                          <Text style={[styles.fieldLabel, styles.mealSectionTitle, { color: colors.textMuted }]}>
                            {t("mealBreakfast")}
                            {isMealEaten(d.date, "morning", morningFoodValue) ? ` · ${t("loadDataMealEatenSuffix")}` : ""}
                          </Text>
                          <TextInput
                            style={[
                              styles.fieldInput,
                              styles.fieldMultiline,
                              { borderColor: cardInputBorderColor, color: colors.text },
                            ]}
                            value={morningFoodValue}
                            onChangeText={(v) => updateDay(d.id, { food: v })}
                            multiline
                            textAlignVertical="top"
                            placeholder={t("loadDataColFood")}
                            placeholderTextColor={colors.placeholder}
                          />
                          <View style={styles.amountRow}>
                            <TextInput
                              style={[
                                styles.fieldInput,
                                styles.amountInput,
                                { borderColor: morningAmountBad ? colors.danger : cardInputBorderColor, color: colors.text },
                              ]}
                              value={morningAmountText}
                              onChangeText={(v) => setAmountTextById((prev) => ({ ...prev, [d.id]: v }))}
                              keyboardType="numeric"
                              placeholder={`${t("loadDataColAmount")} (${t("loadDataGrams")})`}
                              placeholderTextColor={colors.placeholder}
                            />
                          </View>
                        </View>
                      ) : null}

                      {hasLunch ? (
                        <View style={[styles.field, styles.fieldFull, styles.mealSection, { borderColor: colors.borderLight }]}>
                          <Text style={[styles.fieldLabel, styles.mealSectionTitle, { color: colors.textMuted }]}>
                            {t("mealLunch")}
                            {isMealEaten(d.date, "lunch", mealMeta.lunchFood) ? ` · ${t("loadDataMealEatenSuffix")}` : ""}
                          </Text>
                          {lunchRows.map((row, idx) => (
                            <View key={`lunch-${d.id}-${idx}`} style={styles.mealRow}>
                              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{`${t("loadDataColFood")} ${idx + 1}`}</Text>
                              <TextInput
                                style={[
                                  styles.fieldInput,
                                  styles.fieldMultiline,
                                  { borderColor: cardInputBorderColor, color: colors.text },
                                ]}
                                value={row.food}
                                onChangeText={(v) => {
                                  const next = lunchRows.map((x, i) => (i === idx ? { ...x, food: v } : x));
                                  const merged = joinMealRows(next);
                                  updateDay(d.id, {
                                    notes: buildMealMeta({ ...mealMeta, lunchFood: merged.food, lunchAmount: merged.amount }),
                                  });
                                }}
                                multiline
                                textAlignVertical="top"
                                placeholder={t("loadDataColFood")}
                                placeholderTextColor={colors.placeholder}
                              />
                              <View style={styles.amountRow}>
                                <TextInput
                                  style={[styles.fieldInput, styles.amountInput, { borderColor: cardInputBorderColor, color: colors.text }]}
                                  value={row.amount}
                                  onChangeText={(v) => {
                                    const next = lunchRows.map((x, i) => (i === idx ? { ...x, amount: v } : x));
                                    const merged = joinMealRows(next);
                                    updateDay(d.id, {
                                      notes: buildMealMeta({ ...mealMeta, lunchFood: merged.food, lunchAmount: merged.amount }),
                                    });
                                  }}
                                  keyboardType="numeric"
                                  placeholder={`${t("loadDataColAmount")} (${t("loadDataGrams")})`}
                                  placeholderTextColor={colors.placeholder}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {hasEvening ? (
                        <View style={[styles.field, styles.fieldFull, styles.mealSection, { borderColor: colors.borderLight }]}>
                          <Text style={[styles.fieldLabel, styles.mealSectionTitle, { color: colors.textMuted }]}>
                            {t("mealEvening")}
                            {isMealEaten(d.date, "evening", mealMeta.eveningFood) ? ` · ${t("loadDataMealEatenSuffix")}` : ""}
                          </Text>
                          {eveningRows.map((row, idx) => (
                            <View key={`evening-${d.id}-${idx}`} style={styles.mealRow}>
                              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{`${t("loadDataColFood")} ${idx + 1}`}</Text>
                              <TextInput
                                style={[
                                  styles.fieldInput,
                                  styles.fieldMultiline,
                                  { borderColor: cardInputBorderColor, color: colors.text },
                                ]}
                                value={row.food}
                                onChangeText={(v) => {
                                  const next = eveningRows.map((x, i) => (i === idx ? { ...x, food: v } : x));
                                  const merged = joinMealRows(next);
                                  updateDay(d.id, {
                                    notes: buildMealMeta({ ...mealMeta, eveningFood: merged.food, eveningAmount: merged.amount }),
                                  });
                                }}
                                multiline
                                textAlignVertical="top"
                                placeholder={t("loadDataColFood")}
                                placeholderTextColor={colors.placeholder}
                              />
                              <View style={styles.amountRow}>
                                <TextInput
                                  style={[styles.fieldInput, styles.amountInput, { borderColor: cardInputBorderColor, color: colors.text }]}
                                  value={row.amount}
                                  onChangeText={(v) => {
                                    const next = eveningRows.map((x, i) => (i === idx ? { ...x, amount: v } : x));
                                    const merged = joinMealRows(next);
                                    updateDay(d.id, {
                                      notes: buildMealMeta({ ...mealMeta, eveningFood: merged.food, eveningAmount: merged.amount }),
                                    });
                                  }}
                                  keyboardType="numeric"
                                  placeholder={`${t("loadDataColAmount")} (${t("loadDataGrams")})`}
                                  placeholderTextColor={colors.placeholder}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}

                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <BlurView
        intensity={40}
        tint={isDarkUi ? "dark" : "light"}
        style={[
          styles.sendBar,
          {
            backgroundColor: glassBg,
            borderTopColor: glassBorder,
            paddingBottom: (sendBarCollapsed ? 2 : 5) + insets.bottom * 0.45,
          },
        ]}
      >
        {sendBarCollapsed ? (
          <TouchableOpacity
            onPress={() => setSendBarCollapsed(false)}
            style={styles.sendBarCollapsedToggle}
          >
            <Text style={[styles.sendBarChevron, { color: colors.textMuted }]}>▲</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setSendBarCollapsed(true)}
            style={styles.sendBarHeader}
          >
            <Text style={[styles.sendBarTitle, { color: colors.text }]}>
              {t("loadDataGithubStore")}
            </Text>
            <Text style={[styles.sendBarChevron, { color: colors.textMuted }]}>▼</Text>
          </TouchableOpacity>
        )}

        {!sendBarCollapsed && (
          <View style={styles.sendBarBody}>
            <Text style={[styles.sendBarMeta, { color: colors.textMuted }]}>
              {dirty ? t("loadDataUnsavedChanges") : t("loadDataNoChanges")}{" "}
              {amountInvalidCount ? `· ${t("loadDataInvalidCells", { count: amountInvalidCount })}` : ""}
            </Text>
            <TouchableOpacity
              style={[g.buttonFull, (!selectedSchedule || githubSending) && g.buttonDisabled]}
              disabled={!selectedSchedule || githubSending}
              onPress={onPressSendData}
            >
              <Text style={g.buttonFullText}>{githubSending ? "Sending..." : t("loadDataSendToGithub")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </BlurView>

      {toast ? (
        <View
          style={[
            styles.toast,
            toast.kind === "success"
              ? { backgroundColor: colors.chipSelectedBg, borderColor: colors.primary }
              : { backgroundColor: colors.chipBg, borderColor: colors.danger },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{toast.text}</Text>
        </View>
      ) : null}

      <Modal visible={payloadModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={[g.modal, styles.payloadModal]}>
            <Text style={g.modalTitle}>{t("loadDataPayloadPreview")}</Text>
            <TextInput
              style={[g.input, styles.payloadText, { color: colors.text }]}
              value={payloadText}
              editable={false}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={[g.input, styles.githubResultBox, { color: colors.text }]}
              value={githubResultText}
              editable={false}
              multiline
              textAlignVertical="top"
              placeholder="Result will appear here…"
              placeholderTextColor={colors.placeholder}
            />
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={[g.saveBtn, (githubSending || !dirty || amountInvalidCount > 0) && g.buttonDisabled]}
                disabled={githubSending || !dirty || amountInvalidCount > 0}
                onPress={sendToGithub}
              >
                <Text style={g.saveBtnText}>{githubSending ? "Sending..." : "Send"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={() => setPayloadModalVisible(false)}>
                <Text style={g.saveBtnText}>{t("loadDataClose")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={startDateModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("loadDataSetFeedingStartDate")}</Text>
            <TouchableOpacity
              style={[styles.timeRowBtn, { borderColor: colors.borderLight }]}
              onPress={() => setStartDatePickerVisible(true)}
            >
              <Text style={[styles.timeRowLabel, { color: colors.textMuted }]}>{t("loadDataFeedingStartDate")}</Text>
              <Text style={[styles.timeRowValue, { color: colors.text }]}>{formatDateDisplay(formatDateStr(startDateDraft), locale)}</Text>
            </TouchableOpacity>
            {startDatePickerVisible ? (
              <DateTimePicker
                value={startDateDraft}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  if (date) setStartDateDraft(date);
                  setStartDatePickerVisible(Platform.OS === "ios");
                }}
              />
            ) : null}
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => {
                  setStartDatePickerVisible(false);
                  setStartDateModalVisible(false);
                }}
              >
                <Text style={g.cancelBtnText}>{t("loadDataCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={saveStartDate}>
                <Text style={g.saveBtnText}>{t("loadDataSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function useLocalStyles(colors: {
  card: string;
  borderLight: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  danger: string;
  placeholder: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { justifyContent: "center", alignItems: "center" },
        schedulePicker: {
          paddingHorizontal: spacing.screenPadding,
          paddingBottom: 10,
          gap: 10,
        },
        scheduleChip: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        scheduleChipText: {
          fontSize: 13,
          fontFamily: fonts.regular,
        },
        rowsWrap: {
          paddingHorizontal: spacing.screenPadding,
          paddingBottom: 10,
          gap: 12,
        },
        todayWrap: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 18,
          borderWidth: 2,
          borderRadius: spacing.radiusLg,
          overflow: "hidden",
        },
        todayTitle: {
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 10,
          fontSize: 22,
          fontFamily: fonts.medium,
        },
        lastDayAlert: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 18,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: spacing.radiusMd,
          borderWidth: 1,
        },
        lastDayAlertText: {
          fontSize: 15,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
        progressControls: {
          alignItems: "stretch",
          gap: 10,
          paddingHorizontal: 18,
          paddingBottom: 16,
        },
        progressMainRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        progressBtn: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 12,
          paddingHorizontal: 12,
          minWidth: 78,
          alignItems: "center",
        },
        progressBtnText: {
          fontSize: 17,
          fontFamily: fonts.medium,
        },
        progressLabelWrap: {
          flex: 1,
          alignItems: "center",
          minWidth: 0,
        },
        progressMonthLabel: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textTransform: "capitalize",
          marginBottom: 2,
        },
        progressLabel: {
          fontSize: 17,
          fontFamily: fonts.regular,
          textAlign: "center",
        },
        progressReset: {
          alignSelf: "center",
          paddingVertical: 10,
          paddingHorizontal: 10,
        },
        progressResetText: {
          fontSize: 18,
          fontFamily: fonts.medium,
        },
        startDateRow: {
          borderTopWidth: 1,
          paddingTop: 10,
          marginTop: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        startDateText: {
          fontSize: 14,
          fontFamily: fonts.regular,
          flex: 1,
        },
        timeRowBtn: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 16,
        },
        timeRowLabel: {
          fontSize: 12,
          fontFamily: fonts.medium,
          marginBottom: 3,
        },
        timeRowValue: {
          fontSize: 16,
          fontFamily: fonts.regular,
        },
        dayCard: {
          borderWidth: 1,
          borderRadius: spacing.radiusLg,
          padding: 14,
          overflow: "hidden",
        },
        dayCardHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
        },
        dayCardDate: {
          fontSize: 16,
          fontFamily: fonts.semiBold,
        },
        dayCardBadge: {
          fontSize: 13,
          fontFamily: fonts.medium,
        },
        setCurrentBtn: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 6,
          paddingHorizontal: 10,
        },
        setCurrentBtnText: {
          fontSize: 13,
          fontFamily: fonts.medium,
        },
        fieldsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        },
        field: {
          minWidth: 0,
          flexGrow: 1,
        },
        fieldHalf: {
          flexBasis: "48%",
          flexGrow: 1,
          minWidth: 0,
        },
        fieldFull: {
          flexBasis: "100%",
        },
        mealSection: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          padding: 10,
        },
        mealSectionTitle: {
          fontSize: 13,
          paddingBottom: 8,
        },
        mealRow: {
          paddingBottom: 8,
        },
        fieldLabel: {
          fontSize: 12,
          fontFamily: fonts.medium,
          paddingBottom: 6,
        },
        fieldValue: {
          fontSize: 16,
          fontFamily: fonts.medium,
          paddingVertical: 12,
        },
        fieldInput: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 12,
          paddingHorizontal: 12,
          fontSize: 16,
          fontFamily: fonts.regular,
        },
        amountRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 8,
          width: "100%",
        },
        amountInput: {
          flex: 1,
          minWidth: 0,
        },
        fieldMultiline: {
          minHeight: 72,
        },
        sendBar: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopLeftRadius: spacing.radiusLg,
          borderTopRightRadius: spacing.radiusLg,
          paddingHorizontal: spacing.screenPadding,
          paddingTop: 4,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: -2 },
          elevation: 3,
        },
        sendBarHeader: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 3,
        },
        sendBarCollapsedToggle: {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 2,
        },
        sendBarTitle: {
          flex: 1,
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        sendBarChevron: {
          fontSize: 12,
          paddingLeft: 8,
        },
        sendBarBody: {
          paddingTop: 3,
        },
        sendBarMeta: {
          fontSize: 12,
          paddingBottom: 8,
          fontFamily: fonts.regular,
        },
        payloadModal: {
          maxHeight: "86%",
        },
        payloadText: {
          height: 320,
          fontSize: 12,
          fontFamily: fonts.regular,
        },
        githubResultBox: {
          height: 120,
          marginTop: 10,
          fontSize: 12,
          fontFamily: fonts.regular,
        },
        toast: {
          position: "absolute",
          left: spacing.screenPadding,
          right: spacing.screenPadding,
          bottom: 110,
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        toastText: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
      }),
    [colors.borderLight],
  );
}
