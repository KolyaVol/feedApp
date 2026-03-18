import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "../data/storageKeys";
import type { RemoteFeedSchedule } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isSchedule(v: unknown): v is RemoteFeedSchedule {
  if (!isRecord(v)) return false;
  return typeof v.month === "number" && Array.isArray(v.weekly_schedule);
}

export async function saveCachedJson(data: RemoteFeedSchedule): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.REMOTE_FEED_CACHE, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function loadCachedJson(): Promise<RemoteFeedSchedule | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.REMOTE_FEED_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSchedule(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function loadStartDate(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.REMOTE_FEED_START_DATE);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  } catch {
    // ignore
  }
  const today = formatDateStr(new Date());
  try {
    await AsyncStorage.setItem(KEYS.REMOTE_FEED_START_DATE, today);
  } catch {
    // ignore
  }
  return today;
}

export async function setStartDate(dateStr: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  try {
    await AsyncStorage.setItem(KEYS.REMOTE_FEED_START_DATE, dateStr);
  } catch {
    // ignore
  }
}

