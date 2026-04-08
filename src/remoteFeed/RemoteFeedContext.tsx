import React, { useCallback, useEffect, useMemo, useState, createContext, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRemoteJson, parseRemoteJsonText } from "./api";
import { loadCachedJson, loadStartDate, saveCachedJson, setStartDate as saveStartDate } from "./storage";
import { getTodayFromSchedule } from "./deriveToday";
import { cancelAllRemoteFeedNotifications, scheduleMealsFromFeedData } from "./notifications";
import { isScheduleValid, shouldRejectFreshInFavorOfCache } from "./validate";
import { REMOTE_FEED_BASELINE_URL, REMOTE_FEED_USER_URL } from "./config";
import type { RemoteFeedSchedule, RemoteFeedToday } from "./types";
import { KEYS } from "../data/storageKeys";
import { appendMissingMonths, readGithubJsonFile, writeGithubJsonFile } from "./githubSync";
import { GITHUB_BASELINE_JSON_PATH, GITHUB_USER_JSON_PATH } from "./env";

export interface RemoteFeedState {
  schedule: RemoteFeedSchedule | null;
  startDate: string | null;
  today: RemoteFeedToday | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applySchedule: (next: RemoteFeedSchedule) => Promise<void>;
  setStartDate: (dateStr: string) => Promise<void>;
  resetFromBaseline: () => Promise<boolean>;
}

const RemoteFeedContext = createContext<RemoteFeedState | null>(null);

export function RemoteFeedProvider({ children }: { children: React.ReactNode }) {
  const [schedule, setSchedule] = useState<RemoteFeedSchedule | null>(null);
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today: RemoteFeedToday | null = useMemo(() => {
    if (!schedule || !startDate) return null;
    return getTodayFromSchedule(schedule, startDate);
  }, [schedule, startDate]);

  const scheduleRef = React.useRef(schedule);
  const startDateRef = React.useRef(startDate);
  const appliedAtRef = React.useRef(0);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { startDateRef.current = startDate; }, [startDate]);

  const fetchAndUpdate = useCallback(async () => {
    const COOLDOWN_MS = 30_000;
    await cancelAllRemoteFeedNotifications();
    if (Date.now() - appliedAtRef.current < COOLDOWN_MS) return;
    const sd = startDateRef.current;
    const cachedSchedule = scheduleRef.current;
    const freshUser = await fetchRemoteJson(REMOTE_FEED_USER_URL);
    let fresh = freshUser;
    if (!fresh) {
      const baseline = await fetchRemoteJson(REMOTE_FEED_BASELINE_URL);
      if (baseline) {
        fresh = baseline;
        await writeGithubJsonFile({
          path: GITHUB_USER_JSON_PATH,
          text: JSON.stringify(baseline, null, 2),
          message: "Bootstrap user.json from baseline data.json",
        });
      }
    }
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

    try {
      const lastSyncRaw = await AsyncStorage.getItem(KEYS.LAST_BASELINE_SYNC_AT);
      const lastSyncTs = Number(lastSyncRaw ?? "0");
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      if (!lastSyncTs || Date.now() - lastSyncTs >= weekMs) {
        const [userFile, baselineFile] = await Promise.all([
          readGithubJsonFile(GITHUB_USER_JSON_PATH),
          readGithubJsonFile(GITHUB_BASELINE_JSON_PATH),
        ]);
        if (userFile.ok && baselineFile.ok && userFile.text && baselineFile.text) {
          const userRoot = JSON.parse(userFile.text);
          const baselineRoot = JSON.parse(baselineFile.text);
          const mergedRoot = appendMissingMonths(userRoot, baselineRoot);
          const changed = JSON.stringify(mergedRoot) !== JSON.stringify(userRoot);
          if (changed) {
            const mergedText = JSON.stringify(mergedRoot, null, 2);
            const writeRes = await writeGithubJsonFile({
              path: GITHUB_USER_JSON_PATH,
              text: mergedText,
              message: "Append new months from data.json to user.json",
            });
            if (writeRes.ok) {
              const parsed = parseRemoteJsonText(mergedText);
              if (parsed) {
                await saveCachedJson(parsed);
                setSchedule(parsed);
                scheduleRef.current = parsed;
                if (sd) await scheduleMealsFromFeedData(parsed, sd);
              }
            }
          }
          await AsyncStorage.setItem(KEYS.LAST_BASELINE_SYNC_AT, String(Date.now()));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cached, sd] = await Promise.all([loadCachedJson(), loadStartDate()]);
        if (cancelled) return;
        scheduleRef.current = cached;
        startDateRef.current = sd;
        setSchedule(cached);
        setStartDateState(sd);
        setLoading(false);
        await fetchAndUpdate();
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
      await fetchAndUpdate();
    } catch {
      // ignore
    }
  }, [fetchAndUpdate]);

  const applySchedule = useCallback(async (next: RemoteFeedSchedule) => {
    appliedAtRef.current = Date.now();
    scheduleRef.current = next;
    await saveCachedJson(next);
    setSchedule(next);
    setError(null);
    const sd = startDateRef.current;
    if (sd) {
      await scheduleMealsFromFeedData(next, sd);
    }
    await writeGithubJsonFile({
      path: GITHUB_USER_JSON_PATH,
      text: JSON.stringify(next, null, 2),
      message: "Update user.json from app changes",
    });
  }, []);

  const setStartDate = useCallback(async (dateStr: string) => {
    await saveStartDate(dateStr);
    startDateRef.current = dateStr;
    setStartDateState(dateStr);
    const currentSchedule = scheduleRef.current;
    if (currentSchedule) {
      await scheduleMealsFromFeedData(currentSchedule, dateStr);
    }
  }, []);

  const resetFromBaseline = useCallback(async (): Promise<boolean> => {
    const baselineFile = await readGithubJsonFile(GITHUB_BASELINE_JSON_PATH);
    if (!baselineFile.ok || !baselineFile.text) return false;
    const writeRes = await writeGithubJsonFile({
      path: GITHUB_USER_JSON_PATH,
      text: baselineFile.text,
      message: "Reset user.json from data.json",
    });
    if (!writeRes.ok) return false;
    const parsed = parseRemoteJsonText(baselineFile.text);
    if (!parsed) return false;
    scheduleRef.current = parsed;
    await saveCachedJson(parsed);
    setSchedule(parsed);
    const sd = startDateRef.current;
    if (sd) await scheduleMealsFromFeedData(parsed, sd);
    return true;
  }, []);

  const value = useMemo<RemoteFeedState>(
    () => ({ schedule, startDate, today, loading, error, refresh, applySchedule, setStartDate, resetFromBaseline }),
    [schedule, startDate, today, loading, error, refresh, applySchedule, setStartDate, resetFromBaseline],
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
