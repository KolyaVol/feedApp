import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedDay } from "../types";
import { PushScheduler } from "../remoteFeed/pushScheduler";
import type { SyncResult } from "../remoteFeed/sync";
import { getGithubToken } from "../data/settings";

const AUTO_PUSH_DEBOUNCE_MS = 4000;
const ERROR_COOLDOWN_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export interface SyncError {
  id: number;
  text: string;
  conflict?: boolean;
}

export interface SyncSnapshot {
  days: FeedDay[];
  snapshot: string;
}

export interface UseSyncController {
  syncing: boolean;
  lastError: SyncError | null;
  clearError: () => void;
  raiseError: (text: string, conflict?: boolean) => void;
  notifyChange: (snapshot: string) => void;
  markSnapshotPushed: (snapshot: string) => void;
  requestSkipNextAutoPush: () => void;
  setInitialSnapshot: (snapshot: string) => void;
  pushNow: () => Promise<SyncResult>;
  runWithSyncing: <T>(fn: () => Promise<T>) => Promise<T>;
}

export function useSyncController(
  getSnapshot: () => SyncSnapshot,
): UseSyncController {
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<SyncError | null>(null);
  const errorIdRef = useRef(0);
  const snapshotRef = useRef(getSnapshot);
  snapshotRef.current = getSnapshot;

  const raiseError = useCallback((text: string, conflict?: boolean) => {
    errorIdRef.current += 1;
    setLastError({ id: errorIdRef.current, text, conflict });
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const schedulerRef = useRef<PushScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new PushScheduler({
      debounceMs: AUTO_PUSH_DEBOUNCE_MS,
      cooldownMs: ERROR_COOLDOWN_MS,
      maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
      getToken: getGithubToken,
      getSnapshot: () => snapshotRef.current(),
      onSyncingChange: setSyncing,
      onError: raiseError,
      shouldShowError: (count, manual) => manual || count <= 1,
    });
  }

  useEffect(
    () => () => {
      schedulerRef.current?.reset();
    },
    [],
  );

  const notifyChange = useCallback((snapshot: string) => {
    schedulerRef.current?.notifyChange(snapshot);
  }, []);

  const markSnapshotPushed = useCallback((snapshot: string) => {
    schedulerRef.current?.markSnapshotPushed(snapshot);
  }, []);

  const requestSkipNextAutoPush = useCallback(() => {
    schedulerRef.current?.requestSkipNextAutoPush();
  }, []);

  const setInitialSnapshot = useCallback((snapshot: string) => {
    schedulerRef.current?.setInitialSnapshot(snapshot);
  }, []);

  const pushNow = useCallback(async (): Promise<SyncResult> => {
    if (!schedulerRef.current) return { ok: false, text: "Scheduler not ready" };
    return schedulerRef.current.pushNow();
  }, []);

  const runWithSyncing = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSyncing(true);
    try {
      return await fn();
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    syncing,
    lastError,
    clearError,
    raiseError,
    notifyChange,
    markSnapshotPushed,
    requestSkipNextAutoPush,
    setInitialSnapshot,
    pushNow,
    runWithSyncing,
  };
}
