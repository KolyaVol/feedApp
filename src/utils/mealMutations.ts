import type { FeedDay, MealEntry, MealType } from "../types";

export type MealField = "product" | "grams";

export function setMealEntryField(
  day: FeedDay,
  mealType: MealType,
  entryIdx: number,
  field: MealField,
  value: string,
): Partial<FeedDay> | null {
  const meals = [...day[mealType]];
  const entry = meals[entryIdx];
  if (!entry) return null;
  if (field === "product") {
    meals[entryIdx] = { ...entry, product: value };
  } else {
    const n = parseInt(value, 10);
    meals[entryIdx] = { ...entry, grams: isNaN(n) ? 0 : n };
  }
  return { [mealType]: meals } as Partial<FeedDay>;
}

export function removeMealEntryAt(
  day: FeedDay,
  mealType: MealType,
  entryIdx: number,
): Partial<FeedDay> {
  const meals = day[mealType].filter((_, i) => i !== entryIdx);
  return { [mealType]: meals } as Partial<FeedDay>;
}

export function appendMealEntry(
  day: FeedDay,
  mealType: MealType,
  entry: MealEntry,
): Partial<FeedDay> {
  const meals = [...day[mealType], entry];
  return { [mealType]: meals } as Partial<FeedDay>;
}
