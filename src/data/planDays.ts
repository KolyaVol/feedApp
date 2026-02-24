import type { PlanDay } from "../types";
import { KEYS } from "./storageKeys";
import { createStorageList } from "./storage";

export const planDaysStorage = createStorageList<PlanDay>(KEYS.PLAN_DAYS);

export const getPlanDays = planDaysStorage.getList;
export const setPlanDays = planDaysStorage.setList;

export async function addPlanDays(days: PlanDay[]): Promise<void> {
  const existing = await getPlanDays();
  await setPlanDays([...existing, ...days]);
}

export async function updatePlanDay(
  id: string,
  updates: Partial<PlanDay>,
): Promise<void> {
  return planDaysStorage.updateItem(id, updates);
}

export async function deletePlanDaysBySchedule(
  scheduleId: string,
): Promise<void> {
  const all = await getPlanDays();
  await setPlanDays(all.filter((d) => d.scheduleId !== scheduleId));
}

export function getPlanDayForDate(
  days: PlanDay[],
  dateStr: string,
): PlanDay | undefined {
  return days.find((d) => d.date === dateStr);
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + count);
  return formatDateStr(d);
}
