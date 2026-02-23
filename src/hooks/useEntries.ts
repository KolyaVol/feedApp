import { useCallback, useEffect, useState } from "react";
import type { FeedEntry } from "../types";
import * as entriesData from "../data/entries";

export function useEntries(selectedDate?: Date): {
  entries: FeedEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  addEntry: (entry: Omit<FeedEntry, "id">) => Promise<FeedEntry>;
  deleteEntry: (id: string) => Promise<void>;
  entriesForDate: FeedEntry[];
} {
  const date = selectedDate ?? new Date();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await entriesData.getEntries();
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const start = entriesData.getStartOfDay(date);
  const end = entriesData.getEndOfDay(date);
  const entriesForDate = entriesData.getEntriesInRange(entries, start, end);

  const addEntry = useCallback(
    async (entry: Omit<FeedEntry, "id">) => {
      const added = await entriesData.addEntry(entry);
      await refresh();
      return added;
    },
    [refresh],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await entriesData.deleteEntry(id);
      await refresh();
    },
    [refresh],
  );

  return {
    entries,
    loading,
    refresh,
    addEntry,
    deleteEntry,
    entriesForDate,
  };
}
