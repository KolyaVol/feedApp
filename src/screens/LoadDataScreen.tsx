import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSchedule } from "../hooks/useSchedule";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
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

function toBase64Utf8(text: string): string | null {
  const btoaFn = (globalThis as any)?.btoa as ((s: string) => string) | undefined;
  if (!btoaFn) return null;
  return btoaFn(unescape(encodeURIComponent(text)));
}

function jsonString(value: unknown) {
  return JSON.stringify(value, null, 2);
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
  const styles = useLocalStyles(colors);

  const { schedules, loading, refresh, getDaysForSchedule, todayPlan, progressDateStr, setProgressDate, resetProgressDate } =
    useSchedule();

  const availableSchedules = schedules;

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const [draftById, setDraftById] = useState<Record<string, PlanDay>>({});
  const [amountTextById, setAmountTextById] = useState<Record<string, string>>({});
  const [subsTextById, setSubsTextById] = useState<Record<string, string>>({});
  const [originalJsonText, setOriginalJsonText] = useState<string>("");

  const [sendBarCollapsed, setSendBarCollapsed] = useState(false);
  const [payloadModalVisible, setPayloadModalVisible] = useState(false);
  const [payloadText, setPayloadText] = useState("");

  const progressDayStr = progressDateStr;

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
    const normalizedDays = draftDaysSorted.map((d) => {
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

  const openPayloadPreview = useCallback(() => {
    if (!selectedSchedule) return;
    const content = draftJsonText;
    const contentBase64 = toBase64Utf8(content);
    const payload = {
      message: "Update schedule",
      content: contentBase64 ?? "",
      branch: "main",
      path: `schedules/${selectedSchedule.month}-${selectedSchedule.id}.json`,
    };
    setPayloadText(
      jsonString({
        payload,
        contentPreview: content,
        base64Available: !!contentBase64,
      }),
    );
    setPayloadModalVisible(true);
  }, [draftJsonText, selectedSchedule]);

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
            {todayRow ? (
              <View style={[styles.todayWrap, { borderColor: colors.borderLight, backgroundColor: colors.card }]}>
                <Text style={[styles.todayTitle, { color: colors.text }]}>
                  {t("loadDataCurrentDay")}
                </Text>
                <View style={styles.progressControls}>
                  <TouchableOpacity
                    style={[styles.progressBtn, { borderColor: colors.borderLight }]}
                    onPress={() => setProgressDate(addDays(progressDayStr, -1))}
                  >
                    <Text style={[styles.progressBtnText, { color: colors.text }]}>{t("loadDataPrev")}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                    {formatDateDisplay(progressDayStr, locale)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.progressBtn, { borderColor: colors.borderLight }]}
                    onPress={() => setProgressDate(addDays(progressDayStr, 1))}
                  >
                    <Text style={[styles.progressBtnText, { color: colors.text }]}>{t("loadDataNext")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.progressReset} onPress={resetProgressDate}>
                    <Text style={[styles.progressResetText, { color: colors.primary }]}>{t("loadDataResetProgress")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.rowsWrap}>
                  <View style={[styles.dayCard, { borderColor: colors.borderLight, backgroundColor: colors.chipSelectedBg }]}>
                    <View style={styles.fieldsWrap}>
                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColDate")}</Text>
                        <Text style={[styles.fieldValue, { color: colors.text }]}>{formatDateDisplay(todayRow.date, locale)}</Text>
                      </View>

                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColTime")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={todayRow.time}
                          onChangeText={(v) => updateDay(todayRow.id, { time: v })}
                          onBlur={() =>
                            persistDay(todayRow.id, {
                              time: (draftById[todayRow.id]?.time ?? todayRow.time).trim(),
                            })
                          }
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColType")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={todayRow.foodType}
                          onChangeText={(v) => updateDay(todayRow.id, { foodType: v })}
                          onBlur={() =>
                            persistDay(todayRow.id, {
                              foodType: (draftById[todayRow.id]?.foodType ?? todayRow.foodType).trim(),
                            })
                          }
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                          {t("loadDataColAmount")}, {t("loadDataGrams")}
                        </Text>
                        <View style={styles.amountRow}>
                          <TextInput
                            style={[styles.fieldInput, styles.amountInput, { borderColor: colors.borderLight, color: colors.text }]}
                            value={amountTextById[todayRow.id] ?? String(todayRow.amountGrams)}
                            onChangeText={(v) => setAmountTextById((prev) => ({ ...prev, [todayRow.id]: v }))}
                            onBlur={() => {
                              const raw = (amountTextById[todayRow.id] ?? String(todayRow.amountGrams)).trim();
                              const n = parseInt(raw || "0", 10);
                              if (!isNaN(n) && n >= 0) persistDay(todayRow.id, { amountGrams: n });
                            }}
                            keyboardType="numeric"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColFood")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={todayRow.food}
                          onChangeText={(v) => updateDay(todayRow.id, { food: v })}
                          onBlur={() =>
                            persistDay(todayRow.id, {
                              food: (draftById[todayRow.id]?.food ?? todayRow.food).trim(),
                            })
                          }
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColSubs")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={subsTextById[todayRow.id] ?? todayRow.substitutions.join(", ")}
                          onChangeText={(v) => setSubsTextById((prev) => ({ ...prev, [todayRow.id]: v }))}
                          onBlur={() => {
                            const subs = (subsTextById[todayRow.id] ?? todayRow.substitutions.join(", "))
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            persistDay(todayRow.id, { substitutions: subs });
                          }}
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColNotes")}</Text>
                        <TextInput
                          style={[styles.fieldInput, styles.fieldMultiline, { borderColor: colors.borderLight, color: colors.text }]}
                          value={todayRow.notes ?? ""}
                          onChangeText={(v) => updateDay(todayRow.id, { notes: v || undefined })}
                          onBlur={() =>
                            persistDay(todayRow.id, {
                              notes: (draftById[todayRow.id]?.notes ?? todayRow.notes) || undefined,
                            })
                          }
                          placeholderTextColor={colors.placeholder}
                          multiline
                        />
                      </View>
                    </View>
                  </View>
                </View>
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
                const amountParsed = parseInt(amountText, 10);
                const amountBad = !amountText.trim() || isNaN(amountParsed) || amountParsed < 0;
                const isProgress = d.date === progressDayStr;
                return (
                  <View
                    key={d.id}
                    style={[
                      styles.dayCard,
                      { borderColor: colors.borderLight, backgroundColor: colors.card },
                      isProgress && { backgroundColor: colors.chipSelectedBg },
                    ]}
                  >
                    <TouchableOpacity onPress={() => setProgressDate(d.date)} style={styles.dayCardHeader}>
                      <Text style={[styles.dayCardDate, { color: colors.text }]}>
                        {formatDateDisplay(d.date, locale)}
                      </Text>
                      {isProgress ? (
                        <Text style={[styles.dayCardBadge, { color: colors.primary }]}>{t("loadDataCurrentDay")}</Text>
                      ) : null}
                    </TouchableOpacity>

                    <View style={styles.fieldsWrap}>
                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColTime")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={d.time}
                          onChangeText={(v) => updateDay(d.id, { time: v })}
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                          {t("loadDataColAmount")}, {t("loadDataGrams")}
                        </Text>
                        <View style={styles.amountRow}>
                          <TextInput
                            style={[
                              styles.fieldInput,
                              styles.amountInput,
                              { borderColor: amountBad ? colors.danger : colors.borderLight, color: colors.text },
                            ]}
                            value={amountText}
                            onChangeText={(v) => setAmountTextById((prev) => ({ ...prev, [d.id]: v }))}
                            keyboardType="numeric"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColType")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={d.foodType}
                          onChangeText={(v) => updateDay(d.id, { foodType: v })}
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldHalf]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColFood")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={d.food}
                          onChangeText={(v) => updateDay(d.id, { food: v })}
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColSubs")}</Text>
                        <TextInput
                          style={[styles.fieldInput, { borderColor: colors.borderLight, color: colors.text }]}
                          value={subsTextById[d.id] ?? d.substitutions.join(", ")}
                          onChangeText={(v) => setSubsTextById((prev) => ({ ...prev, [d.id]: v }))}
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={[styles.field, styles.fieldFull]}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("loadDataColNotes")}</Text>
                        <TextInput
                          style={[styles.fieldInput, styles.fieldMultiline, { borderColor: colors.borderLight, color: colors.text }]}
                          value={d.notes ?? ""}
                          onChangeText={(v) => updateDay(d.id, { notes: v || undefined })}
                          placeholderTextColor={colors.placeholder}
                          multiline
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.sendBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.borderLight,
            paddingBottom: 10 + insets.bottom,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setSendBarCollapsed((v) => !v)}
          style={styles.sendBarHeader}
        >
          <Text style={[styles.sendBarTitle, { color: colors.text }]}>
            {t("loadDataGithubStore")}
          </Text>
          <Text style={[styles.sendBarChevron, { color: colors.textMuted }]}>
            {sendBarCollapsed ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {!sendBarCollapsed && (
          <View style={styles.sendBarBody}>
            <Text style={[styles.sendBarMeta, { color: colors.textMuted }]}>
              {dirty ? t("loadDataUnsavedChanges") : t("loadDataNoChanges")}{" "}
              {amountInvalidCount ? `· ${t("loadDataInvalidCells", { count: amountInvalidCount })}` : ""}
            </Text>
            <TouchableOpacity
              style={[g.buttonFull, (!dirty || amountInvalidCount > 0) && g.buttonDisabled]}
              disabled={!dirty || amountInvalidCount > 0 || !selectedSchedule}
              onPress={openPayloadPreview}
            >
              <Text style={g.buttonFullText}>{t("loadDataSendToGithub")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
            <View style={g.modalButtons}>
              <TouchableOpacity style={g.saveBtn} onPress={() => setPayloadModalVisible(false)}>
                <Text style={g.saveBtnText}>{t("loadDataClose")}</Text>
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
        progressControls: {
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingHorizontal: 18,
          paddingBottom: 16,
          flexWrap: "wrap",
        },
        progressBtn: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 14,
          paddingHorizontal: 18,
          minWidth: 86,
          alignItems: "center",
        },
        progressBtnText: {
          fontSize: 18,
          fontFamily: fonts.medium,
        },
        progressLabel: {
          fontSize: 18,
          fontFamily: fonts.regular,
        },
        progressReset: {
          paddingVertical: 14,
          paddingHorizontal: 10,
        },
        progressResetText: {
          fontSize: 18,
          fontFamily: fonts.medium,
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
          paddingHorizontal: spacing.screenPadding,
          paddingTop: 10,
        },
        sendBarHeader: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
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
          paddingTop: 6,
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
      }),
    [colors.borderLight],
  );
}
