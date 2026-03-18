import type { Reminder } from "../types";
import { request } from "./client";

export async function getReminders(): Promise<Reminder[]> {
  return request<Reminder[]>("GET", "/api/reminders");
}

export async function addReminder(reminder: Omit<Reminder, "id"> & { id: string }): Promise<Reminder> {
  return request<Reminder>("POST", "/api/reminders", reminder);
}

export async function updateReminder(id: string, updates: Partial<Omit<Reminder, "id">>): Promise<void> {
  await request("PATCH", `/api/reminders/${encodeURIComponent(id)}`, updates);
}

export async function deleteReminder(id: string): Promise<void> {
  await request("DELETE", `/api/reminders/${encodeURIComponent(id)}`);
}
