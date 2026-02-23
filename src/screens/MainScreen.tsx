import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFoodTypes } from "../hooks/useFoodTypes";
import { useEntries } from "../hooks/useEntries";
import { useStats } from "../hooks/useStats";
import { getEntriesInRange, getStartOfWeek, getEndOfWeek } from "../data/entries";
import { DonutChart } from "../components/DonutChart";
import { QuickAddForm } from "../components/QuickAddForm";
import type { FoodPriority } from "../types";
import { pastelColorForWeeklyMin, spacing } from "../theme";
import { formatDate } from "../utils/date";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";

const PRIORITY_ORDER: Record<FoodPriority, number> = { high: 3, middle: 2, low: 1 };
function priorityRank(p?: FoodPriority): number {
  return p ? PRIORITY_ORDER[p] : 0;
}

export function MainScreen({ onAddVariant }: { onAddVariant: () => void }) {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { foodTypes, refresh: refreshFoodTypes } = useFoodTypes();
  const { entries, entriesForDate, addEntry } = useEntries(selectedDate);

  const useCountByFoodType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.foodTypeId] = (counts[e.foodTypeId] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const sortedAndFilteredFoodTypes = useMemo(() => {
    const sorted = [...foodTypes].sort((a, b) => {
      const pa = priorityRank(a.priority);
      const pb = priorityRank(b.priority);
      if (pb !== pa) return pb - pa;
      return (useCountByFoodType[b.id] ?? 0) - (useCountByFoodType[a.id] ?? 0);
    });
    const q = searchQuery.trim().toLowerCase();
    return q ? sorted.filter((f) => f.name.toLowerCase().includes(q)) : sorted;
  }, [foodTypes, useCountByFoodType, searchQuery]);

  const chipBackgroundByFoodTypeId = useMemo(() => {
    const weekStart = getStartOfWeek(selectedDate);
    const weekEnd = getEndOfWeek(selectedDate);
    const weekEntries = getEntriesInRange(entries, weekStart, weekEnd);
    const weeklyTotalByFoodType: Record<string, number> = {};
    for (const e of weekEntries) {
      weeklyTotalByFoodType[e.foodTypeId] = (weeklyTotalByFoodType[e.foodTypeId] ?? 0) + e.amount;
    }
    const result: Record<string, string> = {};
    for (const f of foodTypes) {
      const min = f.weeklyMinimumAmount;
      if (min == null || min <= 0) continue;
      const total = weeklyTotalByFoodType[f.id] ?? 0;
      const ratio = total / min;
      result[f.id] = pastelColorForWeeklyMin(ratio);
    }
    return result;
  }, [entries, foodTypes, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      refreshFoodTypes();
    }, [refreshFoodTypes]),
  );
  const aggregated = useStats(entries, foodTypes, "daily", selectedDate);

  const totalAmount = useMemo(() => aggregated.reduce((s, a) => s + a.amount, 0), [aggregated]);
  const totalUnit = aggregated[0]?.unit ?? "ml";
  const centerLabel = aggregated.length ? `${totalAmount} ${totalUnit}` : "—";

  const onDateChange = (_: unknown, date?: Date) => {
    setShowPicker(Platform.OS === "ios" ? true : false);
    if (date) setSelectedDate(date);
  };

  const handleAdd = async (foodTypeId: string, amount: number) => {
    await addEntry({
      foodTypeId,
      amount,
      timestamp: Date.now(),
    });
  };

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>Baby Feed</Text>
      <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)}>
        <Text style={g.titleSection}>{formatDate(selectedDate)}</Text>
        <Text style={g.linkText}>Change date</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
      {Platform.OS === "ios" && showPicker && (
        <TouchableOpacity onPress={() => setShowPicker(false)}>
          <Text style={[g.linkText, g.textBody, styles.doneDate]}>Done</Text>
        </TouchableOpacity>
      )}
      <View style={styles.chartWrap}>
        <DonutChart data={aggregated} centerLabel={centerLabel} />
      </View>
      <Text style={[g.labelMuted, styles.summary]}>
        {entriesForDate.length} entries · {totalAmount} {totalUnit} total
      </Text>
      <View style={styles.searchWrap}>
        <TextInput
          style={[g.input, styles.searchInput]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search dishes..."
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <QuickAddForm
        foodTypes={sortedAndFilteredFoodTypes}
        onAdd={handleAdd}
        chipBackgroundByFoodTypeId={chipBackgroundByFoodTypeId}
      />
      <TouchableOpacity style={g.primaryButtonOutline} onPress={onAddVariant}>
        <Text style={g.primaryButtonOutlineText}>+ Add new variant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  doneDate: { padding: 8, textAlign: "center" },
  summary: { textAlign: "center", marginBottom: 8 },
  chartWrap: {
    width: "100%",
    alignItems: "center",
    marginVertical: 8,
  },
  searchWrap: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 4,
  },
  searchInput: {
    margin: 0,
  },
});
