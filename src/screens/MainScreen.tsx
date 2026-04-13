import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useFeedDays } from "../hooks/useFeedDays";
import { useBestPractices } from "../hooks/useBestPractices";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";
import type { FeedDay, MealType, MealEntry } from "../types";
import { formatDateStr, addDaysToDate } from "../data/feedDays";

function totalGramsForDay(day: FeedDay): number {
  const sum = (arr: MealEntry[]) => arr.reduce((s, e) => s + e.grams, 0);
  return sum(day.morning) + sum(day.lunch) + sum(day.evening);
}

function uniqueProductsForDay(day: FeedDay): number {
  const set = new Set<string>();
  for (const m of [...day.morning, ...day.lunch, ...day.evening]) {
    const key = m.product.trim().toLowerCase();
    if (key) set.add(key);
  }
  return set.size;
}

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { days, loading, refresh, toggleEaten } = useFeedDays();
  const bestPractices = useBestPractices();

  const [viewDate, setViewDate] = useState(() => formatDateStr(new Date()));

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const todayDay = useMemo(
    () => days.find((d) => d.date === viewDate) ?? null,
    [days, viewDate],
  );

  const todayStr = useMemo(() => {
    const d = new Date(viewDate + "T00:00:00");
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [locale, viewDate]);

  const canGoPrev = useMemo(
    () => days.some((d) => d.date < viewDate),
    [days, viewDate],
  );
  const canGoNext = useMemo(
    () => days.some((d) => d.date > viewDate),
    [days, viewDate],
  );

  const goPrev = useCallback(() => {
    const prev = [...days]
      .filter((d) => d.date < viewDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) setViewDate(prev.date);
  }, [days, viewDate]);

  const goNext = useCallback(() => {
    const next = [...days]
      .filter((d) => d.date > viewDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) setViewDate(next.date);
  }, [days, viewDate]);

  const goToday = useCallback(() => {
    setViewDate(formatDateStr(new Date()));
  }, []);

  const randomTip = useMemo(() => {
    const tips = bestPractices.data?.safetyTips ?? [];
    if (!tips.length) return null;
    return tips[Math.floor(Math.random() * tips.length)];
  }, [bestPractices.data]);

  const mealLabel = useCallback(
    (type: MealType) => {
      if (type === "morning") return t("mealMorning");
      if (type === "lunch") return t("mealLunch");
      return t("mealEvening");
    },
    [t],
  );

  if (loading) {
    return (
      <View style={[g.screenContainer, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("titleHome")}
      </Text>

      {/* Date navigation */}
      <View style={s.dateNav}>
        <TouchableOpacity
          style={[s.navBtn, !canGoPrev && g.buttonDisabled]}
          disabled={!canGoPrev}
          onPress={goPrev}
        >
          <Text style={[s.navBtnText, { color: colors.text }]}>{t("mainPrevDay")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} style={s.dateLabelWrap}>
          <Text style={[s.dateLabel, { color: colors.text }]}>{todayStr}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.navBtn, !canGoNext && g.buttonDisabled]}
          disabled={!canGoNext}
          onPress={goNext}
        >
          <Text style={[s.navBtnText, { color: colors.text }]}>{t("mainNextDay")}</Text>
        </TouchableOpacity>
      </View>

      {!todayDay ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={g.emptyText}>{t("mainNoData")}</Text>
          <Text style={[g.labelMuted, { marginTop: 6, textAlign: "center" }]}>
            {t("mainNoDataHint")}
          </Text>
        </View>
      ) : (
        <>
          {/* Summary stats */}
          <View style={[s.summaryCard, { backgroundColor: colors.card }]}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {totalGramsForDay(todayDay)}{t("grams")}
                </Text>
                <Text style={[s.summaryLabel, { color: colors.textMuted }]}>
                  {t("mainTotalGrams")}
                </Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {uniqueProductsForDay(todayDay)}
                </Text>
                <Text style={[s.summaryLabel, { color: colors.textMuted }]}>
                  {t("mainProducts")}
                </Text>
              </View>
            </View>
          </View>

          {/* Meal cards */}
          {(["morning", "lunch", "evening"] as const).map((type) => {
            const meals = todayDay[type];
            const isEaten = todayDay.eaten?.[type] ?? false;
            if (meals.length === 0) return null;
            return (
              <View
                key={type}
                style={[
                  s.mealCard,
                  { backgroundColor: colors.card },
                  isEaten && { backgroundColor: colors.pastelGreen },
                ]}
              >
                <Text style={[s.mealTypeLabel, { color: colors.textMuted }]}>
                  {mealLabel(type)}
                </Text>
                {meals.map((entry, idx) => (
                  <View key={idx} style={s.mealEntry}>
                    <Text style={[s.mealProduct, { color: colors.text }]}>
                      {entry.product}
                    </Text>
                    <View style={[s.gramsBadge, { backgroundColor: colors.chipBg }]}>
                      <Text style={[s.gramsBadgeText, { color: colors.text }]}>
                        {entry.grams}{t("grams")}
                      </Text>
                    </View>
                  </View>
                ))}
                {isEaten && (
                  <View style={[s.eatenBadge, { backgroundColor: colors.pastelGreen }]}>
                    <Text style={[s.eatenBadgeText, { color: colors.text }]}>{t("mainEaten")}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    s.eatBtn,
                    isEaten
                      ? { backgroundColor: colors.chipBg }
                      : { backgroundColor: colors.pastelYellow },
                  ]}
                  onPress={() => toggleEaten(todayDay.id, type)}
                >
                  <Text style={[s.eatBtnText, { color: colors.text }]}>
                    {isEaten ? t("mainUnmarkEaten") : t("mainMarkEaten")}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Notes */}
          {todayDay.notes ? (
            <View style={[s.notesCard, { backgroundColor: colors.card }]}>
              <Text style={[s.notesLabel, { color: colors.textMuted }]}>{t("notes")}</Text>
              <Text style={[s.notesText, { color: colors.text }]}>{todayDay.notes}</Text>
            </View>
          ) : null}
        </>
      )}

      {/* Tip of the day */}
      {randomTip && (
        <View style={[s.tipCard, { backgroundColor: colors.pastelYellow }]}>
          <Text style={[s.tipLabel, { color: colors.textMuted }]}>{t("mainTipOfDay")}</Text>
          <Text style={[s.tipText, { color: colors.text }]}>{randomTip}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function useStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  border: string;
  pastelGreen: string;
  pastelYellow: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        dateNav: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 16,
          gap: 8,
        },
        navBtn: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusMd,
          backgroundColor: colors.chipBg,
        },
        navBtnText: {
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        dateLabelWrap: {
          flex: 1,
          alignItems: "center",
        },
        dateLabel: {
          fontSize: 15,
          fontFamily: fonts.medium,
          textTransform: "capitalize",
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
        summaryCard: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusLg,
          padding: 16,
          marginBottom: 16,
        },
        summaryRow: {
          flexDirection: "row",
          justifyContent: "space-around",
        },
        summaryItem: { alignItems: "center" },
        summaryValue: {
          fontSize: 22,
          fontWeight: "700",
          fontFamily: fonts.bold,
        },
        summaryLabel: {
          fontSize: 12,
          fontFamily: fonts.regular,
          marginTop: 2,
        },
        mealCard: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusLg,
          padding: 18,
          marginBottom: 12,
        },
        mealTypeLabel: {
          fontSize: 13,
          fontFamily: fonts.regular,
          marginBottom: 8,
        },
        mealEntry: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        },
        mealProduct: {
          fontSize: 18,
          fontFamily: fonts.semiBold,
          textTransform: "capitalize",
          flex: 1,
        },
        gramsBadge: {
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: spacing.radiusChip,
        },
        gramsBadgeText: {
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        eatenBadge: {
          alignSelf: "flex-start",
          paddingVertical: 3,
          paddingHorizontal: 10,
          borderRadius: spacing.radiusChip,
          marginBottom: 6,
        },
        eatenBadgeText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        eatBtn: {
          marginTop: 8,
          paddingVertical: 10,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
        },
        eatBtnText: {
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        notesCard: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 12,
        },
        notesLabel: {
          fontSize: 12,
          fontFamily: fonts.medium,
          marginBottom: 4,
        },
        notesText: {
          fontSize: 14,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        tipCard: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 12,
        },
        tipLabel: {
          fontSize: 12,
          fontFamily: fonts.medium,
          marginBottom: 4,
        },
        tipText: {
          fontSize: 14,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
      }),
    [colors],
  );
}
