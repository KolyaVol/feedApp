import React, { useCallback, useEffect, useMemo, useState, createContext, useContext } from "react";
import { fetchRemoteJson } from "./api";
import { loadCachedJson, loadStartDate, saveCachedJson } from "./storage";
import { getTodayFromSchedule } from "./deriveToday";
import { scheduleMealsFromFeedData } from "./notifications";
import { isScheduleValid, shouldRejectFreshInFavorOfCache } from "./validate";
import { REMOTE_FEED_URL } from "./config";
import type { RemoteFeedSchedule, RemoteFeedToday } from "./types";

export interface RemoteFeedState {
  schedule: RemoteFeedSchedule | null;
  startDate: string | null;
  today: RemoteFeedToday | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const RemoteFeedContext = createContext<RemoteFeedState | null>(null);

export function RemoteFeedProvider({ children }: { children: React.ReactNode }) {
  const [schedule, setSchedule] = useState<RemoteFeedSchedule | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today: RemoteFeedToday | null = useMemo(() => {
    if (!schedule || !startDate) return null;
    return getTodayFromSchedule(schedule, startDate);
  }, [schedule, startDate]);

  const fetchAndUpdate = useCallback(async (sd: string | null, cachedSchedule: RemoteFeedSchedule | null) => {
    const fresh = await fetchRemoteJson(REMOTE_FEED_URL);
    if (!fresh) {
      setError((e) => e ?? "Failed to fetch remote JSON");
      return;
    }
    if (!isScheduleValid(fresh)) {
      setError("Remote data invalid, using cache");
      return;
    }
    if (shouldRejectFreshInFavorOfCache(fresh, cachedSchedule)) {
      setError("Remote data invalid, using cache");
      return;
    }
    await saveCachedJson(fresh);
    setSchedule(fresh);
    setError(null);
    if (sd) {
      await scheduleMealsFromFeedData(fresh, sd);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cached, sd] = await Promise.all([loadCachedJson(), loadStartDate()]);
        if (cancelled) return;
        setSchedule(cached);
        setStartDate(sd);
        setLoading(false);
        await fetchAndUpdate(sd, cached);
      } catch {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAndUpdate]);

  const refresh = useCallback(async () => {
    try {
      await fetchAndUpdate(startDate, schedule);
    } catch {
      // ignore
    }
  }, [fetchAndUpdate, startDate, schedule]);

  const value = useMemo<RemoteFeedState>(
    () => ({ schedule, startDate, today, loading, error, refresh }),
    [schedule, startDate, today, loading, error, refresh],
  );

  return (
    <RemoteFeedContext.Provider value={value}>
      {children}
    </RemoteFeedContext.Provider>
  );
}

export function useRemoteFeedContext(): RemoteFeedState | null {
  return useContext(RemoteFeedContext);
}
