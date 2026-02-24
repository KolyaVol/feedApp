import React, { useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSchedule } from "../hooks/useSchedule";
import { scheduleDailyPlanNotification } from "../notifications/schedule";
import { fonts, spacing } from "../theme";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useLocalStyles(colors);
  const {
    schedules,
    loading,
    refresh,
    todayPlan,
    getScheduleForDay,
  } = useSchedule();

  const tipPickedRef = useRef(false);
  const [safetyTip, setSafetyTip] = React.useState<string | undefined>();

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

  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, []);

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
        <Text style={styles.dateHeader}>{todayStr}</Text>
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
      <Text style={styles.dateHeader}>{todayStr}</Text>

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
            <Text style={styles.detailBadgeText}>⏰ {plan.time}</Text>
          </View>
          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>
              {t("mainWeek")} {plan.weekNumber}
            </Text>
          </View>
        </View>
      </View>

      {plan.substitutions.length > 0 && (
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
