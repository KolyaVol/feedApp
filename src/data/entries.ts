import type { FeedEntry } from "../types";
import { generateId } from "../utils/id";
import { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth } from "../utils/date";
import * as api from "../api/entries";

export async function getEntries(): Promise<FeedEntry[]> {
  return api.getEntries();
}

export async function setEntries(_items: FeedEntry[]): Promise<void> {
  // Cloud sync: full replace not supported; use add/update/delete
}

export async function addEntry(entry: Omit<FeedEntry, "id">): Promise<FeedEntry> {
  const id = generateId();
  return api.addEntry({ ...entry, id });
}

export async function updateEntry(id: string, updates: Partial<Omit<FeedEntry, "id">>): Promise<void> {
  await api.updateEntry(id, updates);
}

export async function deleteEntry(id: string): Promise<void> {
  await api.deleteEntry(id);
}

export function getEntriesInRange(
  entries: FeedEntry[],
  startMs: number,
  endMs: number,
): FeedEntry[] {
  return entries.filter((e) => e.timestamp >= startMs && e.timestamp <= endMs);
}

export { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth };
