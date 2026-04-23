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
import { pullFeedDays, pushFeedDays, type SyncResult } from "../remoteFeed/sync";
import { getGithubToken } from "../data/settings";

export interface SyncError {
  id: number;
  text: string;
  conflict?: boolean;
}

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

const AUTO_PUSH_DEBOUNCE_MS = 4000;
const ERROR_COOLDOWN_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export function FeedDaysProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<FeedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<SyncError | null>(null);

  const snapshot = useMemo(() => JSON.stringify(days), [days]);
  const latestDaysRef = useRef(days);
  const latestSnapshotRef = useRef(snapshot);
  const lastPushedSnapshotRef = useRef<string>("");
  const initializedRef = useRef(false);

  const autoPushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const errorIdRef = useRef(0);
  const pushingRef = useRef(false);
  const skipNextAutoPushRef = useRef(false);

  useEffect(() => {
    latestDaysRef.current = days;
    latestSnapshotRef.current = snapshot;
  }, [days, snapshot]);

  const refresh = useCallback(async () => {
    if (!initializedRef.current) setLoading(true);
    const list = await getFeedDays();
    setDays(list);
    if (!initializedRef.current) {
      const snap = JSON.stringify(list);
      lastPushedSnapshotRef.current = snap;
      initializedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const raiseError = useCallback((text: string, conflict?: boolean) => {
    errorIdRef.current += 1;
    setLastError({ id: errorIdRef.current, text, conflict });
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const runPush = useCallback(
    async (options?: { manual?: boolean }): Promise<SyncResult> => {
      if (pushingRef.current) {
        return { ok: false, text: "Push already in progress." };
      }
      const token = await getGithubToken();
      if (!token) return { ok: false, text: "GitHub token not configured." };

      pushingRef.current = true;
      setSyncing(true);
      const snapshotBeforePush = latestSnapshotRef.current;
      try {
        const result = await pushFeedDays(latestDaysRef.current);
        if (result.ok) {
          lastPushedSnapshotRef.current = snapshotBeforePush;
          failureCountRef.current = 0;
          cooldownUntilRef.current = 0;
        } else {
          failureCountRef.current += 1;
          cooldownUntilRef.current = Date.now() + ERROR_COOLDOWN_MS;
          if (options?.manual || failureCountRef.current <= 1) {
            raiseError(result.text, result.conflict);
          }
        }
        return result;
      } finally {
        pushingRef.current = false;
        setSyncing(false);
      }
    },
    [raiseError],
  );

  useEffect(() => {
    if (!initializedRef.current) return;
    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false;
      lastPushedSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastPushedSnapshotRef.current) return;
    if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    const delay = Math.max(AUTO_PUSH_DEBOUNCE_MS, cooldownUntilRef.current - Date.now());
    autoPushTimeoutRef.current = setTimeout(() => {
      if (pushingRef.current) return;
      if (latestSnapshotRef.current === lastPushedSnapshotRef.current) return;
      void runPush();
    }, delay);

    return () => {
      if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    };
  }, [snapshot, runPush]);

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

  const pullNow = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const result = await pullFeedDays();
      if (result.ok && result.days) {
        skipNextAutoPushRef.current = true;
        await setFeedDays(result.days);
        setDays(result.days);
        lastPushedSnapshotRef.current = JSON.stringify(result.days);
        failureCountRef.current = 0;
        cooldownUntilRef.current = 0;
      } else if (!result.ok) {
        raiseError(result.text);
      }
      return result;
    } finally {
      setSyncing(false);
    }
  }, [raiseError]);

  const pushNow = useCallback(async (): Promise<SyncResult> => {
    failureCountRef.current = 0;
    cooldownUntilRef.current = 0;
    return runPush({ manual: true });
  }, [runPush]);

  const value = useMemo<FeedDaysContextValue>(
    () => ({
      days,
      loading,
      syncing,
      lastError,
      refresh,
      addDay,
      insertDayAt,
      updateDay,
      deleteDay,
      moveDay,
      replaceAll,
      toggleEaten,
      pullNow,
      pushNow,
      clearError,
    }),
    [
      days,
      loading,
      syncing,
      lastError,
      refresh,
      addDay,
      insertDayAt,
      updateDay,
      deleteDay,
      moveDay,
      replaceAll,
      toggleEaten,
      pullNow,
      pushNow,
      clearError,
    ],
  );

  return <FeedDaysContext.Provider value={value}>{children}</FeedDaysContext.Provider>;
}

export function useFeedDaysContext(): FeedDaysContextValue {
  const ctx = useContext(FeedDaysContext);
  if (!ctx) throw new Error("useFeedDaysContext must be used within FeedDaysProvider");
  return ctx;
}
