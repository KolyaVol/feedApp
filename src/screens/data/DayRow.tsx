import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import type { FeedDay, MealType } from "../../types";
import {
  GramSuggestionChips,
  ProductSuggestionChips,
} from "../../components/SuggestionChips";
import {
  getGramSuggestions as computeGramSuggestions,
  rankProductSuggestions,
} from "../../utils/mealSuggestions";
import type { DataScreenStyles } from "./styles";

const MEAL_TYPES: MealType[] = ["morning", "lunch", "evening"];

type MealsState = Pick<FeedDay, "morning" | "lunch" | "evening">;

function cloneMeals(day: FeedDay): MealsState {
  return {
    morning: day.morning.map((e) => ({ ...e })),
    lunch: day.lunch.map((e) => ({ ...e })),
    evening: day.evening.map((e) => ({ ...e })),
  };
}

export interface DayRowColors {
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  chipSelectedBg: string;
  card: string;
  border: string;
  borderLight: string;
  danger: string;
  placeholder: string;
}

export interface DayRowProps {
  day: FeedDay;
  isToday: boolean;
  styles: DataScreenStyles;
  colors: DayRowColors;
  t: (key: string) => string;
  dateDraft: string | undefined;
  onDateFocus: (day: FeedDay) => void;
  onDateChange: (dayId: string, value: string) => void;
  onDateBlur: (day: FeedDay) => void;
  onOpenActions: (dayId: string) => void;
  onCommitNotes: (dayId: string, notes: string) => void;
  onOpenAddProduct: (dayId: string, mealType: MealType) => void;
  onCommitMealEntry: (
    dayId: string,
    mealType: MealType,
    idx: number,
    field: "product" | "grams",
    value: string,
  ) => void;
  onRemoveMealEntry: (dayId: string, mealType: MealType, idx: number) => void;
  recentProducts: string[];
  recentGrams: number[];
  mealLabel: (type: MealType) => string;
}

function DayRowComponent({
  day,
  isToday,
  styles: s,
  colors,
  t,
  dateDraft,
  onDateFocus,
  onDateChange,
  onDateBlur,
  onOpenActions,
  onCommitNotes,
  onOpenAddProduct,
  onCommitMealEntry,
  onRemoveMealEntry,
  recentProducts,
  recentGrams,
  mealLabel,
}: DayRowProps) {
  const [meals, setMeals] = useState<MealsState>(() => cloneMeals(day));
  const [notes, setNotes] = useState(day.notes ?? "");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const mealsRef = useRef(meals);
  mealsRef.current = meals;
  const productChipTapRef = useRef(false);
  const gramChipTapRef = useRef(false);
  const productBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gramBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (productBlurTimer.current) clearTimeout(productBlurTimer.current);
      if (gramBlurTimer.current) clearTimeout(gramBlurTimer.current);
    };
  }, []);

  useEffect(() => {
    setMeals(cloneMeals(day));
    setNotes(day.notes ?? "");
  }, [day]);

  const recentTopGrams = recentGrams[0] ?? 0;

  const getProductSuggestions = useCallback(
    (value: string) =>
      rankProductSuggestions(value, recentProducts, "emptyReturnsAll"),
    [recentProducts],
  );

  const getGramSuggestions = useCallback(
    (raw: string, fallback: number) =>
      computeGramSuggestions(raw, fallback, recentGrams),
    [recentGrams],
  );

  const updateMealField = useCallback(
    (mealType: MealType, idx: number, field: "product" | "grams", value: string) => {
      setMeals((prev) => {
        const list = [...prev[mealType]];
        const entry = list[idx];
        if (!entry) return prev;
        if (field === "product") {
          list[idx] = { ...entry, product: value };
        } else {
          const n = parseInt(value, 10);
          list[idx] = { ...entry, grams: isNaN(n) ? 0 : n };
        }
        const next = { ...prev, [mealType]: list };
        mealsRef.current = next;
        return next;
      });
    },
    [],
  );

  const commitMealField = useCallback(
    (mealType: MealType, idx: number, field: "product" | "grams") => {
      const local = mealsRef.current[mealType][idx];
      const committed = day[mealType][idx];
      if (!local || !committed) return;
      if (field === "product") {
        if (local.product !== committed.product) {
          onCommitMealEntry(day.id, mealType, idx, "product", local.product);
        }
      } else {
        const localGrams = local.grams > 0 ? String(local.grams) : "";
        const committedGrams = committed.grams > 0 ? String(committed.grams) : "";
        if (localGrams !== committedGrams) {
          onCommitMealEntry(day.id, mealType, idx, "grams", localGrams);
        }
      }
    },
    [day, onCommitMealEntry],
  );

  const handleProductBlur = useCallback(
    (mealType: MealType, idx: number, fieldKey: string) => {
      if (productBlurTimer.current) clearTimeout(productBlurTimer.current);
      productBlurTimer.current = setTimeout(() => {
        productBlurTimer.current = null;
        if (productChipTapRef.current) {
          productChipTapRef.current = false;
          return;
        }
        setFocusedField((current) => (current === fieldKey ? null : current));
        commitMealField(mealType, idx, "product");
      }, 200);
    },
    [commitMealField],
  );

  const handleGramsBlur = useCallback(
    (mealType: MealType, idx: number, fieldKey: string) => {
      if (gramBlurTimer.current) clearTimeout(gramBlurTimer.current);
      gramBlurTimer.current = setTimeout(() => {
        gramBlurTimer.current = null;
        if (gramChipTapRef.current) {
          gramChipTapRef.current = false;
          return;
        }
        setFocusedField((current) => (current === fieldKey ? null : current));
        commitMealField(mealType, idx, "grams");
      }, 200);
    },
    [commitMealField],
  );

  const handleNotesBlur = useCallback(() => {
    const committed = day.notes ?? "";
    if (notes !== committed) onCommitNotes(day.id, notes);
  }, [day.id, day.notes, notes, onCommitNotes]);

  const applyProductSuggestion = useCallback(
    (mealType: MealType, idx: number, suggestion: string) => {
      productChipTapRef.current = true;
      if (productBlurTimer.current) {
        clearTimeout(productBlurTimer.current);
        productBlurTimer.current = null;
      }
      const prev = mealsRef.current;
      const list = [...prev[mealType]];
      const entry = list[idx];
      if (!entry) return;
      list[idx] = { ...entry, product: suggestion };
      const next = { ...prev, [mealType]: list };
      mealsRef.current = next;
      setMeals(next);
      onCommitMealEntry(day.id, mealType, idx, "product", suggestion);
      setFocusedField(null);
    },
    [day.id, onCommitMealEntry],
  );

  const applyGramSuggestion = useCallback(
    (mealType: MealType, idx: number, gram: number) => {
      gramChipTapRef.current = true;
      if (gramBlurTimer.current) {
        clearTimeout(gramBlurTimer.current);
        gramBlurTimer.current = null;
      }
      const prev = mealsRef.current;
      const list = [...prev[mealType]];
      const entry = list[idx];
      if (!entry) return;
      list[idx] = { ...entry, grams: gram };
      const next = { ...prev, [mealType]: list };
      mealsRef.current = next;
      setMeals(next);
      onCommitMealEntry(day.id, mealType, idx, "grams", String(gram));
      setFocusedField(null);
    },
    [day.id, onCommitMealEntry],
  );

  const cardInputBorderColor = isToday ? colors.border : colors.borderLight;

  return (
    <View
      style={[
        s.dayCard,
        { backgroundColor: colors.card, borderColor: colors.borderLight },
        isToday && { backgroundColor: colors.chipSelectedBg },
      ]}
    >
      <View style={s.dateRow}>
        <TextInput
          style={[s.cellInput, s.cellDate, { color: colors.text, borderColor: cardInputBorderColor }]}
          value={dateDraft ?? day.date}
          onFocus={() => onDateFocus(day)}
          onChangeText={(v) => onDateChange(day.id, v)}
          onBlur={() => onDateBlur(day)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholder}
          maxLength={10}
        />
        <TouchableOpacity
          style={[s.rowActionsBtn, { backgroundColor: colors.chipBg, borderColor: cardInputBorderColor }]}
          onPress={() => onOpenActions(day.id)}
        >
          <Text style={[s.rowActionsIcon, { color: colors.text }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {MEAL_TYPES.map((type) => {
        const entries = meals[type];
        if (entries.length === 0) return null;
        return (
          <View key={type} style={s.mealSection}>
            <Text style={[s.mealTitle, { color: colors.textMuted }]}>{mealLabel(type)}</Text>
            {entries.map((entry, idx) => {
              const productKey = `${day.id}:${type}:${idx}:product`;
              const gramsKey = `${day.id}:${type}:${idx}:grams`;
              return (
                <View key={idx} style={s.mealEntryBlock}>
                  <View style={s.mealEntryRow}>
                    <TextInput
                      style={[s.cellInput, s.cellProduct, { color: colors.text, borderColor: cardInputBorderColor }]}
                      value={entry.product}
                      onChangeText={(v) => updateMealField(type, idx, "product", v)}
                      onFocus={() => setFocusedField(productKey)}
                      onBlur={() => handleProductBlur(type, idx, productKey)}
                      onSubmitEditing={() => handleProductBlur(type, idx, productKey)}
                      placeholder={t("product")}
                      placeholderTextColor={colors.placeholder}
                    />
                    <TextInput
                      style={[
                        s.cellInput,
                        s.cardGramsInput,
                        { color: colors.text, borderColor: cardInputBorderColor },
                        (isNaN(entry.grams) || entry.grams < 0) && { borderColor: colors.danger },
                      ]}
                      value={entry.grams > 0 ? String(entry.grams) : ""}
                      onChangeText={(v) => updateMealField(type, idx, "grams", v)}
                      onFocus={() => setFocusedField(gramsKey)}
                      onBlur={() => handleGramsBlur(type, idx, gramsKey)}
                      onSubmitEditing={() => handleGramsBlur(type, idx, gramsKey)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TouchableOpacity
                      style={s.removeEntryBtn}
                      onPress={() => onRemoveMealEntry(day.id, type, idx)}
                    >
                      <Text style={[s.removeEntryText, { color: colors.danger }]}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {focusedField === productKey && (
                    <ProductSuggestionChips
                      suggestions={getProductSuggestions(entry.product)}
                      onPressIn={() => {
                        productChipTapRef.current = true;
                      }}
                      onSelect={(suggestion) => applyProductSuggestion(type, idx, suggestion)}
                    />
                  )}
                  {focusedField === gramsKey && (
                    <GramSuggestionChips
                      suggestions={getGramSuggestions(
                        entry.grams > 0 ? String(entry.grams) : "",
                        recentTopGrams,
                      )}
                      keyPrefix={`${gramsKey}:`}
                      onPressIn={() => {
                        gramChipTapRef.current = true;
                      }}
                      onSelect={(gram) => applyGramSuggestion(type, idx, gram)}
                    />
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={s.addMoreBtn} onPress={() => onOpenAddProduct(day.id, type)}>
              <Text style={[s.addMoreText, { color: colors.primary }]}>+ {t("add")}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TextInput
        style={[s.cellInput, s.cellNotes, { color: colors.text, borderColor: cardInputBorderColor }]}
        value={notes}
        onChangeText={setNotes}
        onBlur={handleNotesBlur}
        placeholder={t("notes")}
        placeholderTextColor={colors.placeholder}
        multiline
      />
    </View>
  );
}

function propsAreEqual(prev: DayRowProps, next: DayRowProps): boolean {
  return (
    prev.day === next.day &&
    prev.isToday === next.isToday &&
    prev.dateDraft === next.dateDraft &&
    prev.recentProducts === next.recentProducts &&
    prev.recentGrams === next.recentGrams &&
    prev.styles === next.styles &&
    prev.colors === next.colors
  );
}

export const DayRow = React.memo(DayRowComponent, propsAreEqual);
