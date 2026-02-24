import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSchedule } from "../hooks/useSchedule";
import { DonutChart } from "../components/DonutChart";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing, foodTypePresetColors } from "../theme";
import type { AggregatedFood } from "../types";

const FOOD_TYPE_COLORS: Record<string, string> = {};
let colorIdx = 0;
function colorForFoodType(foodType: string): string {
  if (!FOOD_TYPE_COLORS[foodType]) {
    FOOD_TYPE_COLORS[foodType] =
      foodTypePresetColors[colorIdx % foodTypePresetColors.length];
    colorIdx++;
  }
  return FOOD_TYPE_COLORS[foodType];
}

export function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useLocalStyles(colors);
  const { planDays, schedules, loading, refresh } = useSchedule();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const summary = useMemo(() => {
    if (!planDays.length) return null;
    const sortedDates = planDays.map((d) => d.date).sort();
    const uniqueFoods = new Set(planDays.map((d) => d.food));
    const uniqueFoodTypes = new Set(planDays.map((d) => d.foodType));
    const totalGrams = planDays.reduce((s, d) => s + d.amountGrams, 0);
    return {
      totalDays: planDays.length,
      dateRange: `${formatShort(sortedDates[0])} — ${formatShort(sortedDates[sortedDates.length - 1])}`,
      foodsCount: uniqueFoods.size,
      foodTypesCount: uniqueFoodTypes.size,
      totalGrams,
    };
  }, [planDays]);

  const chartData: AggregatedFood[] = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const d of planDays) {
      byType[d.foodType] = (byType[d.foodType] ?? 0) + d.amountGrams;
    }
    return Object.entries(byType)
      .map(([name, amount]) => ({
        foodTypeId: name,
        name,
        color: colorForFoodType(name),
        unit: t("statsGrams"),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [planDays, t]);

  const perFoodStats = useMemo(() => {
    const map: Record<string, { total: number; days: number }> = {};
    for (const d of planDays) {
      if (!map[d.food]) map[d.food] = { total: 0, days: 0 };
      map[d.food].total += d.amountGrams;
      map[d.food].days += 1;
    }
    return Object.entries(map)
      .map(([food, { total, days }]) => ({
        food,
        total,
        days,
        avg: Math.round(total / days),
      }))
      .sort((a, b) => b.total - a.total);
  }, [planDays]);

  const weeklyBreakdown = useMemo(() => {
    const weeks: Record<
      string,
      { weekNum: number; month: number; days: typeof planDays }
    > = {};
    for (const d of planDays) {
      const key = `${d.sourceMonth}-${d.weekNumber}`;
      if (!weeks[key])
        weeks[key] = { weekNum: d.weekNumber, month: d.sourceMonth, days: [] };
      weeks[key].days.push(d);
    }
    return Object.values(weeks).sort(
      (a, b) => a.month - b.month || a.weekNum - b.weekNum,
    );
  }, [planDays]);

  const totalGrams = useMemo(
    () => chartData.reduce((s, d) => s + d.amount, 0),
    [chartData],
  );

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("statsScreenTitle")}
      </Text>

      {!summary ? (
        <View style={g.emptyBox}>
          <Text style={g.emptyText}>{t("statsNoData")}</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.totalDays}</Text>
                <Text style={styles.summaryLabel}>{t("statsTotalDays")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.foodsCount}</Text>
                <Text style={styles.summaryLabel}>{t("statsFoodsIntro")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {summary.totalGrams}{t("statsGrams")}
                </Text>
                <Text style={styles.summaryLabel}>{t("statsTotalAmount")}</Text>
              </View>
            </View>
            <Text style={styles.dateRange}>{summary.dateRange}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("statsFoodBreakdown")}</Text>
          </View>
          <DonutChart
            data={chartData}
            centerLabel={`${totalGrams} ${t("statsGrams")}`}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("statsPerFood")}</Text>
          </View>
          <View style={g.listCard}>
            {perFoodStats.map((item) => (
              <View key={item.food} style={g.listRow}>
                <Text style={[g.listItemTitle, styles.capitalize]}>
                  {item.food}
                </Text>
                <Text style={g.listItemAmount}>
                  {item.total}{t("statsGrams")} · {item.days} {t("statsDaysLabel")} ·{" "}
                  ~{item.avg}{t("statsGrams")}/{t("statsDayShort")}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("statsWeekly")}</Text>
          </View>
          {weeklyBreakdown.map((week) => {
            const weekTotal = week.days.reduce(
              (s, d) => s + d.amountGrams,
              0,
            );
            return (
              <View key={`${week.month}-${week.weekNum}`} style={styles.weekCard}>
                <Text style={styles.weekTitle}>
                  {t("statsMonth")} {week.month} · {t("statsWeekNum")}{" "}
                  {week.weekNum}
                </Text>
                <Text style={styles.weekTotal}>
                  {weekTotal}{t("statsGrams")} {t("statsTotalLabel")}
                </Text>
                {week.days.map((d) => (
                  <View key={d.id} style={styles.weekDayRow}>
                    <Text style={styles.weekDayDate}>
                      {formatShort(d.date)}
                    </Text>
                    <Text style={styles.weekDayFood}>{d.food}</Text>
                    <Text style={styles.weekDayAmount}>
                      {d.amountGrams}{t("statsGrams")}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function useLocalStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  border: string;
  borderLight: string;
  chipBg: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        summaryCard: {
          marginHorizontal: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 16,
          marginBottom: 16,
        },
        summaryRow: {
          flexDirection: "row",
          justifyContent: "space-around",
          marginBottom: 10,
        },
        summaryItem: { alignItems: "center" },
        summaryValue: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.primary,
          fontFamily: fonts.bold,
        },
        summaryLabel: {
          fontSize: 12,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginTop: 2,
        },
        dateRange: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          textAlign: "center",
        },
        sectionHeader: {
          paddingHorizontal: spacing.screenPadding,
          marginTop: 8,
          marginBottom: 8,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.text,
          fontFamily: fonts.semiBold,
        },
        capitalize: { textTransform: "capitalize" },
        weekCard: {
          marginHorizontal: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 10,
        },
        weekTitle: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
          fontFamily: fonts.semiBold,
          marginBottom: 4,
        },
        weekTotal: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginBottom: 8,
        },
        weekDayRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 4,
        },
        weekDayDate: {
          width: 60,
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
        },
        weekDayFood: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        weekDayAmount: {
          fontSize: 14,
          fontWeight: "500",
          color: colors.text,
          fontFamily: fonts.medium,
        },
      }),
    [colors],
  );
}
