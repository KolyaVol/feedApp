import type { Reminder } from "../types";
import { generateId } from "../utils/id";
import * as api from "../api/reminders";

export async function getReminders(): Promise<Reminder[]> {
  return api.getReminders();
}

export async function setReminders(_items: Reminder[]): Promise<void> {
  // Cloud sync: full replace not supported
}

export async function addReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  const id = generateId();
  return api.addReminder({ ...reminder, id });
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<void> {
  await api.updateReminder(id, updates);
}

export async function deleteReminder(id: string): Promise<void> {
  await api.deleteReminder(id);
}
