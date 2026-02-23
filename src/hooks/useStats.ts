import { useMemo } from "react";
import type { AggregatedFood, FeedEntry, FoodType, StatsPeriod } from "../types";
import { getEntriesInRange } from "../data/entries";
import {
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
} from "../utils/date";

function getRangeForPeriod(period: StatsPeriod, date: Date): { start: number; end: number } {
  switch (period) {
    case "daily":
      return { start: getStartOfDay(date), end: getEndOfDay(date) };
    case "weekly":
      return { start: getStartOfWeek(date), end: getEndOfWeek(date) };
    case "monthly":
      return { start: getStartOfMonth(date), end: getEndOfMonth(date) };
    default:
      return { start: getStartOfDay(date), end: getEndOfDay(date) };
  }
}

export function aggregateByFoodType(
  entries: FeedEntry[],
  foodTypes: FoodType[],
  period: StatsPeriod,
  date: Date,
): AggregatedFood[] {
  const { start, end } = getRangeForPeriod(period, date);
  const inRange = getEntriesInRange(entries, start, end);
  const byType = new Map<string, { amount: number }>();
  for (const e of inRange) {
    const cur = byType.get(e.foodTypeId) ?? { amount: 0 };
    cur.amount += e.amount;
    byType.set(e.foodTypeId, cur);
  }
  const typeMap = new Map(foodTypes.map((f) => [f.id, f]));
  const result: AggregatedFood[] = [];
  byType.forEach((agg, foodTypeId) => {
    const ft = typeMap.get(foodTypeId);
    if (ft) {
      result.push({
        foodTypeId: ft.id,
        name: ft.name,
        color: ft.color,
        unit: ft.unit,
        amount: agg.amount,
      });
    }
  });
  return result.sort((a, b) => b.amount - a.amount);
}

export function useStats(
  entries: FeedEntry[],
  foodTypes: FoodType[],
  period: StatsPeriod,
  date: Date,
): AggregatedFood[] {
  return useMemo(
    () => aggregateByFoodType(entries, foodTypes, period, date),
    [entries, foodTypes, period, date.getTime()],
  );
}
