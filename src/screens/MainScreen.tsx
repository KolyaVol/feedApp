import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
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
import { pushFeedDays } from "../remoteFeed/sync";
import { getGithubToken } from "../data/settings";

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

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { days, loading, refresh, toggleEaten, updateDay } = useFeedDays();
  const bestPractices = useBestPractices();

  const [viewDate, setViewDate] = useState(() => formatDateStr(new Date()));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [syncing, setSyncing] = useState(false);
  const autoPushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productSuggestionTapRef = useRef(false);
  const gramSuggestionTapRef = useRef(false);
  const dirtyForAutoPushRef = useRef(false);
  const initializedRef = useRef(false);
  const lastPushedSnapshotRef = useRef("");
  const latestDaysRef = useRef(days);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const snapshot = useMemo(() => JSON.stringify(days), [days]);

  useEffect(() => {
    latestDaysRef.current = days;
  }, [days]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastPushedSnapshotRef.current = snapshot;
      return;
    }
    dirtyForAutoPushRef.current = snapshot !== lastPushedSnapshotRef.current;
  }, [snapshot]);

  useEffect(() => {
    if (!dirtyForAutoPushRef.current || syncing || loading) return;
    if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    autoPushTimeoutRef.current = setTimeout(async () => {
      if (syncing || !dirtyForAutoPushRef.current) return;
      const token = await getGithubToken();
      if (!token) return;
      setSyncing(true);
      const result = await pushFeedDays(latestDaysRef.current);
      if (result.ok) {
        lastPushedSnapshotRef.current = JSON.stringify(latestDaysRef.current);
        dirtyForAutoPushRef.current = false;
      }
      setSyncing(false);
    }, 4000);

    return () => {
      if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    };
  }, [loading, snapshot, syncing]);

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
  const recentProducts = useMemo(() => {
    const unique = new Set<string>();
    const list: string[] = [];
    for (let d = days.length - 1; d >= 0; d -= 1) {
      const day = days[d];
      for (const mealType of ["morning", "lunch", "evening"] as const) {
        const entries = day[mealType];
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const product = entries[i]?.product?.trim();
          if (!product) continue;
          const key = product.toLocaleLowerCase();
          if (unique.has(key)) continue;
          unique.add(key);
          list.push(product);
        }
      }
    }
    return list;
  }, [days]);
  const recentGrams = useMemo(() => {
    const unique = new Set<number>();
    const list: number[] = [];
    for (let d = days.length - 1; d >= 0; d -= 1) {
      const day = days[d];
      for (const mealType of ["morning", "lunch", "evening"] as const) {
        const entries = day[mealType];
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const grams = entries[i]?.grams;
          if (typeof grams !== "number" || grams <= 0 || unique.has(grams)) continue;
          unique.add(grams);
          list.push(grams);
        }
      }
    }
    return list;
  }, [days]);

  const mealLabel = useCallback(
    (type: MealType) => {
      if (type === "morning") return t("mealMorning");
      if (type === "lunch") return t("mealLunch");
      return t("mealEvening");
    },
    [t],
  );

  const updateMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number, field: "product" | "grams", value: string) => {
      const day = days.find((d) => d.id === dayId);
      if (!day) return;
      const meals = [...day[mealType]];
      const entry = meals[entryIdx];
      if (!entry) return;
      if (field === "product") {
        meals[entryIdx] = { ...entry, product: value };
      } else {
        const n = parseInt(value, 10);
        meals[entryIdx] = { ...entry, grams: isNaN(n) ? 0 : n };
      }
      updateDay(dayId, { [mealType]: meals });
    },
    [days, updateDay],
  );

  const startInlineEdit = useCallback(
    (dayId: string, mealType: MealType, idx: number, field: "product" | "grams", value: string) => {
      setEditingField(`${dayId}:${mealType}:${idx}:${field}`);
      setEditingValue(value);
    },
    [],
  );

  const saveInlineEdit = useCallback(
    (dayId: string, mealType: MealType, idx: number, field: "product" | "grams") => {
      const nextValue = editingValue.trim();
      if (field === "product") {
        if (nextValue) updateMealEntry(dayId, mealType, idx, field, nextValue);
      } else {
        updateMealEntry(dayId, mealType, idx, field, nextValue);
      }
      setEditingField(null);
      setEditingValue("");
    },
    [editingValue, updateMealEntry],
  );
  const applyProductSuggestion = useCallback(
    (dayId: string, mealType: MealType, idx: number, product: string) => {
      updateMealEntry(dayId, mealType, idx, "product", product);
      setEditingField(null);
      setEditingValue("");
    },
    [updateMealEntry],
  );
  const getProductSuggestions = useCallback(
    (value: string) => {
      const q = value.trim().toLocaleLowerCase();
      if (!q) return [];
      return recentProducts
        .map((product) => {
          const normalized = product.toLocaleLowerCase();
          if (normalized === q) return null;
          const idx = normalized.indexOf(q);
          const starts = idx === 0 ? 1 : 0;
          const includes = idx >= 0 ? 1 : 0;
          const distance = levenshtein(q, normalized);
          const lengthDelta = Math.abs(normalized.length - q.length);
          return { product, idx: idx >= 0 ? idx : 999, starts, includes, distance, lengthDelta };
        })
        .filter((item): item is {
          product: string;
          idx: number;
          starts: number;
          includes: number;
          distance: number;
          lengthDelta: number;
        } => !!item)
        .sort((a, b) => {
          if (b.starts !== a.starts) return b.starts - a.starts;
          if (b.includes !== a.includes) return b.includes - a.includes;
          if (a.distance !== b.distance) return a.distance - b.distance;
          if (a.idx !== b.idx) return a.idx - b.idx;
          return a.lengthDelta - b.lengthDelta;
        })
        .map((item) => item.product)
        .slice(0, 7);
    },
    [recentProducts],
  );
  const getGramSuggestions = useCallback(
    (raw: string, fallback: number) => {
      const parsed = parseInt(raw, 10);
      const base = !isNaN(parsed) && parsed > 0 ? parsed : fallback > 0 ? fallback : recentGrams[0] ?? 50;
      const around = [base + 10, base + 5, base - 5, base - 10].filter((v) => v > 0);
      const merged = [...around, ...recentGrams];
      return Array.from(new Set(merged)).slice(0, 6);
    },
    [recentGrams],
  );
  const applyGramSuggestion = useCallback(
    (dayId: string, mealType: MealType, idx: number, grams: number) => {
      updateMealEntry(dayId, mealType, idx, "grams", String(grams));
      setEditingField(null);
      setEditingValue("");
    },
    [updateMealEntry],
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
                    {editingField === `${todayDay.id}:${type}:${idx}:product` ? (
                      <TextInput
                        style={[s.inlineInput, s.mealProductInput, { color: colors.text, borderColor: colors.border }]}
                        value={editingValue}
                        onChangeText={setEditingValue}
                        onBlur={() => {
                          if (productSuggestionTapRef.current) {
                            productSuggestionTapRef.current = false;
                            return;
                          }
                          saveInlineEdit(todayDay.id, type, idx, "product");
                        }}
                        onSubmitEditing={() => saveInlineEdit(todayDay.id, type, idx, "product")}
                        autoFocus
                        returnKeyType="done"
                      />
                    ) : (
                      <TouchableOpacity
                        style={s.productPress}
                        onPress={() => startInlineEdit(todayDay.id, type, idx, "product", entry.product)}
                      >
                        <Text style={[s.mealProduct, { color: colors.text }]}>{entry.product}</Text>
                      </TouchableOpacity>
                    )}
                    {editingField === `${todayDay.id}:${type}:${idx}:grams` ? (
                      <TextInput
                        style={[s.inlineInput, s.gramsInput, { color: colors.text, borderColor: colors.border }]}
                        value={editingValue}
                        onChangeText={(v) => setEditingValue(v.replace(/[^0-9]/g, ""))}
                        onBlur={() => {
                          if (gramSuggestionTapRef.current) {
                            gramSuggestionTapRef.current = false;
                            return;
                          }
                          saveInlineEdit(todayDay.id, type, idx, "grams");
                        }}
                        onSubmitEditing={() => saveInlineEdit(todayDay.id, type, idx, "grams")}
                        autoFocus
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                    ) : (
                      <TouchableOpacity
                        style={[s.gramsBadge, { backgroundColor: colors.chipBg }]}
                        onPress={() =>
                          startInlineEdit(todayDay.id, type, idx, "grams", entry.grams > 0 ? String(entry.grams) : "")
                        }
                      >
                        <Text style={[s.gramsBadgeText, { color: colors.text }]}>
                          {entry.grams}
                          {t("grams")}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {editingField === `${todayDay.id}:${type}:${idx}:product` && (
                      <View style={[s.suggestionsWrap, { backgroundColor: colors.card }]}>
                        {getProductSuggestions(editingValue).map((suggestion) => (
                          <TouchableOpacity
                            key={`${todayDay.id}:${type}:${idx}:${suggestion}`}
                            style={[s.suggestionChip, { backgroundColor: colors.chipBg }]}
                            onPressIn={() => {
                              productSuggestionTapRef.current = true;
                            }}
                            onPress={() => applyProductSuggestion(todayDay.id, type, idx, suggestion)}
                          >
                            <Text style={[s.suggestionChipText, { color: colors.text }]}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {editingField === `${todayDay.id}:${type}:${idx}:grams` && (
                      <View style={s.inlineSuggestionsRow}>
                        {getGramSuggestions(editingValue, recentGrams[0] ?? 0).map((gram) => (
                          <TouchableOpacity
                            key={`${todayDay.id}:${type}:${idx}:gram:${gram}`}
                            style={[s.gramChip, { backgroundColor: colors.chipBg }]}
                            onPressIn={() => {
                              gramSuggestionTapRef.current = true;
                            }}
                            onPress={() => applyGramSuggestion(todayDay.id, type, idx, gram)}
                          >
                            <Text style={[s.gramChipText, { color: colors.text }]}>{gram}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
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
          flexWrap: "wrap",
          gap: 6,
        },
        mealProduct: {
          fontSize: 18,
          fontFamily: fonts.semiBold,
          textTransform: "capitalize",
          flex: 1,
        },
        productPress: {
          flex: 1,
        },
        inlineInput: {
          borderWidth: 1,
          borderRadius: spacing.radiusSm,
          paddingVertical: 6,
          paddingHorizontal: 8,
          fontSize: 16,
          fontFamily: fonts.medium,
        },
        mealProductInput: {
          flex: 1,
        },
        gramsBadge: {
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: spacing.radiusChip,
        },
        gramsInput: {
          width: 94,
          textAlign: "right",
        },
        gramsBadgeText: {
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        suggestionsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          borderRadius: spacing.radiusSm,
          padding: 4,
          width: "100%",
          marginTop: 4,
          maxHeight: 84,
          overflow: "hidden",
        },
        suggestionChip: {
          borderRadius: spacing.radiusSm,
          paddingHorizontal: 8,
          paddingVertical: 5,
        },
        suggestionChipText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        inlineSuggestionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 2,
          marginBottom: 4,
          width: "100%",
        },
        gramChip: {
          borderRadius: spacing.radiusSm,
          paddingHorizontal: 8,
          paddingVertical: 5,
        },
        gramChipText: {
          fontSize: 12,
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
