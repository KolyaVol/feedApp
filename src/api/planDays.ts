import type { PlanDay } from "../types";
import { request } from "./client";

export async function getPlanDays(): Promise<PlanDay[]> {
  return request<PlanDay[]>("GET", "/api/plan-days");
}

export async function addPlanDays(days: PlanDay[]): Promise<void> {
  await request("POST", "/api/plan-days", { days });
}

export async function updatePlanDay(id: string, updates: Partial<Omit<PlanDay, "id">>): Promise<void> {
  await request("PATCH", `/api/plan-days/${encodeURIComponent(id)}`, updates);
}

export async function deletePlanDaysBySchedule(scheduleId: string): Promise<void> {
  await request("DELETE", `/api/plan-days?scheduleId=${encodeURIComponent(scheduleId)}`);
}
