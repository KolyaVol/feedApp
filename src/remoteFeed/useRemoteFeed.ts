import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRemoteJson } from "./api";
import { loadCachedJson, loadStartDate, saveCachedJson } from "./storage";
import { getTodayFromSchedule } from "./deriveToday";
import { scheduleMealsFromFeedData } from "./notifications";
import { REMOTE_FEED_URL } from "./config";
import type { RemoteFeedSchedule, RemoteFeedToday } from "./types";

export function useRemoteFeed(url: string = REMOTE_FEED_URL) {
  const [schedule, setSchedule] = useState<RemoteFeedSchedule | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today: RemoteFeedToday | null = useMemo(() => {
    if (!schedule || !startDate) return null;
    return getTodayFromSchedule(schedule, startDate);
  }, [schedule, startDate]);

  const fetchAndUpdate = useCallback(async (sd: string | null) => {
    const fresh = await fetchRemoteJson(url);
    if (!fresh) {
      setError((e) => e ?? "Failed to fetch remote JSON");
      return;
    }
    await saveCachedJson(fresh);
    setSchedule(fresh);
    setError(null);
    if (sd) {
      await scheduleMealsFromFeedData(fresh, sd);
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cached, sd] = await Promise.all([loadCachedJson(), loadStartDate()]);
        if (cancelled) return;
        setSchedule(cached);
        setStartDate(sd);
        setLoading(false);
        await fetchAndUpdate(sd);
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
    setRefreshing(true);
    try {
      await fetchAndUpdate(startDate);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAndUpdate, startDate]);

  return { schedule, startDate, today, loading, refreshing, error, refresh };
}

