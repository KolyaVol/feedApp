import type { LoadedSchedule } from "../types";
import * as api from "../api/loadedSchedules";

export async function getLoadedSchedules(): Promise<LoadedSchedule[]> {
  return api.getLoadedSchedules();
}

export async function setLoadedSchedules(_items: LoadedSchedule[]): Promise<void> {
  // Cloud sync: full replace not supported
}

export async function addLoadedSchedule(schedule: LoadedSchedule): Promise<void> {
  await api.addLoadedSchedule(schedule);
}

export async function deleteLoadedSchedule(id: string): Promise<void> {
  await api.deleteLoadedSchedule(id);
}
