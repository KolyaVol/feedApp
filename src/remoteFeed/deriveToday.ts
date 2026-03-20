import type { PlanDay } from "../types";
import type { RemoteFeedMeal, RemoteFeedPlanDay, RemoteFeedSchedule, RemoteFeedToday } from "./types";

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
  const intro = Array.isArray(schedule.introduction_plan) ? schedule.introduction_plan : [];
  return intro.flatMap((w) =>
    w.days.map((d) => ({
      week: w.week,
      day: d.day,
      notes: d.notes,
      morning: d.morning,
      lunch: d.lunch,
      evening: d.evening,
    })),
  );
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function pickDailyAdvice(schedule: RemoteFeedSchedule, date: string): string[] {
  const pool = [
    ...(schedule.breastfeeding?.rules ?? []),
    ...(schedule.feeding_schedule?.meal_slots?.flatMap((s) => s.rules ?? []) ?? []),
    ...(schedule.hidden_risks ?? []),
  ].filter(Boolean);
  if (!pool.length) return [];
  const unique = [...new Set(pool)];
  const seed = hashSeed(`${schedule.month}-${date}`);
  const first = seed % unique.length;
  const second = (seed * 7 + 3) % unique.length;
  if (unique.length === 1) return [unique[first]];
  return first === second ? [unique[first]] : [unique[first], unique[second]];
}

function slotByType(schedule: RemoteFeedSchedule, type: "morning" | "lunch" | "evening") {
  return schedule.feeding_schedule?.meal_slots?.find((s) => s.name === type);
}

function toMeal(
  schedule: RemoteFeedSchedule,
  type: "morning" | "lunch" | "evening",
  day: RemoteFeedPlanDay,
): RemoteFeedMeal | null {
  const slot = slotByType(schedule, type);
  if (type === "morning" && day.morning) {
    return {
      type,
      title: type,
      time: slot?.time,
      items: [day.morning],
      rules: slot?.rules ?? [],
      notes: day.notes,
    };
  }
  if (type === "lunch" && day.lunch?.length) {
    return {
      type,
      title: type,
      time: slot?.time,
      items: day.lunch,
      rules: slot?.rules ?? [],
      notes: day.notes,
    };
  }
  if (type === "evening" && day.evening?.length) {
    return {
      type,
      title: type,
      time: slot?.time,
      items: day.evening,
      rules: slot?.rules ?? [],
      notes: day.notes,
    };
  }
  return null;
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
  const dayData: RemoteFeedPlanDay = {
    day: d.day,
    notes: d.notes,
    morning: d.morning,
    lunch: d.lunch,
    evening: d.evening,
  };
  const meals = [
    toMeal(schedule, "morning", dayData),
    toMeal(schedule, "lunch", dayData),
    toMeal(schedule, "evening", dayData),
  ].filter(Boolean) as RemoteFeedMeal[];
  return {
    date,
    week: d.week,
    day: d.day,
    meals,
    advice: pickDailyAdvice(schedule, date),
  };
}

export function remoteScheduleToPlanDays(
  schedule: RemoteFeedSchedule,
  startDate: string,
): PlanDay[] {
  const result: PlanDay[] = [];
  let dayIndex = 0;
  const intro = Array.isArray(schedule.introduction_plan) ? schedule.introduction_plan : [];
  for (const w of intro) {
    for (const d of w.days) {
      const date = addDays(startDate, dayIndex);
      const primary = d.morning ?? d.lunch?.[0] ?? d.evening?.[0];
      result.push({
        id: `remote-${dayIndex}`,
        date,
        time: slotByType(schedule, "morning")?.time ?? "09:00",
        foodType: "meal-plan",
        food: primary?.product ?? "",
        amountGrams: primary?.amount_grams ?? 0,
        substitutions: [],
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


