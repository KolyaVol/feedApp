import { useMemo } from "react";
import type { AggregatedFood, FeedEntry, FoodType, StatsPeriod } from "../types";
import {
  getEntriesInRange,
  getEndOfDay,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfDay,
  getStartOfMonth,
  getStartOfWeek,
} from "../data/entries";

export function useStats(
  entries: FeedEntry[],
  foodTypes: FoodType[],
  period: StatsPeriod,
  date: Date,
): AggregatedFood[] {
  return useMemo(() => {
    let start: number;
    let end: number;
    switch (period) {
      case "daily":
        start = getStartOfDay(date);
        end = getEndOfDay(date);
        break;
      case "weekly":
        start = getStartOfWeek(date);
        end = getEndOfWeek(date);
        break;
      case "monthly":
        start = getStartOfMonth(date);
        end = getEndOfMonth(date);
        break;
      default:
        start = getStartOfDay(date);
        end = getEndOfDay(date);
    }
    const inRange = getEntriesInRange(entries, start, end);
    const byType = new Map<string, { amount: number }>();
    for (const e of inRange) {
      const cur = byType.get(e.foodTypeId) ?? { amount: 0 };
      cur.amount += e.amount;
      byType.set(e.foodTypeId, cur);
    }
    const result: AggregatedFood[] = [];
    const typeMap = new Map(foodTypes.map((f) => [f.id, f]));
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
  }, [entries, foodTypes, period, date.getTime()]);
}
