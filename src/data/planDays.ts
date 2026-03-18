import type { PlanDay } from "../types";
import * as api from "../api/planDays";

export async function getPlanDays(): Promise<PlanDay[]> {
  return api.getPlanDays();
}

export async function setPlanDays(_items: PlanDay[]): Promise<void> {
  // Cloud sync: full replace not supported
}

export async function addPlanDays(days: PlanDay[]): Promise<void> {
  await api.addPlanDays(days);
}

export async function updatePlanDay(id: string, updates: Partial<PlanDay>): Promise<void> {
  await api.updatePlanDay(id, updates);
}

export async function deletePlanDaysBySchedule(scheduleId: string): Promise<void> {
  await api.deletePlanDaysBySchedule(scheduleId);
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
