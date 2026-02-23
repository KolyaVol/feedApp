import type { FeedEntry, FoodType, Reminder } from "../types";
import { getEntries } from "./entries";
import { getFoodTypes } from "./foodTypes";
import { getReminders } from "./reminders";
import { setEntries } from "./entries";
import { setFoodTypes } from "./foodTypes";
import { setReminders } from "./reminders";

const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: number;
  foodTypes: FoodType[];
  entries: FeedEntry[];
  reminders: Reminder[];
}

function isFoodType(x: unknown): x is FoodType {
  return (
    typeof x === "object" && x !== null && "id" in x && "name" in x && "unit" in x && "color" in x
  );
}

function isFeedEntry(x: unknown): x is FeedEntry {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "foodTypeId" in x &&
    "amount" in x &&
    "timestamp" in x
  );
}

function isReminder(x: unknown): x is Reminder {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "title" in x &&
    "time" in x &&
    "enabled" in x
  );
}

export async function getExportPayload(): Promise<BackupPayload> {
  const [foodTypes, entries, reminders] = await Promise.all([
    getFoodTypes(),
    getEntries(),
    getReminders(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    foodTypes,
    entries,
    reminders,
  };
}

export function exportToJson(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

export type BackupErrorKey = "backupInvalidJson" | "backupInvalidBackupFormat" | "backupNoData";
export type ImportResult = { ok: true } | { ok: false; error: BackupErrorKey };

export async function importFromJson(json: string): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "backupInvalidJson" };
  }
  if (typeof data !== "object" || data === null || !("version" in data)) {
    return { ok: false, error: "backupInvalidBackupFormat" };
  }
  const raw = data as Record<string, unknown>;
  const foodTypes = Array.isArray(raw.foodTypes) ? raw.foodTypes.filter(isFoodType) : [];
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(isFeedEntry) : [];
  const reminders = Array.isArray(raw.reminders) ? raw.reminders.filter(isReminder) : [];
  if (foodTypes.length === 0 && entries.length === 0 && reminders.length === 0) {
    return { ok: false, error: "backupNoData" };
  }
  await Promise.all([setFoodTypes(foodTypes), setEntries(entries), setReminders(reminders)]);
  return { ok: true };
}
