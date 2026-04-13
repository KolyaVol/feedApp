import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedDay } from "../types";
import { KEYS } from "./storageKeys";
import { generateId } from "../utils/id";

export async function getFeedDays(): Promise<FeedDay[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FEED_DAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFeedDay);
  } catch {
    return [];
  }
}

export async function setFeedDays(days: FeedDay[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.FEED_DAYS, JSON.stringify(days));
}

export async function addFeedDay(day: Omit<FeedDay, "id">): Promise<FeedDay> {
  const list = await getFeedDays();
  const newDay: FeedDay = { ...day, id: generateId() };
  list.push(newDay);
  await setFeedDays(list);
  return newDay;
}

export async function updateFeedDay(
  id: string,
  updates: Partial<FeedDay>,
): Promise<void> {
  const list = await getFeedDays();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx]!, ...updates, id };
  await setFeedDays(list);
}

export async function deleteFeedDay(id: string): Promise<void> {
  const list = await getFeedDays();
  await setFeedDays(list.filter((d) => d.id !== id));
}

export async function moveFeedDay(
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  const list = await getFeedDays();
  if (fromIndex < 0 || fromIndex >= list.length) return;
  if (toIndex < 0 || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  if (!item) return;
  list.splice(toIndex, 0, item);
  await setFeedDays(list);
}

export function createEmptyFeedDay(date: string): Omit<FeedDay, "id"> {
  return {
    date,
    morning: [],
    lunch: [],
    evening: [],
    notes: "",
  };
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDate(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + count);
  return formatDateStr(d);
}

function isValidFeedDay(v: unknown): v is FeedDay {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.date === "string" &&
    Array.isArray(obj.morning) &&
    Array.isArray(obj.lunch) &&
    Array.isArray(obj.evening)
  );
}
