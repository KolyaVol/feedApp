import type { Reminder } from "../types";
import * as remindersData from "../data/reminders";
import { useAsyncList } from "./useAsyncList";

export function useReminders(): {
  reminders: Reminder[];
  loading: boolean;
  refresh: () => Promise<void>;
  addReminder: (reminder: Omit<Reminder, "id">) => Promise<Reminder>;
  updateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
} {
  const { items, loading, refresh, add, update, remove } = useAsyncList<Reminder>({
    fetch: remindersData.getReminders,
    add: remindersData.addReminder,
    update: remindersData.updateReminder,
    remove: remindersData.deleteReminder,
  });

  return {
    reminders: items,
    loading,
    refresh,
    addReminder: add!,
    updateReminder: update!,
    deleteReminder: remove!,
  };
}
