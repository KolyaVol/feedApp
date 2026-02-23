import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { PieChart } from "react-native-chart-kit";
import type { AggregatedFood } from "../types";
import { g } from "../globalStyles";
import { colors, fonts } from "../theme";

const chartConfig = {
  color: () => "#666",
  labelColor: () => "#666",
};

interface DonutChartProps {
  data: AggregatedFood[];
  centerLabel?: string;
}

export function DonutChart({ data, centerLabel }: DonutChartProps) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 280);

  if (!data.length) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={g.emptyText}>No data for this period</Text>
      </View>
    );
  }

  const chartData = data.map((d) => ({ name: d.name, amount: d.amount, color: d.color }));
  const total = data.reduce((s, d) => s + d.amount, 0);

  const paddingLeft = Math.round(size / 4);

  return (
    <View style={styles.wrap}>
      <View style={[styles.chartBox, { width: size, height: size }]}>
        <PieChart
          data={chartData}
          width={size}
          height={size}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft={String(paddingLeft)}
          absolute
          hasLegend={false}
          chartConfig={chartConfig}
        />
        {centerLabel != null && (
          <View style={[StyleSheet.absoluteFill, styles.centerLabel]}>
            <Text style={g.chartCenterText}>{centerLabel}</Text>
          </View>
        )}
      </View>
      <View style={styles.legendRow}>
        {data.map((item) => (
          <View key={item.foodTypeId} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>
              {item.amount} {item.unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  chartBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.emptyChart,
    borderRadius: 140,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
    marginHorizontal: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: fonts.medium,
  },
});
