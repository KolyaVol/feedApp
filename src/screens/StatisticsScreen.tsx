import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFoodTypes } from "../hooks/useFoodTypes";
import { useEntries } from "../hooks/useEntries";
import { useStats } from "../hooks/useStats";
import { DonutChart } from "../components/DonutChart";
import type { StatsPeriod } from "../types";
import { g } from "../globalStyles";

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<StatsPeriod>("daily");
  const [selectedDate] = useState(() => new Date());
  const { foodTypes } = useFoodTypes();
  const { entries } = useEntries();
  const aggregated = useStats(entries, foodTypes, period, selectedDate);

  const total = useMemo(() => aggregated.reduce((s, a) => s + a.amount, 0), [aggregated]);
  const totalUnit = aggregated[0]?.unit ?? "";

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>Statistics</Text>
      <View style={styles.periodRow}>
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.periodTab, period === key && styles.periodTabActive]}
            onPress={() => setPeriod(key)}
          >
            <Text style={[g.labelMuted, period === key && g.tabActiveText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <DonutChart
        data={aggregated}
        centerLabel={aggregated.length ? `${total} ${totalUnit}` : "—"}
      />
      <View style={g.listCard}>
        {aggregated.length === 0 ? (
          <Text style={[g.emptyText, g.emptyTextCenter]}>No data for this period</Text>
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

const styles = StyleSheet.create({
  periodRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
  },
  periodTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  periodTabActive: { backgroundColor: "#4a9eff" },
});
