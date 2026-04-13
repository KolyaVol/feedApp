import { useMemo } from "react";
import type { FeedDay, AggregatedFood, MealEntry } from "../types";
import { foodTypePresetColors } from "../theme";

const colorCache: Record<string, string> = {};
let colorIdx = 0;

function colorForProduct(name: string): string {
  const key = name.trim().toLowerCase();
  if (!colorCache[key]) {
    colorCache[key] = foodTypePresetColors[colorIdx % foodTypePresetColors.length]!;
    colorIdx++;
  }
  return colorCache[key]!;
}

function allMeals(day: FeedDay): MealEntry[] {
  return [...day.morning, ...day.lunch, ...day.evening];
}

export interface FeedStatsOptions {
  lastNDays?: number;
  fromDate?: string;
  toDate?: string;
}

export interface FeedStats {
  totalDays: number;
  totalGrams: number;
  uniqueProducts: number;
  chartData: AggregatedFood[];
  perProduct: { product: string; totalGrams: number; days: number; avgPerDay: number }[];
  weeklyBreakdown: { weekLabel: string; totalGrams: number; days: { date: string; product: string; grams: number }[] }[];
}

export function useFeedStats(
  days: FeedDay[],
  options: FeedStatsOptions = {},
): FeedStats {
  return useMemo(() => computeStats(days, options), [days, options.lastNDays, options.fromDate, options.toDate]);
}

export function computeStats(
  days: FeedDay[],
  options: FeedStatsOptions = {},
): FeedStats {
  let filtered = [...days].sort((a, b) => a.date.localeCompare(b.date));

  if (options.lastNDays && options.lastNDays > 0) {
    filtered = filtered.slice(-options.lastNDays);
  }
  if (options.fromDate) {
    filtered = filtered.filter((d) => d.date >= options.fromDate!);
  }
  if (options.toDate) {
    filtered = filtered.filter((d) => d.date <= options.toDate!);
  }

  const productMap = new Map<string, { total: number; daySet: Set<string> }>();
  let totalGrams = 0;

  for (const day of filtered) {
    for (const meal of allMeals(day)) {
      if (!meal.product.trim()) continue;
      const key = meal.product.trim().toLowerCase();
      const entry = productMap.get(key) ?? { total: 0, daySet: new Set<string>() };
      entry.total += meal.grams;
      entry.daySet.add(day.date);
      productMap.set(key, entry);
      totalGrams += meal.grams;
    }
  }

  const chartData: AggregatedFood[] = [...productMap.entries()]
    .map(([key, v]) => ({
      name: key,
      color: colorForProduct(key),
      amount: v.total,
    }))
    .sort((a, b) => b.amount - a.amount);

  const perProduct = [...productMap.entries()]
    .map(([key, v]) => ({
      product: key,
      totalGrams: v.total,
      days: v.daySet.size,
      avgPerDay: v.daySet.size > 0 ? Math.round(v.total / v.daySet.size) : 0,
    }))
    .sort((a, b) => b.totalGrams - a.totalGrams);

  const uniqueProducts = productMap.size;

  const weekMap = new Map<string, { totalGrams: number; days: { date: string; product: string; grams: number }[] }>();
  for (const day of filtered) {
    const d = new Date(day.date + "T00:00:00");
    const weekStart = new Date(d);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    const label = weekStart.toISOString().slice(0, 10);
    const entry = weekMap.get(label) ?? { totalGrams: 0, days: [] };
    for (const meal of allMeals(day)) {
      if (!meal.product.trim()) continue;
      entry.totalGrams += meal.grams;
      entry.days.push({ date: day.date, product: meal.product, grams: meal.grams });
    }
    weekMap.set(label, entry);
  }

  const weeklyBreakdown = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekLabel, v]) => ({
      weekLabel,
      totalGrams: v.totalGrams,
      days: v.days,
    }));

  return {
    totalDays: filtered.length,
    totalGrams,
    uniqueProducts,
    chartData,
    perProduct,
    weeklyBreakdown,
  };
}
