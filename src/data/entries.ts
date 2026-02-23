import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedEntry } from "../types";
import { KEYS } from "./storageKeys";

export async function getEntries(): Promise<FeedEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.ENTRIES);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setEntries(entries: FeedEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(entries));
}

export async function addEntry(entry: Omit<FeedEntry, "id">): Promise<FeedEntry> {
  const list = await getEntries();
  const newEntry: FeedEntry = { ...entry, id: String(Date.now()) };
  list.push(newEntry);
  await setEntries(list);
  return newEntry;
}

export async function deleteEntry(id: string): Promise<void> {
  const list = await getEntries().then((arr) => arr.filter((e) => e.id !== id));
  await setEntries(list);
}

export function getEntriesInRange(
  entries: FeedEntry[],
  startMs: number,
  endMs: number,
): FeedEntry[] {
  return entries.filter((e) => e.timestamp >= startMs && e.timestamp <= endMs);
}

export function getStartOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getEndOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function getStartOfWeek(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getEndOfWeek(date: Date): number {
  const start = getStartOfWeek(date);
  return start + 7 * 24 * 60 * 60 * 1000 - 1;
}

export function getStartOfMonth(date: Date): number {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getEndOfMonth(date: Date): number {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
