import type { PlanDay } from "../types";
import type { RemoteFeedSchedule, RemoteFeedToday } from "./types";

const REMOTE_SCHEDULE_ID = "remote";

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromDateStr: string, to: Date): number {
  const from = new Date(fromDateStr + "T00:00:00");
  const toMid = new Date(formatDateStr(to) + "T00:00:00");
  const ms = toMid.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function addDays(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + count);
  return formatDateStr(d);
}

export function flattenScheduleDays(schedule: RemoteFeedSchedule) {
  return schedule.weekly_schedule.flatMap((w) => w.days);
}

export function getTodayFromSchedule(
  schedule: RemoteFeedSchedule,
  startDate: string,
  now: Date = new Date(),
): RemoteFeedToday | null {
  const days = flattenScheduleDays(schedule);
  if (!days.length) return null;

  let idx = daysBetween(startDate, now);
  if (!Number.isFinite(idx)) idx = 0;
  if (idx < 0) idx = 0;
  if (idx >= days.length) idx = days.length - 1;

  const date = addDays(startDate, idx);
  const d = days[idx];
  return {
    date,
    meals: [
      {
        time: d.time,
        food: d.food,
        notes: d.notes,
        foodType: d.food_type,
        amountGrams: d.amount_grams,
      },
    ],
  };
}

export function remoteScheduleToPlanDays(
  schedule: RemoteFeedSchedule,
  startDate: string,
): PlanDay[] {
  const result: PlanDay[] = [];
  let dayIndex = 0;
  for (const w of schedule.weekly_schedule) {
    for (const d of w.days) {
      const date = addDays(startDate, dayIndex);
      result.push({
        id: `remote-${dayIndex}`,
        date,
        time: d.time,
        foodType: d.food_type,
        food: d.food,
        amountGrams: d.amount_grams,
        substitutions: d.substitutions ?? [],
        notes: d.notes,
        sourceMonth: schedule.month,
        weekNumber: w.week,
        scheduleId: REMOTE_SCHEDULE_ID,
      });
      dayIndex++;
    }
  }
  return result;
}


