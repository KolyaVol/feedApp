import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSchedule } from "../hooks/useSchedule";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { fonts, spacing } from "../theme";
import type { LoadedSchedule } from "../types";

interface FoodSummary {
  food: string;
  foodType: string;
  totalGrams: number;
  substitutions: string[];
}

export function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const { hideSubstitutions } = usePreferences();
  const styles = useLocalStyles(colors);
  const { planDays, schedules, loading, refresh } = useSchedule();
  const [packageSizes, setPackageSizes] = useState<Record<string, string>>({});
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const sortedSchedules = useMemo<LoadedSchedule[]>(() => {
    return [...schedules].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [schedules]);

  useEffect(() => {
    if (selectedScheduleId && sortedSchedules.some((s) => s.id === selectedScheduleId)) {
      return;
    }
    setSelectedScheduleId(sortedSchedules[sortedSchedules.length - 1]?.id ?? null);
  }, [selectedScheduleId, sortedSchedules]);

  const selectedScheduleIndex = useMemo(() => {
    if (!selectedScheduleId) return -1;
    return sortedSchedules.findIndex((s) => s.id === selectedScheduleId);
  }, [selectedScheduleId, sortedSchedules]);

  const selectedSchedule = selectedScheduleIndex >= 0 ? sortedSchedules[selectedScheduleIndex] : null;
  const canGoPrev = selectedScheduleIndex > 0;
  const canGoNext =
    selectedScheduleIndex >= 0 && selectedScheduleIndex < sortedSchedules.length - 1;

  const visiblePlanDays = useMemo(() => {
    if (!selectedSchedule) return planDays;
    return planDays.filter((day) => day.scheduleId === selectedSchedule.id);
  }, [planDays, selectedSchedule]);

  const foods: FoodSummary[] = useMemo(() => {
    const map: Record<
      string,
      { foodType: string; totalGrams: number; subs: Set<string> }
    > = {};
    for (const d of visiblePlanDays) {
      const key = d.food.toLowerCase();
      if (!map[key]) {
        map[key] = { foodType: d.foodType, totalGrams: 0, subs: new Set() };
      }
      map[key].totalGrams += d.amountGrams;
      for (const s of d.substitutions) {
        map[key].subs.add(s);
      }
    }
    return Object.entries(map)
      .map(([food, { foodType, totalGrams, subs }]) => ({
        food,
        foodType,
        totalGrams,
        substitutions: Array.from(subs),
      }))
      .sort((a, b) => b.totalGrams - a.totalGrams);
  }, [visiblePlanDays]);

  const goPrevMonth = useCallback(() => {
    if (!canGoPrev || selectedScheduleIndex < 1) return;
    setSelectedScheduleId(sortedSchedules[selectedScheduleIndex - 1].id);
  }, [canGoPrev, selectedScheduleIndex, sortedSchedules]);

  const goNextMonth = useCallback(() => {
    if (!canGoNext || selectedScheduleIndex < 0) return;
    setSelectedScheduleId(sortedSchedules[selectedScheduleIndex + 1].id);
  }, [canGoNext, selectedScheduleIndex, sortedSchedules]);

  const setSize = (food: string, value: string) => {
    setPackageSizes((prev) => ({ ...prev, [food]: value }));
  };

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={g.screenContainer}
      contentContainerStyle={g.screenContent}
    >
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("calcTitle")}
      </Text>
      {selectedSchedule ? (
        <View style={styles.monthSwitcher}>
          <TouchableOpacity
            style={[styles.monthSwitchBtn, !canGoPrev && styles.monthSwitchBtnDisabled]}
            onPress={goPrevMonth}
            disabled={!canGoPrev}
          >
            <Text style={styles.monthSwitchBtnText}>{t("calcPrevMonth")}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {t("calcMonth")} {selectedSchedule.month}
          </Text>
          <TouchableOpacity
            style={[styles.monthSwitchBtn, !canGoNext && styles.monthSwitchBtnDisabled]}
            onPress={goNextMonth}
            disabled={!canGoNext}
          >
            <Text style={styles.monthSwitchBtnText}>{t("calcNextMonth")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {foods.length === 0 ? (
        <View style={g.emptyBox}>
          <Text style={g.emptyText}>{t("calcEmpty")}</Text>
        </View>
      ) : (
        foods.map((item) => {
          const raw = packageSizes[item.food] ?? "";
          const pkg = parseInt(raw, 10);
          const validPkg = !isNaN(pkg) && pkg > 0;
          const needed = validPkg
            ? Math.ceil(item.totalGrams / pkg)
            : undefined;

          return (
            <View key={item.food} style={styles.card}>
              <Text style={styles.foodName}>{item.food}</Text>
              <Text style={styles.foodType}>{item.foodType}</Text>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("calcNeeded")}:</Text>
                <Text style={styles.totalValue}>
                  {item.totalGrams}
                  {t("calcGrams")}
                </Text>
              </View>

              {!hideSubstitutions && item.substitutions.length > 0 && (
                <View style={styles.subsSection}>
                  <Text style={styles.subsLabel}>
                    {t("calcAlternatives")}:
                  </Text>
                  <View style={styles.chipsRow}>
                    {item.substitutions.map((sub, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{sub}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>
                  {t("calcPackageSize")}:
                </Text>
                <TextInput
                  style={[g.input, styles.sizeInput]}
                  value={raw}
                  onChangeText={(v) => setSize(item.food, v)}
                  keyboardType="numeric"
                  placeholder={t("calcGrams")}
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              {needed !== undefined && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>
                    {t("calcPackagesNeeded")}:
                  </Text>
                  <Text style={styles.resultValue}>{needed}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
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
  pastelGreen: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        monthSwitcher: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 12,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusMd,
          padding: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        monthSwitchBtn: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: spacing.radiusChip,
          backgroundColor: colors.chipBg,
        },
        monthSwitchBtnDisabled: {
          opacity: 0.5,
        },
        monthSwitchBtnText: {
          fontSize: 13,
          color: colors.text,
          fontFamily: fonts.medium,
        },
        monthLabel: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.semiBold,
        },
        card: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 12,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 16,
        },
        foodName: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.text,
          fontFamily: fonts.bold,
          textTransform: "capitalize",
        },
        foodType: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginBottom: 10,
        },
        totalRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        },
        totalLabel: {
          fontSize: 14,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginRight: 6,
        },
        totalValue: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.primary,
          fontFamily: fonts.semiBold,
        },
        subsSection: {
          marginBottom: 10,
        },
        subsLabel: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginBottom: 4,
        },
        chipsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        },
        chip: {
          backgroundColor: colors.chipBg,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: spacing.radiusChip,
        },
        chipText: {
          fontSize: 13,
          color: colors.text,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        inputRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 6,
        },
        inputLabel: {
          fontSize: 14,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginRight: 8,
        },
        sizeInput: {
          flex: 1,
          paddingVertical: 8,
        },
        resultRow: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.pastelGreen,
          borderRadius: spacing.radiusMd,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginTop: 4,
        },
        resultLabel: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.medium,
          marginRight: 6,
        },
        resultValue: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.text,
          fontFamily: fonts.bold,
        },
      }),
    [colors],
  );
}
