import { useCallback, useEffect, useState } from "react";
import type { Reminder } from "../types";
import * as remindersData from "../data/reminders";

export function useReminders(): {
  reminders: Reminder[];
  loading: boolean;
  refresh: () => Promise<void>;
  addReminder: (reminder: Omit<Reminder, "id">) => Promise<Reminder>;
  updateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
} {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await remindersData.getReminders();
    setReminders(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addReminder = useCallback(
    async (reminder: Omit<Reminder, "id">) => {
      const added = await remindersData.addReminder(reminder);
      await refresh();
      return added;
    },
    [refresh],
  );

  const updateReminder = useCallback(
    async (id: string, updates: Partial<Reminder>) => {
      await remindersData.updateReminder(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      await remindersData.deleteReminder(id);
      await refresh();
    },
    [refresh],
  );

  return {
    reminders,
    loading,
    refresh,
    addReminder,
    updateReminder,
    deleteReminder,
  };
}
