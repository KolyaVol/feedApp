import type { LoadedSchedule } from "../types";
import { request } from "./client";

export async function getLoadedSchedules(): Promise<LoadedSchedule[]> {
  return request<LoadedSchedule[]>("GET", "/api/loaded-schedules");
}

export async function addLoadedSchedule(schedule: LoadedSchedule): Promise<void> {
  await request("POST", "/api/loaded-schedules", schedule);
}

export async function deleteLoadedSchedule(id: string): Promise<void> {
  await request("DELETE", `/api/loaded-schedules/${encodeURIComponent(id)}`);
}
