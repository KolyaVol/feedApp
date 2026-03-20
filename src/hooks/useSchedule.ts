import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import type { DayPlan, PlanDay, LoadedSchedule } from "../types";
import {
  getPlanDays,
  setPlanDays,
  addPlanDays,
  updatePlanDay as updatePlanDayStorage,
  updateAllPlanDaysTime as updateAllPlanDaysTimeStorage,
  deletePlanDaysBySchedule,
  getPlanDayForDate,
  formatDateStr,
  addDays,
} from "../data/planDays";
import { KEYS } from "../data/storageKeys";
import {
  getLoadedSchedules,
  addLoadedSchedule,
  deleteLoadedSchedule as deleteScheduleStorage,
} from "../data/loadedSchedules";
import { generateId } from "../utils/id";
import { useRemoteFeedContext } from "../remoteFeed/RemoteFeedContext";
import {
  remoteScheduleToPlanDays,
} from "../remoteFeed/deriveToday";

interface ScheduleJson {
  month: number;
  breastfeeding?: {
    rules?: string[];
  };
  feeding_schedule?: {
    meal_slots?: { name: "morning" | "lunch" | "evening"; time: string; rules?: string[] }[];
  };
  hidden_risks?: string[];
  introduction_plan?: {
    week: number;
    days: {
      day: number;
      notes?: string;
      morning?: { product: string; amount_grams: number };
      lunch?: { product: string; amount_grams: number }[];
      evening?: { product: string; amount_grams: number }[];
    }[];
  }[];
  weekly_schedule?: {
    week: number;
    days: {
      day: number;
      time: string;
      food_type: string;
      food: string;
      amount_grams: number;
      substitutions?: string[];
      notes?: string;
    }[];
  }[];
  months?: ScheduleJson[];
}

let sharedProgressDateStr: string | null = null;
const progressDateListeners = new Set<(value: string) => void>();

function publishProgressDate(value: string) {
  sharedProgressDateStr = value;
  for (const listener of progressDateListeners) listener(value);
}

export function useSchedule() {
  const remote = useRemoteFeedContext();
  const [planDays, setPlanDaysState] = useState<PlanDay[]>([]);
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressDateStr, setProgressDateStr] = useState(() => {
    if (sharedProgressDateStr) return sharedProgressDateStr;
    const today = formatDateStr(new Date());
    sharedProgressDateStr = today;
    return today;
  });

  useEffect(() => {
    const listener = (value: string) => setProgressDateStr(value);
    progressDateListeners.add(listener);
    return () => {
      progressDateListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEYS.PROGRESS_DATE).then((stored) => {
      const realToday = formatDateStr(new Date());
      const validStored = stored && /^\d{4}-\d{2}-\d{2}$/.test(stored);
      const toUse = validStored ? stored : realToday;
      if (toUse !== stored) AsyncStorage.setItem(KEYS.PROGRESS_DATE, toUse);
      publishProgressDate(toUse);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEYS.PROGRESS_DATE).then((stored) => {
        const realToday = formatDateStr(new Date());
        const validStored = stored && /^\d{4}-\d{2}-\d{2}$/.test(stored);
        const toUse = validStored ? stored : realToday;
        if (toUse !== stored) AsyncStorage.setItem(KEYS.PROGRESS_DATE, toUse);
        publishProgressDate(toUse);
      });
    }, []),
  );

  const setProgressDate = useCallback((dateStr: string) => {
    publishProgressDate(dateStr);
    AsyncStorage.setItem(KEYS.PROGRESS_DATE, dateStr);
  }, []);

  const resetProgressDate = useCallback(() => {
    const today = formatDateStr(new Date());
    publishProgressDate(today);
    AsyncStorage.removeItem(KEYS.PROGRESS_DATE);
  }, []);

  const remotePlanDays = useMemo((): PlanDay[] => {
    if (!remote?.schedule || !remote.startDate) return [];
    return remoteScheduleToPlanDays(remote.schedule, remote.startDate);
  }, [remote?.schedule, remote?.startDate]);
  const remoteDayPlans = useMemo((): DayPlan[] => {
    if (!remote?.schedule || !remote.startDate) return [];
    const start = remote.startDate;
    const weeks = remote.schedule.introduction_plan ?? [];
    let index = 0;
    const out: DayPlan[] = [];
    for (const w of weeks) {
      for (const d of w.days) {
        const date = addDays(start, index++);
        const meals: DayPlan["meals"] = [];
        if (d.morning) meals.push({ mealType: "morning", product: d.morning.product, amountGrams: d.morning.amount_grams });
        for (const m of d.lunch ?? []) meals.push({ mealType: "lunch", product: m.product, amountGrams: m.amount_grams });
        for (const m of d.evening ?? []) meals.push({ mealType: "evening", product: m.product, amountGrams: m.amount_grams });
        out.push({ date, weekNumber: w.week, dayNumber: d.day, notes: d.notes, meals, sourceMonth: remote.schedule.month });
      }
    }
    return out;
  }, [remote?.schedule, remote?.startDate]);
  const remoteToday = useMemo(() => remote?.today ?? null, [remote?.today]);

  const remoteLoadedSchedule = useMemo((): LoadedSchedule | null => {
    if (!remote?.schedule || !remote.startDate || !remotePlanDays.length) return null;
    const startDate = remote.startDate;
    const endDate = remotePlanDays[remotePlanDays.length - 1]?.date ?? startDate;
    return {
      id: "remote",
      month: remote.schedule.month,
      startDate,
      endDate,
      signsOfReadiness: remote.schedule.breastfeeding?.rules ?? [],
      safetyGuidelines: remote.schedule.hidden_risks ?? [],
      loadedAt: "",
    };
  }, [remote?.schedule, remote?.startDate, remotePlanDays]);

  const effectivePlanDays = useMemo(() => {
    return [...planDays, ...remotePlanDays];
  }, [remotePlanDays, planDays]);

  const effectiveSchedules = useMemo(() => {
    const list = remoteLoadedSchedule ? [remoteLoadedSchedule, ...schedules] : schedules;
    return list;
  }, [remoteLoadedSchedule, schedules]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [days, scheds] = await Promise.all([
      getPlanDays(),
      getLoadedSchedules(),
    ]);
    setPlanDaysState(days);
    setSchedules(scheds);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const todayPlan = useCallback((): PlanDay | undefined => {
    return getPlanDayForDate(effectivePlanDays, progressDateStr);
  }, [effectivePlanDays, progressDateStr]);

  const tomorrowPlan = useCallback((): PlanDay | undefined => {
    const tomorrow = addDays(progressDateStr, 1);
    return getPlanDayForDate(effectivePlanDays, tomorrow);
  }, [effectivePlanDays, progressDateStr]);

  const getScheduleForDay = useCallback(
    (day: PlanDay): LoadedSchedule | undefined => {
      return effectiveSchedules.find((s) => s.id === day.scheduleId);
    },
    [effectiveSchedules],
  );

  const loadJson = useCallback(
    async (content: string): Promise<void> => {
      const json: ScheduleJson = JSON.parse(content);
      const source =
        json.introduction_plan?.length || json.weekly_schedule?.length
          ? json
          : json.months?.find((m) => m.introduction_plan?.length || m.weekly_schedule?.length);
      if (!source) {
        throw new Error("Invalid schedule format");
      }
      const hasNew = !!source.introduction_plan?.length;

      const existingDays = await getPlanDays();
      let startDate: string;
      if (existingDays.length > 0) {
        const sorted = [...existingDays].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        startDate = addDays(sorted[sorted.length - 1].date, 1);
      } else {
        startDate = formatDateStr(new Date());
      }

      const scheduleId = generateId();
      const newDays: PlanDay[] = [];
      let dayIndex = 0;

      if (hasNew && source.introduction_plan) {
        const time = source.feeding_schedule?.meal_slots?.find((s) => s.name === "morning")?.time ?? "09:00";
        for (const week of source.introduction_plan) {
          for (const day of week.days) {
            const date = addDays(startDate, dayIndex);
            const primary = day.morning ?? day.lunch?.[0] ?? day.evening?.[0];
            if (!primary) continue;
            newDays.push({
              id: generateId(),
              date,
              time,
              foodType: "meal-plan",
              food: primary.product,
              amountGrams: primary.amount_grams,
              substitutions: [],
              notes: day.notes,
              sourceMonth: source.month,
              weekNumber: week.week,
              scheduleId,
            });
            dayIndex++;
          }
        }
      } else if (source.weekly_schedule) {
        for (const week of source.weekly_schedule) {
          for (const day of week.days) {
            const date = addDays(startDate, dayIndex);
            newDays.push({
              id: generateId(),
              date,
              time: day.time,
              foodType: day.food_type,
              food: day.food,
              amountGrams: day.amount_grams,
              substitutions: day.substitutions ?? [],
              notes: day.notes,
              sourceMonth: source.month,
              weekNumber: week.week,
              scheduleId,
            });
            dayIndex++;
          }
        }
      }

      const endDate = newDays[newDays.length - 1].date;

      const schedule: LoadedSchedule = {
        id: scheduleId,
        month: source.month,
        startDate,
        endDate,
        signsOfReadiness: source.breastfeeding?.rules ?? [],
        safetyGuidelines: source.hidden_risks ?? [],
        loadedAt: new Date().toISOString(),
      };

      await addPlanDays(newDays);
      await addLoadedSchedule(schedule);
      await refresh();
    },
    [refresh],
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string): Promise<void> => {
      await deletePlanDaysBySchedule(scheduleId);
      await deleteScheduleStorage(scheduleId);
      await refresh();
    },
    [refresh],
  );

  const updatePlanDay = useCallback(
    async (id: string, updates: Partial<PlanDay>): Promise<void> => {
      await updatePlanDayStorage(id, updates);
      await refresh();
    },
    [refresh],
  );

  const updateAllPlanDaysTime = useCallback(
    async (time: string): Promise<void> => {
      await updateAllPlanDaysTimeStorage(time);
      await refresh();
    },
    [refresh],
  );

  const getDaysForSchedule = useCallback(
    (scheduleId: string): PlanDay[] => {
      const seenByDate = new Set<string>();
      const unique: PlanDay[] = [];
      for (const d of effectivePlanDays) {
        if (d.scheduleId !== scheduleId) continue;
        if (seenByDate.has(d.date)) continue;
        seenByDate.add(d.date);
        unique.push(d);
      }
      return unique.sort((a, b) => a.date.localeCompare(b.date));
    },
    [effectivePlanDays],
  );

  const getRandomSafetyTip = useCallback((): string | undefined => {
    const allTips = effectiveSchedules.flatMap((s) => s.safetyGuidelines);
    if (!allTips.length) return undefined;
    return allTips[Math.floor(Math.random() * allTips.length)];
  }, [effectiveSchedules]);

  return {
    planDays: effectivePlanDays,
    schedules: effectiveSchedules,
    loading,
    refresh,
    progressDateStr,
    setProgressDate,
    resetProgressDate,
    todayPlan,
    remoteToday,
    remoteDayPlans,
    tomorrowPlan,
    getScheduleForDay,
    loadJson,
    deleteSchedule,
    updatePlanDay,
    updateAllPlanDaysTime,
    getDaysForSchedule,
    getRandomSafetyTip,
  };
}
