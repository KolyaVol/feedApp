import { useCallback, useEffect, useState } from "react";
import type { FeedDay, MealType } from "../types";
import {
  getFeedDays,
  setFeedDays,
  addFeedDay as addFeedDayStorage,
  updateFeedDay as updateFeedDayStorage,
  deleteFeedDay as deleteFeedDayStorage,
  moveFeedDay as moveFeedDayStorage,
  createEmptyFeedDay,
  formatDateStr,
  addDaysToDate,
} from "../data/feedDays";

export function useFeedDays() {
  const [days, setDays] = useState<FeedDay[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getFeedDays();
    setDays(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addDay = useCallback(
    async (day?: Omit<FeedDay, "id">): Promise<FeedDay> => {
      const current = await getFeedDays();
      const lastDate = current.length
        ? current[current.length - 1]!.date
        : formatDateStr(new Date());
      const nextDate =
        current.length > 0 ? addDaysToDate(lastDate, 1) : lastDate;
      const newDay = day ?? createEmptyFeedDay(nextDate);
      const created = await addFeedDayStorage(newDay);
      await refresh();
      return created;
    },
    [refresh],
  );

  const updateDay = useCallback(
    async (id: string, updates: Partial<FeedDay>): Promise<void> => {
      await updateFeedDayStorage(id, updates);
      setDays((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx]!, ...updates, id };
        return next;
      });
    },
    [],
  );

  const deleteDay = useCallback(
    async (id: string): Promise<void> => {
      await deleteFeedDayStorage(id);
      setDays((prev) => prev.filter((d) => d.id !== id));
    },
    [],
  );

  const moveDay = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
      await moveFeedDayStorage(fromIndex, toIndex);
      setDays((prev) => {
        const next = [...prev];
        const [item] = next.splice(fromIndex, 1);
        if (!item) return prev;
        next.splice(toIndex, 0, item);
        return next;
      });
    },
    [],
  );

  const replaceAll = useCallback(
    async (newDays: FeedDay[]): Promise<void> => {
      await setFeedDays(newDays);
      setDays(newDays);
    },
    [],
  );

  const toggleEaten = useCallback(
    async (id: string, mealType: MealType): Promise<void> => {
      const day = days.find((d) => d.id === id);
      if (!day) return;
      const current = day.eaten?.[mealType] ?? false;
      const eaten = { ...(day.eaten ?? {}), [mealType]: !current };
      await updateFeedDayStorage(id, { eaten });
      setDays((prev) =>
        prev.map((d) => (d.id === id ? { ...d, eaten } : d)),
      );
    },
    [days],
  );

  return {
    days,
    loading,
    refresh,
    addDay,
    updateDay,
    deleteDay,
    moveDay,
    replaceAll,
    toggleEaten,
  };
}
