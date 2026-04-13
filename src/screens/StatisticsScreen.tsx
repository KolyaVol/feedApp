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
import { useFeedStats, type FeedStatsOptions } from "../hooks/useFeedStats";
import { DonutChart } from "../components/DonutChart";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";

type RangeOption = { label: string; value: number | null };

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { days, loading, refresh } = useFeedDays();
  const [selectedRange, setSelectedRange] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const rangeOptions: RangeOption[] = useMemo(
    () => [
      { label: t("statsAllTime"), value: null },
      { label: t("statsLast7"), value: 7 },
      { label: t("statsLast14"), value: 14 },
      { label: t("statsLast30"), value: 30 },
      { label: t("statsLast60"), value: 60 },
      { label: t("statsLast90"), value: 90 },
    ],
    [t],
  );

  const statsOptions: FeedStatsOptions = useMemo(
    () => (selectedRange ? { lastNDays: selectedRange } : {}),
    [selectedRange],
  );

  const stats = useFeedStats(days, statsOptions);

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
        {t("titleStats")}
      </Text>

      {/* Range selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rangeRow}
      >
        {rangeOptions.map((opt) => {
          const active = selectedRange === opt.value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              style={[
                s.rangeChip,
                { backgroundColor: active ? colors.primary : colors.chipBg },
              ]}
              onPress={() => setSelectedRange(opt.value)}
            >
              <Text
                style={[
                  s.rangeChipText,
                  { color: active ? "#fff" : colors.textMuted },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {stats.totalDays === 0 ? (
        <View style={g.emptyBox}>
          <Text style={g.emptyText}>{t("statsNoData")}</Text>
          <Text style={[g.labelMuted, { marginTop: 6 }]}>{t("statsNoDataHint")}</Text>
        </View>
      ) : (
        <>
          {/* Summary card */}
          <View style={[s.summaryCard, { backgroundColor: colors.card }]}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {stats.totalDays}
                </Text>
                <Text style={[s.summaryLabel, { color: colors.textMuted }]}>
                  {t("statsTotalDays")}
                </Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {stats.uniqueProducts}
                </Text>
                <Text style={[s.summaryLabel, { color: colors.textMuted }]}>
                  {t("statsUniqueProducts")}
                </Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {stats.totalGrams}{t("grams")}
                </Text>
                <Text style={[s.summaryLabel, { color: colors.textMuted }]}>
                  {t("statsTotalGrams")}
                </Text>
              </View>
            </View>
          </View>

          {/* Donut chart */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              {t("statsFoodBreakdown")}
            </Text>
          </View>
          <DonutChart
            data={stats.chartData}
            centerLabel={`${stats.totalGrams}${t("grams")}`}
            unit={t("grams")}
          />

          {/* Per product breakdown */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              {t("statsPerProduct")}
            </Text>
          </View>
          <View style={[g.listCard]}>
            {stats.perProduct.map((item) => (
              <View key={item.product} style={g.listRow}>
                <Text style={[g.listItemTitle, s.capitalize]}>{item.product}</Text>
                <Text style={g.listItemAmount}>
                  {item.totalGrams}{t("grams")} · {item.days} {t("statsDays")} · ~{item.avgPerDay}{t("grams")}/{t("statsAvgPerDay")}
                </Text>
              </View>
            ))}
          </View>

          {/* Weekly breakdown */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              {t("statsWeekly")}
            </Text>
          </View>
          {stats.weeklyBreakdown.map((week) => (
            <View key={week.weekLabel} style={[s.weekCard, { backgroundColor: colors.card }]}>
              <Text style={[s.weekTitle, { color: colors.text }]}>
                {t("statsWeekOf")} {formatShort(week.weekLabel)}
              </Text>
              <Text style={[s.weekTotal, { color: colors.textMuted }]}>
                {week.totalGrams}{t("grams")}
              </Text>
              {week.days.map((d, idx) => (
                <View key={`${d.date}-${d.product}-${idx}`} style={s.weekDayRow}>
                  <Text style={[s.weekDayDate, { color: colors.textMuted }]}>
                    {formatShort(d.date)}
                  </Text>
                  <Text style={[s.weekDayFood, { color: colors.text }]}>{d.product}</Text>
                  <Text style={[s.weekDayAmount, { color: colors.text }]}>
                    {d.grams}{t("grams")}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
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
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        rangeRow: {
          paddingHorizontal: spacing.screenPadding,
          gap: 8,
          paddingBottom: 16,
        },
        rangeChip: {
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: spacing.radiusMd,
        },
        rangeChipText: {
          fontSize: 14,
          fontFamily: fonts.semiBold,
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
          fontSize: 20,
          fontWeight: "700",
          fontFamily: fonts.bold,
        },
        summaryLabel: {
          fontSize: 12,
          fontFamily: fonts.regular,
          marginTop: 2,
        },
        sectionHeader: {
          paddingHorizontal: spacing.screenPadding,
          marginTop: 8,
          marginBottom: 8,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: "600",
          fontFamily: fonts.semiBold,
        },
        capitalize: { textTransform: "capitalize" },
        weekCard: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 10,
        },
        weekTitle: {
          fontSize: 15,
          fontWeight: "600",
          fontFamily: fonts.semiBold,
          marginBottom: 4,
        },
        weekTotal: {
          fontSize: 13,
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
          fontFamily: fonts.regular,
        },
        weekDayFood: {
          flex: 1,
          fontSize: 14,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        weekDayAmount: {
          fontSize: 14,
          fontWeight: "500",
          fontFamily: fonts.medium,
        },
      }),
    [colors],
  );
}
