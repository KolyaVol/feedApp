import { useCallback, useRef, useState } from "react";
import type { MealType } from "../types";
import type { MealField } from "../utils/mealMutations";

export interface UseInlineMealEdit {
  editingField: string | null;
  editingValue: string;
  setEditingValue: (value: string) => void;
  startEdit: (
    dayId: string,
    mealType: MealType,
    entryIdx: number,
    field: MealField,
    value: string,
  ) => void;
  saveEdit: (
    dayId: string,
    mealType: MealType,
    entryIdx: number,
    field: MealField,
    applyChange: (dayId: string, mealType: MealType, entryIdx: number, field: MealField, value: string) => void,
  ) => void;
  cancelEdit: () => void;
  onProductChipPressIn: () => void;
  shouldSkipProductBlur: () => boolean;
  onGramChipPressIn: () => void;
  shouldSkipGramBlur: () => boolean;
  fieldKey: (dayId: string, mealType: MealType, entryIdx: number, field: MealField) => string;
}

export function useInlineMealEdit(): UseInlineMealEdit {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const productSuggestionTapRef = useRef(false);
  const gramSuggestionTapRef = useRef(false);

  const fieldKey = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number, field: MealField) =>
      `${dayId}:${mealType}:${entryIdx}:${field}`,
    [],
  );

  const startEdit = useCallback(
    (
      dayId: string,
      mealType: MealType,
      entryIdx: number,
      field: MealField,
      value: string,
    ) => {
      setEditingField(fieldKey(dayId, mealType, entryIdx, field));
      setEditingValue(value);
    },
    [fieldKey],
  );

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditingValue("");
  }, []);

  const saveEdit = useCallback(
    (
      dayId: string,
      mealType: MealType,
      entryIdx: number,
      field: MealField,
      applyChange: (
        dayId: string,
        mealType: MealType,
        entryIdx: number,
        field: MealField,
        value: string,
      ) => void,
    ) => {
      const nextValue = editingValue.trim();
      if (field === "product") {
        if (nextValue) applyChange(dayId, mealType, entryIdx, field, nextValue);
      } else {
        applyChange(dayId, mealType, entryIdx, field, nextValue);
      }
      setEditingField(null);
      setEditingValue("");
    },
    [editingValue],
  );

  const onProductChipPressIn = useCallback(() => {
    productSuggestionTapRef.current = true;
  }, []);
  const shouldSkipProductBlur = useCallback(() => {
    if (productSuggestionTapRef.current) {
      productSuggestionTapRef.current = false;
      return true;
    }
    return false;
  }, []);
  const onGramChipPressIn = useCallback(() => {
    gramSuggestionTapRef.current = true;
  }, []);
  const shouldSkipGramBlur = useCallback(() => {
    if (gramSuggestionTapRef.current) {
      gramSuggestionTapRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    editingField,
    editingValue,
    setEditingValue,
    startEdit,
    saveEdit,
    cancelEdit,
    onProductChipPressIn,
    shouldSkipProductBlur,
    onGramChipPressIn,
    shouldSkipGramBlur,
    fieldKey,
  };
}
