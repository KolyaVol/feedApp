import type { FeedEntry } from "../types";
import { KEYS } from "./storageKeys";
import { createStorageList } from "./storage";
import { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth } from "../utils/date";

export const entriesStorage = createStorageList<FeedEntry>(KEYS.ENTRIES);

export const getEntries = entriesStorage.getList;
export const setEntries = entriesStorage.setList;

export async function addEntry(entry: Omit<FeedEntry, "id">): Promise<FeedEntry> {
  return entriesStorage.addItem(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  return entriesStorage.deleteItem(id);
}

export function getEntriesInRange(
  entries: FeedEntry[],
  startMs: number,
  endMs: number,
): FeedEntry[] {
  return entries.filter((e) => e.timestamp >= startMs && e.timestamp <= endMs);
}

export { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth };
