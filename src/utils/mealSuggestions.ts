import type { FeedDay, MealType } from "../types";
import { levenshtein } from "./stringSimilarity";

const MEAL_TYPES: MealType[] = ["morning", "lunch", "evening"];

export function collectRecentProducts(days: FeedDay[]): string[] {
  const unique = new Set<string>();
  const list: string[] = [];
  for (let d = days.length - 1; d >= 0; d -= 1) {
    const day = days[d]!;
    for (const mealType of MEAL_TYPES) {
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
}

export function collectRecentGrams(days: FeedDay[]): number[] {
  const unique = new Set<number>();
  const list: number[] = [];
  for (let d = days.length - 1; d >= 0; d -= 1) {
    const day = days[d]!;
    for (const mealType of MEAL_TYPES) {
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
}

export type ProductSuggestionMode = "emptyReturnsAll" | "emptyReturnsNone";

const PRODUCT_SUGGESTION_LIMIT = 7;

export function rankProductSuggestions(
  query: string,
  recentProducts: string[],
  mode: ProductSuggestionMode = "emptyReturnsAll",
): string[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) {
    return mode === "emptyReturnsAll"
      ? recentProducts.slice(0, PRODUCT_SUGGESTION_LIMIT)
      : [];
  }
  return recentProducts
    .map((product) => {
      const normalized = product.toLocaleLowerCase();
      if (normalized === q) return null;
      const idx = normalized.indexOf(q);
      const starts = idx === 0 ? 1 : 0;
      const includes = idx >= 0 ? 1 : 0;
      const distance = levenshtein(q, normalized);
      const lengthDelta = Math.abs(normalized.length - q.length);
      return {
        product,
        idx: idx >= 0 ? idx : 999,
        starts,
        includes,
        distance,
        lengthDelta,
      };
    })
    .filter(
      (item): item is {
        product: string;
        idx: number;
        starts: number;
        includes: number;
        distance: number;
        lengthDelta: number;
      } => !!item,
    )
    .sort((a, b) => {
      if (b.starts !== a.starts) return b.starts - a.starts;
      if (b.includes !== a.includes) return b.includes - a.includes;
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.lengthDelta - b.lengthDelta;
    })
    .map((item) => item.product)
    .slice(0, PRODUCT_SUGGESTION_LIMIT);
}

const GRAM_SUGGESTION_LIMIT = 6;

export function getGramSuggestions(
  raw: string,
  fallback: number,
  recentGrams: number[],
): number[] {
  const parsed = parseInt(raw, 10);
  const base =
    !isNaN(parsed) && parsed > 0
      ? parsed
      : fallback > 0
        ? fallback
        : recentGrams[0] ?? 50;
  const around = [base + 10, base + 5, base - 5, base - 10].filter((v) => v > 0);
  const merged = [...around, ...recentGrams];
  return Array.from(new Set(merged)).slice(0, GRAM_SUGGESTION_LIMIT);
}
