import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFoodTypes } from "../hooks/useFoodTypes";
import { useEntries } from "../hooks/useEntries";
import { useStats } from "../hooks/useStats";
import { DonutChart } from "../components/DonutChart";
import type { StatsPeriod } from "../types";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { spacing } from "../theme";
import type { TranslationKey } from "../i18n/en";

const PERIOD_KEYS: { key: StatsPeriod; labelKey: TranslationKey }[] = [
  { key: "daily", labelKey: "statsDaily" },
  { key: "weekly", labelKey: "statsWeekly" },
  { key: "monthly", labelKey: "statsMonthly" },
];

export function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<StatsPeriod>("daily");
  const [selectedDate] = useState(() => new Date());
  const { foodTypes } = useFoodTypes();
  const { entries } = useEntries();
  const aggregated = useStats(entries, foodTypes, period, selectedDate);
  const styles = usePeriodStyles(colors);

  const total = useMemo(() => aggregated.reduce((s, a) => s + a.amount, 0), [aggregated]);
  const totalUnit = aggregated[0]?.unit ?? "";

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>{t("statsScreenTitle")}</Text>
      <View style={styles.periodRow}>
        {PERIOD_KEYS.map(({ key, labelKey }) => (
          <TouchableOpacity
            key={key}
            style={[styles.periodTab, period === key && styles.periodTabActive]}
            onPress={() => setPeriod(key)}
          >
            <Text style={[g.labelMuted, period === key && g.tabActiveText]}>{t(labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <DonutChart
        data={aggregated}
        centerLabel={aggregated.length ? `${total} ${totalUnit}` : "—"}
      />
      <View style={g.listCard}>
        {aggregated.length === 0 ? (
          <Text style={[g.emptyText, g.emptyTextCenter]}>{t("statsNoDataForPeriod")}</Text>
        ) : (
          aggregated.map((item) => (
            <View key={item.foodTypeId} style={g.listRow}>
              <View style={[g.listDot, { backgroundColor: item.color }]} />
              <Text style={g.listItemTitle}>{item.name}</Text>
              <Text style={g.listItemAmount}>
                {item.amount} {item.unit}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function usePeriodStyles(colors: {
  card: string;
  primary: string;
  borderLight: string;
  danger: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        periodRow: {
          flexDirection: "row",
          marginHorizontal: spacing.screenPadding,
          marginBottom: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusMd,
          overflow: "hidden",
        },
        periodTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
        periodTabActive: { backgroundColor: colors.primary },
      }),
    [colors],
  );
}
