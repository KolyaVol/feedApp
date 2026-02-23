import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Reminder } from "../types";
import { KEYS } from "./storageKeys";

export async function getReminders(): Promise<Reminder[]> {
  const raw = await AsyncStorage.getItem(KEYS.REMINDERS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setReminders(reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
}

export async function addReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  const list = await getReminders();
  const newItem: Reminder = { ...reminder, id: String(Date.now()) };
  list.push(newItem);
  await setReminders(list);
  return newItem;
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<void> {
  const list = await getReminders();
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return;
  list[i] = { ...list[i], ...updates };
  await setReminders(list);
}

export async function deleteReminder(id: string): Promise<void> {
  const list = await getReminders().then((arr) => arr.filter((r) => r.id !== id));
  await setReminders(list);
}
