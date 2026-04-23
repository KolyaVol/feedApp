import { useCallback, useState } from "react";
import { formatDateStr } from "../../data/feedDays";
import type { FeedDay } from "../../types";

export function isValidIsoDate(dateStr: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return false;
  const d = new Date(dateStr + "T00:00:00");
  return !isNaN(d.getTime()) && formatDateStr(d) === dateStr;
}

export interface UseDateDrafts {
  drafts: Record<string, string>;
  focus: (day: FeedDay) => void;
  change: (dayId: string, value: string) => void;
  blur: (
    day: FeedDay,
    onValid: (dayId: string, date: string) => void,
    onInvalid: () => void,
  ) => void;
}

export function useDateDrafts(): UseDateDrafts {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const focus = useCallback((day: FeedDay) => {
    setDrafts((prev) => ({ ...prev, [day.id]: prev[day.id] ?? day.date }));
  }, []);

  const change = useCallback((dayId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [dayId]: value.replace(/[^0-9-]/g, "") }));
  }, []);

  const clear = useCallback((dayId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[dayId];
      return next;
    });
  }, []);

  const blur = useCallback(
    (
      day: FeedDay,
      onValid: (dayId: string, date: string) => void,
      onInvalid: () => void,
    ) => {
      const raw = (drafts[day.id] ?? day.date).trim();
      if (!raw) {
        clear(day.id);
        return;
      }
      if (!isValidIsoDate(raw)) {
        onInvalid();
        clear(day.id);
        return;
      }
      if (raw !== day.date) onValid(day.id, raw);
      clear(day.id);
    },
    [drafts, clear],
  );

  return { drafts, focus, change, blur };
}
