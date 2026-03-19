import React, { useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSchedule } from "../hooks/useSchedule";
import { scheduleDailyPlanNotification } from "../notifications/schedule";
import { fonts, spacing } from "../theme";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { dateToTime, timeToDate } from "../utils/date";

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const { hideSubstitutions } = usePreferences();
  const styles = useLocalStyles(colors);
  const {
    schedules,
    loading,
    refresh,
    todayPlan,
    getScheduleForDay,
    progressDateStr,
    updateAllPlanDaysTime,
  } = useSchedule();

  const tipPickedRef = useRef(false);
  const [safetyTip, setSafetyTip] = React.useState<string | undefined>();
  const [changeTimeModalVisible, setChangeTimeModalVisible] = React.useState(false);
  const [changeTimeValue, setChangeTimeValue] = React.useState(() => new Date());
  const [showTimePicker, setShowTimePicker] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      tipPickedRef.current = false;
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (tipPickedRef.current) return;
    const allTips = schedules.flatMap((s) => s.safetyGuidelines);
    if (allTips.length) {
      setSafetyTip(allTips[Math.floor(Math.random() * allTips.length)]);
      tipPickedRef.current = true;
    }
  }, [schedules]);

  useFocusEffect(
    useCallback(() => {
      scheduleDailyPlanNotification();
    }, []),
  );

  const plan = todayPlan();
  const schedule = plan ? getScheduleForDay(plan) : undefined;

  const dayNumber = useMemo(() => {
    if (!schedule || !plan) return null;
    const start = new Date(schedule.startDate + "T00:00:00").getTime();
    const cur = new Date(plan.date + "T00:00:00").getTime();
    const diffDays = Math.floor((cur - start) / 86400000);
    return diffDays + 1;
  }, [plan, schedule]);

  const todayStr = useMemo(() => {
    const now = new Date(progressDateStr + "T00:00:00");
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [progressDateStr]);

  const todayHeader = useMemo(() => {
    return dayNumber ? `${todayStr} · ${t("loadDataDay")} ${dayNumber}` : todayStr;
  }, [dayNumber, t, todayStr]);

  const daysRemainingAlert = useMemo(() => {
    const end = schedule?.endDate;
    if (!end) return null;
    const endMs = new Date(end + "T00:00:00").getTime();
    const curMs = new Date(progressDateStr + "T00:00:00").getTime();
    const days = Math.floor((endMs - curMs) / 86400000);
    if (days > 7) return null;
    if (days <= 3) return { level: "red" as const, days };
    if (days <= 5) return { level: "orange" as const, days };
    return { level: "yellow" as const, days };
  }, [schedule?.endDate, progressDateStr]);

  const openChangeAllDaysTime = useCallback(() => {
    if (!plan) return;
    setChangeTimeValue(timeToDate(plan.time));
    setShowTimePicker(Platform.OS === "ios");
    setChangeTimeModalVisible(true);
  }, [plan]);

  const saveAllDaysTime = useCallback(async () => {
    const time = dateToTime(changeTimeValue);
    await updateAllPlanDaysTime(time);
    await scheduleDailyPlanNotification();
    setChangeTimeModalVisible(false);
    setShowTimePicker(false);
  }, [changeTimeValue, updateAllPlanDaysTime]);

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("mainScreenTitle")}
        </Text>
        <Text style={styles.dateHeader}>{todayHeader}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={g.emptyText}>{t("mainNoPlan")}</Text>
          <Text style={[g.labelMuted, styles.emptyHint]}>
            {t("mainNoPlanHint")}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("mainScreenTitle")}
      </Text>
      <Text style={styles.dateHeader}>{todayHeader}</Text>

      {daysRemainingAlert ? (
        <View
          style={[
            styles.updateDataAlert,
            {
              backgroundColor:
                daysRemainingAlert.level === "red"
                  ? colors.pastelRed
                  : daysRemainingAlert.level === "orange"
                    ? colors.pastelOrange
                    : colors.pastelYellow,
            },
          ]}
        >
          <Text style={[styles.updateDataAlertText, { color: colors.text }]}>
            {t("mainDaysRemainingAlert", { count: Math.max(0, daysRemainingAlert.days) })}
          </Text>
        </View>
      ) : null}

      <View style={styles.mainCard}>
        <Text style={styles.foodTypeLabel}>{plan.foodType}</Text>
        <Text style={styles.foodName}>{plan.food}</Text>
        <View style={styles.detailsRow}>
          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>
              {plan.amountGrams}{t("mainGrams")}
            </Text>
          </View>
          <View style={styles.detailBadge}>
            <TouchableOpacity onPress={openChangeAllDaysTime}>
              <Text style={styles.detailBadgeText}>⏰ {plan.time}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>
              {t("mainWeek")} {plan.weekNumber}
            </Text>
          </View>
        </View>
      </View>

      {!hideSubstitutions && plan.substitutions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainSubstitutions")}</Text>
          <View style={styles.chipsRow}>
            {plan.substitutions.map((sub, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{sub}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {plan.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainNotes")}</Text>
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>{plan.notes}</Text>
          </View>
        </View>
      ) : null}

      {safetyTip ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainSafetyTip")}</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>💡 {safetyTip}</Text>
          </View>
        </View>
      ) : null}
      <Modal visible={changeTimeModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("mainChangeAllDaysTimeTitle")}</Text>
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[g.labelMuted, styles.timeLabel]}>
                {t("mainChangeAllDaysTimeLabel")}
              </Text>
              <Text style={g.textBody}>{dateToTime(changeTimeValue)}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={changeTimeValue}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  if (d) setChangeTimeValue(d);
                  setShowTimePicker(Platform.OS === "ios");
                }}
              />
            )}
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => {
                  setChangeTimeModalVisible(false);
                  setShowTimePicker(false);
                }}
              >
                <Text style={g.cancelBtnText}>{t("remindersCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={saveAllDaysTime}>
                <Text style={g.saveBtnText}>{t("mainChangeAllDaysTimeSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function useLocalStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  border: string;
  background: string;
  pastelGreen: string;
  pastelYellow: string;
  pastelOrange: string;
  pastelRed: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        dateHeader: {
          fontSize: 15,
          color: colors.textMuted,
          fontFamily: fonts.medium,
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 16,
          textTransform: "capitalize",
        },
        updateDataAlert: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 16,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: spacing.radiusMd,
        },
        updateDataAlertText: {
          fontSize: 15,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
        mainCard: {
          marginHorizontal: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 20,
          alignItems: "center",
          marginBottom: 16,
        },
        foodTypeLabel: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginBottom: 6,
          textAlign: "center",
        },
        foodName: {
          fontSize: 28,
          fontWeight: "700",
          color: colors.text,
          fontFamily: fonts.bold,
          marginBottom: 14,
          textTransform: "capitalize",
          textAlign: "center",
        },
        detailsRow: {
          flexDirection: "row",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        },
        detailBadge: {
          backgroundColor: colors.chipBg,
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusChip,
        },
        detailBadgeText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.medium,
        },
        timeRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 20,
        },
        timeLabel: { marginRight: 12 },
        section: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 16,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
          fontFamily: fonts.semiBold,
          marginBottom: 8,
        },
        chipsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        chip: {
          backgroundColor: colors.chipBg,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusChip,
        },
        chipText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        noteCard: {
          backgroundColor: colors.card,
          borderRadius: spacing.radiusMd,
          padding: 14,
        },
        noteText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        tipCard: {
          backgroundColor: colors.pastelYellow,
          borderRadius: spacing.radiusMd,
          padding: 14,
        },
        tipText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        emptyCard: {
          margin: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 32,
          alignItems: "center",
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: 12,
        },
        emptyHint: {
          marginTop: 8,
          textAlign: "center",
        },
      }),
    [colors],
  );
}
