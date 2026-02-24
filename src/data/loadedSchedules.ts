import type { LoadedSchedule } from "../types";
import { KEYS } from "./storageKeys";
import { createStorageList } from "./storage";

export const schedulesStorage = createStorageList<LoadedSchedule>(
  KEYS.LOADED_SCHEDULES,
);

export const getLoadedSchedules = schedulesStorage.getList;
export const setLoadedSchedules = schedulesStorage.setList;

export async function addLoadedSchedule(
  schedule: LoadedSchedule,
): Promise<void> {
  const existing = await getLoadedSchedules();
  await setLoadedSchedules([...existing, schedule]);
}

export async function deleteLoadedSchedule(id: string): Promise<void> {
  return schedulesStorage.deleteItem(id);
}
