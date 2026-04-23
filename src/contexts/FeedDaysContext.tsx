import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FeedDay, MealType } from "../types";
import {
  getFeedDays,
  setFeedDays,
  addFeedDay as addFeedDayStorage,
  insertFeedDayAt as insertFeedDayAtStorage,
  updateFeedDay as updateFeedDayStorage,
  deleteFeedDay as deleteFeedDayStorage,
  moveFeedDay as moveFeedDayStorage,
  createEmptyFeedDay,
  formatDateStr,
  addDaysToDate,
} from "../data/feedDays";
import { pullFeedDays, type SyncResult } from "../remoteFeed/sync";
import { useSyncController, type SyncError } from "../hooks/useSyncController";

export type { SyncError };

export interface FeedDaysContextValue {
  days: FeedDay[];
  loading: boolean;
  syncing: boolean;
  lastError: SyncError | null;
  refresh: () => Promise<void>;
  addDay: (day?: Omit<FeedDay, "id">) => Promise<FeedDay>;
  insertDayAt: (index: number, day?: Omit<FeedDay, "id">) => Promise<FeedDay>;
  updateDay: (id: string, updates: Partial<FeedDay>) => Promise<void>;
  deleteDay: (id: string) => Promise<void>;
  moveDay: (fromIndex: number, toIndex: number) => Promise<void>;
  replaceAll: (newDays: FeedDay[]) => Promise<void>;
  toggleEaten: (id: string, mealType: MealType) => Promise<void>;
  pullNow: () => Promise<SyncResult>;
  pushNow: () => Promise<SyncResult>;
  clearError: () => void;
}

const FeedDaysContext = createContext<FeedDaysContextValue | null>(null);

export function FeedDaysProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<FeedDay[]>([]);
  const [loading, setLoading] = useState(true);

  const snapshot = useMemo(() => JSON.stringify(days), [days]);
  const latestDaysRef = useRef(days);
  const latestSnapshotRef = useRef(snapshot);
  const initializedRef = useRef(false);

  useEffect(() => {
    latestDaysRef.current = days;
    latestSnapshotRef.current = snapshot;
  }, [days, snapshot]);

  const sync = useSyncController(
    useCallback(
      () => ({ days: latestDaysRef.current, snapshot: latestSnapshotRef.current }),
      [],
    ),
  );
  const { raiseError, setInitialSnapshot } = sync;

  const refresh = useCallback(async () => {
    if (!initializedRef.current) setLoading(true);
    const list = await getFeedDays();
    setDays(list);
    if (!initializedRef.current) {
      setInitialSnapshot(JSON.stringify(list));
      initializedRef.current = true;
      setLoading(false);
    }
  }, [setInitialSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!initializedRef.current) return;
    sync.notifyChange(snapshot);
  }, [snapshot, sync]);

  const addDay = useCallback(
    async (day?: Omit<FeedDay, "id">): Promise<FeedDay> => {
      const current = await getFeedDays();
      const lastDate = current.length
        ? current[current.length - 1]!.date
        : formatDateStr(new Date());
      const nextDate = current.length > 0 ? addDaysToDate(lastDate, 1) : lastDate;
      const newDay = day ?? createEmptyFeedDay(nextDate);
      const created = await addFeedDayStorage(newDay);
      const updated = await getFeedDays();
      setDays(updated);
      return created;
    },
    [],
  );

  const insertDayAt = useCallback(
    async (index: number, day?: Omit<FeedDay, "id">): Promise<FeedDay> => {
      const current = await getFeedDays();
      const clamped = Math.max(0, Math.min(index, current.length));
      const defaultDate = (() => {
        if (current.length === 0) return formatDateStr(new Date());
        if (clamped === 0) return addDaysToDate(current[0]!.date, -1);
        if (clamped >= current.length) {
          return addDaysToDate(current[current.length - 1]!.date, 1);
        }
        const prev = current[clamped - 1]!.date;
        return addDaysToDate(prev, 1);
      })();
      const newDay = day ?? createEmptyFeedDay(defaultDate);
      const created = await insertFeedDayAtStorage(newDay, clamped);
      const updated = await getFeedDays();
      setDays(updated);
      return created;
    },
    [],
  );

  const updateDay = useCallback(async (id: string, updates: Partial<FeedDay>): Promise<void> => {
    await updateFeedDayStorage(id, updates);
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...updates, id };
      return next;
    });
  }, []);

  const deleteDay = useCallback(async (id: string): Promise<void> => {
    await deleteFeedDayStorage(id);
    setDays((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const moveDay = useCallback(async (fromIndex: number, toIndex: number): Promise<void> => {
    await moveFeedDayStorage(fromIndex, toIndex);
    setDays((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      if (!item) return prev;
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const replaceAll = useCallback(async (newDays: FeedDay[]): Promise<void> => {
    await setFeedDays(newDays);
    setDays(newDays);
  }, []);

  const toggleEaten = useCallback(
    async (id: string, mealType: MealType): Promise<void> => {
      const day = latestDaysRef.current.find((d) => d.id === id);
      if (!day) return;
      const current = day.eaten?.[mealType] ?? false;
      const eaten = { ...(day.eaten ?? {}), [mealType]: !current };
      await updateFeedDayStorage(id, { eaten });
      setDays((prev) => prev.map((d) => (d.id === id ? { ...d, eaten } : d)));
    },
    [],
  );

  const pullNow = useCallback(
    (): Promise<SyncResult> =>
      sync.runWithSyncing(async () => {
        const result = await pullFeedDays();
        if (result.ok && result.days) {
          sync.requestSkipNextAutoPush();
          await setFeedDays(result.days);
          setDays(result.days);
          sync.markSnapshotPushed(JSON.stringify(result.days));
        } else if (!result.ok) {
          raiseError(result.text);
        }
        return result;
      }),
    [sync, raiseError],
  );

  const value = useMemo<FeedDaysContextValue>(
    () => ({
      days,
      loading,
      syncing: sync.syncing,
      lastError: sync.lastError,
      refresh,
      addDay,
      insertDayAt,
      updateDay,
      deleteDay,
      moveDay,
      replaceAll,
      toggleEaten,
      pullNow,
      pushNow: sync.pushNow,
      clearError: sync.clearError,
    }),
    [
      days,
      loading,
      sync.syncing,
      sync.lastError,
      sync.pushNow,
      sync.clearError,
      refresh,
      addDay,
      insertDayAt,
      updateDay,
      deleteDay,
      moveDay,
      replaceAll,
      toggleEaten,
      pullNow,
    ],
  );

  return <FeedDaysContext.Provider value={value}>{children}</FeedDaysContext.Provider>;
}

export function useFeedDaysContext(): FeedDaysContextValue {
  const ctx = useContext(FeedDaysContext);
  if (!ctx) throw new Error("useFeedDaysContext must be used within FeedDaysProvider");
  return ctx;
}
