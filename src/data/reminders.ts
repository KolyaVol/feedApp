import type { Reminder } from "../types";
import { KEYS } from "./storageKeys";
import { createStorageList } from "./storage";

export const remindersStorage = createStorageList<Reminder>(KEYS.REMINDERS);

export const getReminders = remindersStorage.getList;
export const setReminders = remindersStorage.setList;

export async function addReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  return remindersStorage.addItem(reminder);
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<void> {
  return remindersStorage.updateItem(id, updates);
}

export async function deleteReminder(id: string): Promise<void> {
  return remindersStorage.deleteItem(id);
}
