import { useCallback, useMemo } from "react";
import type { FeedEntry } from "../types";
import * as entriesData from "../data/entries";
import { useAsyncList } from "./useAsyncList";

export function useEntries(selectedDate?: Date): {
  entries: FeedEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  addEntry: (entry: Omit<FeedEntry, "id">) => Promise<FeedEntry>;
  deleteEntry: (id: string) => Promise<void>;
  entriesForDate: FeedEntry[];
} {
  const date = selectedDate ?? new Date();
  const { items: entries, loading, refresh, add, remove } = useAsyncList<FeedEntry>({
    fetch: entriesData.getEntries,
    add: entriesData.addEntry,
    remove: entriesData.deleteEntry,
  });

  const start = entriesData.getStartOfDay(date);
  const end = entriesData.getEndOfDay(date);
  const entriesForDate = useMemo(
    () => entriesData.getEntriesInRange(entries, start, end),
    [entries, start, end],
  );

  const addEntry = useCallback(
    async (entry: Omit<FeedEntry, "id">) => {
      const added = await add!(entry);
      return added;
    },
    [add],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await remove!(id);
    },
    [remove],
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
