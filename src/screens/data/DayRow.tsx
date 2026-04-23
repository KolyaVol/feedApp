import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import type { FeedDay, MealType } from "../../types";
import {
  GramSuggestionChips,
  ProductSuggestionChips,
} from "../../components/SuggestionChips";
import type { DataScreenStyles } from "./styles";

const MEAL_TYPES: MealType[] = ["morning", "lunch", "evening"];

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

interface DayRowProps {
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
  onUpdateNotes: (dayId: string, notes: string) => void;
  onOpenAddProduct: (dayId: string, mealType: MealType) => void;
  onUpdateMealEntry: (
    dayId: string,
    mealType: MealType,
    idx: number,
    field: "product" | "grams",
    value: string,
  ) => void;
  onRemoveMealEntry: (dayId: string, mealType: MealType, idx: number) => void;
  onFocusProductField: (key: string | null) => void;
  onFocusGramsField: (key: string | null) => void;
  activeProductField: string | null;
  activeGramsField: string | null;
  productSuggestions: (value: string) => string[];
  gramSuggestions: (raw: string, fallback: number) => number[];
  recentTopGrams: number;
  mealLabel: (type: MealType) => string;
}

export function DayRow({
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
  onUpdateNotes,
  onOpenAddProduct,
  onUpdateMealEntry,
  onRemoveMealEntry,
  onFocusProductField,
  onFocusGramsField,
  activeProductField,
  activeGramsField,
  productSuggestions,
  gramSuggestions,
  recentTopGrams,
  mealLabel,
}: DayRowProps) {
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
        const meals = day[type];
        if (meals.length === 0) return null;
        return (
          <View key={type} style={s.mealSection}>
            <Text style={[s.mealTitle, { color: colors.textMuted }]}>{mealLabel(type)}</Text>
            {meals.map((entry, idx) => {
              const fieldKey = `${day.id}:${type}:${idx}`;
              return (
                <View key={idx} style={s.mealEntryRow}>
                  <TextInput
                    style={[s.cellInput, s.cellProduct, { color: colors.text, borderColor: cardInputBorderColor }]}
                    value={entry.product}
                    onChangeText={(v) => onUpdateMealEntry(day.id, type, idx, "product", v)}
                    onFocus={() => onFocusProductField(fieldKey)}
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
                    onChangeText={(v) => onUpdateMealEntry(day.id, type, idx, "grams", v)}
                    onFocus={() => onFocusGramsField(fieldKey)}
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
                  {activeProductField === fieldKey && (
                    <ProductSuggestionChips
                      suggestions={productSuggestions(entry.product)}
                      onSelect={(suggestion) =>
                        onUpdateMealEntry(day.id, type, idx, "product", suggestion)
                      }
                    />
                  )}
                  {activeGramsField === fieldKey && (
                    <GramSuggestionChips
                      suggestions={gramSuggestions(
                        entry.grams > 0 ? String(entry.grams) : "",
                        recentTopGrams,
                      )}
                      keyPrefix={`${fieldKey}:`}
                      onSelect={(gram) =>
                        onUpdateMealEntry(day.id, type, idx, "grams", String(gram))
                      }
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
        value={day.notes}
        onChangeText={(v) => onUpdateNotes(day.id, v)}
        placeholder={t("notes")}
        placeholderTextColor={colors.placeholder}
        multiline
      />
    </View>
  );
}
