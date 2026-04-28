import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedDay } from "../types";
import { KEYS } from "./storageKeys";
import { generateId } from "../utils/id";
import { parseFeedDaysLoose } from "./schemas";

export async function getFeedDays(): Promise<FeedDay[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FEED_DAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return parseFeedDaysLoose(parsed);
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

export async function insertFeedDayAt(
  day: Omit<FeedDay, "id">,
  index: number,
): Promise<FeedDay> {
  const list = await getFeedDays();
  const newDay: FeedDay = { ...day, id: generateId() };
  const clamped = Math.max(0, Math.min(index, list.length));
  list.splice(clamped, 0, newDay);
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
    morning: [{ product: "", grams: 0 }],
    lunch: [{ product: "", grams: 0 }],
    evening: [],
    notes: "",
  };
}

export { formatIsoDate as formatDateStr, addDaysIso as addDaysToDate } from "../utils/dates";
