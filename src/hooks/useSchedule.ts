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
import {
  addShiftOperation,
  getUserOverlay,
  removeShiftOperation,
  setReplacementMeal,
  toggleMealEaten,
} from "../data/userOverlay";

interface ScheduleJson {
  month: number;
  breastfeeding?: {
    rules?: string[];
  };
  feeding_schedule?: {
    meal_slots?: { name: "morning" | "lunch" | "evening"; time: string; rules?: string[] }[];
  };
  hidden_risks?: string[];
  allowed_products?: {
    vegetables?: string[];
    cereals?: string[];
    fruits?: string[];
    meat?: string[];
  };
  introduction_plan?: {
    week: number;
    allowed_products?: {
      vegetables?: string[];
      cereals?: string[];
      fruits?: string[];
      meat?: string[];
    };
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

type MealType = "morning" | "lunch" | "evening";
type DayMeal = { mealType: MealType; product: string; amountGrams: number };

function applyShiftOperations(
  days: DayPlan[],
  shifts: Array<{
    id: string;
    mode: "mealType" | "product";
    mealType: MealType;
    shiftDays: number;
    createdAt: string;
    fromDate?: string;
    product?: string;
  }>,
  replacementsByDate: Record<string, Partial<Record<MealType, { product: string; amountGrams: number }>>>,
): {
  days: DayPlan[];
  shiftedMealsByDate: Record<string, Partial<Record<MealType, boolean>>>;
  displacedByDate: Record<string, Partial<Record<MealType, { shiftId: string; meal: DayMeal }>>>;
} {
  const next = days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m })) }));
  const shiftedMealsByDate: Record<string, Partial<Record<MealType, boolean>>> = {};
  const displacedByDate: Record<string, Partial<Record<MealType, { shiftId: string; meal: DayMeal }>>> = {};
  const sorted = [...shifts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const shift of sorted) {
    const delta = Math.trunc(shift.shiftDays);
    if (!delta) continue;
    const targets: Array<{ dayIdx: number; meal: DayMeal }> = [];

    for (let i = 0; i < next.length; i++) {
      const day = next[i]!;
      if (shift.fromDate && day.date < shift.fromDate) continue;
      for (const meal of day.meals) {
        if (meal.mealType !== shift.mealType) continue;
        if (shift.mode === "product") {
          const needle = (shift.product ?? "").trim().toLowerCase();
          if (!needle) continue;
          if (meal.product.trim().toLowerCase() !== needle) continue;
        }
        targets.push({ dayIdx: i, meal: { ...meal } });
      }
    }

    for (const t of targets) {
      const src = next[t.dayIdx];
      if (!src) continue;
      const displacedDate = src.date;
      const displacedExisting = displacedByDate[displacedDate] ?? {};
      displacedByDate[displacedDate] = {
        ...displacedExisting,
        [t.meal.mealType]: { shiftId: shift.id, meal: { ...t.meal } },
      };
      src.meals = src.meals.filter(
        (m) =>
          !(
            m.mealType === t.meal.mealType &&
            m.product === t.meal.product &&
            m.amountGrams === t.meal.amountGrams
          ),
      );
    }

    for (const t of targets) {
      const targetIdx = t.dayIdx + delta;
      if (targetIdx < 0 || targetIdx >= next.length) continue;
      const targetDay = next[targetIdx]!;
      targetDay.meals.push({ ...t.meal });
      const existing = shiftedMealsByDate[targetDay.date] ?? {};
      shiftedMealsByDate[targetDay.date] = { ...existing, [t.meal.mealType]: true };
    }
  }

  const dateIndex = new Map(next.map((d, i) => [d.date, i] as const));
  for (const [date, byMeal] of Object.entries(replacementsByDate)) {
    const idx = dateIndex.get(date);
    if (idx === undefined) continue;
    const day = next[idx]!;
    for (const mealType of ["morning", "lunch", "evening"] as const) {
      const repl = byMeal?.[mealType];
      if (!repl) continue;
      const existingIdx = day.meals.findIndex((m) => m.mealType === mealType);
      const replacementMeal: DayMeal = {
        mealType,
        product: repl.product,
        amountGrams: repl.amountGrams,
      };
      if (existingIdx >= 0) day.meals[existingIdx] = replacementMeal;
      else day.meals.push(replacementMeal);
    }
  }

  for (const day of next) {
    const order = { morning: 0, lunch: 1, evening: 2 } as const;
    day.meals.sort((a, b) => order[a.mealType] - order[b.mealType]);
  }

  return { days: next, shiftedMealsByDate, displacedByDate };
}

let sharedProgressDateStr: string | null = null;
const progressDateListeners = new Set<(value: string) => void>();
const scheduleRefreshListeners = new Set<() => void>();

export function triggerGlobalScheduleRefresh() {
  for (const listener of scheduleRefreshListeners) listener();
}

function flattenAllowedProducts(input?: {
  vegetables?: string[];
  cereals?: string[];
  fruits?: string[];
  meat?: string[];
}): string[] {
  if (!input) return [];
  return [...new Set([...(input.vegetables ?? []), ...(input.cereals ?? []), ...(input.fruits ?? []), ...(input.meat ?? [])])];
}

function publishProgressDate(value: string) {
  sharedProgressDateStr = value;
  for (const listener of progressDateListeners) listener(value);
}

export function useSchedule() {
  const remote = useRemoteFeedContext();
  const [planDays, setPlanDaysState] = useState<PlanDay[]>([]);
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([]);
  const [userOverlay, setUserOverlay] = useState<Awaited<ReturnType<typeof getUserOverlay>> | null>(null);
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
    const monthSchedules = remote.schedule.months?.length ? remote.schedule.months : [remote.schedule];
    const all: PlanDay[] = [];
    let offset = 0;
    for (const monthSchedule of monthSchedules) {
      const monthStart = addDays(remote.startDate, offset);
      const monthDays = remoteScheduleToPlanDays(monthSchedule, monthStart).map((d, idx) => ({
        ...d,
        id: `remote-${monthSchedule.month}-${idx}`,
        scheduleId: `remote-${monthSchedule.month}`,
      }));
      all.push(...monthDays);
      offset += monthDays.length;
    }
    return all;
  }, [remote?.schedule, remote?.startDate]);
  const baseRemoteDayPlans = useMemo((): DayPlan[] => {
    if (!remote?.schedule || !remote.startDate) return [];
    const monthSchedules = remote.schedule.months?.length ? remote.schedule.months : [remote.schedule];
    let index = 0;
    const out: DayPlan[] = [];
    for (const monthSchedule of monthSchedules) {
      const weeks = monthSchedule.introduction_plan ?? [];
      for (const w of weeks) {
        for (const d of w.days) {
          const date = addDays(remote.startDate, index++);
          const meals: DayPlan["meals"] = [];
          if (d.morning) meals.push({ mealType: "morning", product: d.morning.product, amountGrams: d.morning.amount_grams });
          for (const m of d.lunch ?? []) meals.push({ mealType: "lunch", product: m.product, amountGrams: m.amount_grams });
          for (const m of d.evening ?? []) meals.push({ mealType: "evening", product: m.product, amountGrams: m.amount_grams });
          out.push({ date, weekNumber: w.week, dayNumber: d.day, notes: d.notes, meals, sourceMonth: monthSchedule.month });
        }
      }
    }
    return out;
  }, [remote?.schedule, remote?.startDate]);
  const appliedRemoteOverlay = useMemo(() => {
    if (!userOverlay) {
      return {
        days: baseRemoteDayPlans,
        shiftedMealsByDate: {} as Record<string, Partial<Record<MealType, boolean>>>,
        displacedByDate: {} as Record<string, Partial<Record<MealType, { shiftId: string; meal: DayMeal }>>>,
      };
    }
    return applyShiftOperations(
      baseRemoteDayPlans,
      userOverlay.shifts,
      userOverlay.replacementsByDate ?? {},
    );
  }, [baseRemoteDayPlans, userOverlay]);
  const remoteDayPlans = useMemo((): DayPlan[] => appliedRemoteOverlay.days, [appliedRemoteOverlay.days]);
  const remoteToday = useMemo(() => remote?.today ?? null, [remote?.today]);
  const remoteLoadedSchedules = useMemo((): LoadedSchedule[] => {
    if (!remote?.schedule || !remote.startDate || !remotePlanDays.length) return [];
    const monthSchedules = remote.schedule.months?.length ? remote.schedule.months : [remote.schedule];
    return monthSchedules
      .map((monthSchedule) => {
        const days = remotePlanDays.filter((d) => d.scheduleId === `remote-${monthSchedule.month}`);
        if (!days.length) return null;
        return {
          id: `remote-${monthSchedule.month}`,
          month: monthSchedule.month,
          startDate: days[0]!.date,
          endDate: days[days.length - 1]!.date,
          signsOfReadiness: monthSchedule.breastfeeding?.rules ?? [],
          safetyGuidelines: monthSchedule.hidden_risks ?? [],
          allowedProducts: flattenAllowedProducts(monthSchedule.allowed_products),
          loadedAt: "",
        } as LoadedSchedule;
      })
      .filter(Boolean) as LoadedSchedule[];
  }, [remote?.schedule, remote?.startDate, remotePlanDays]);

  const effectivePlanDays = useMemo(() => {
    return [...planDays, ...remotePlanDays];
  }, [remotePlanDays, planDays]);

  const effectiveSchedules = useMemo(() => {
    const list = remoteLoadedSchedules.length ? [...remoteLoadedSchedules, ...schedules] : schedules;
    return list;
  }, [remoteLoadedSchedules, schedules]);

  const allowedProductsForCurrentDay = useMemo(() => {
    const day = getPlanDayForDate(effectivePlanDays, progressDateStr);
    if (!day) return [] as string[];
    const scheduleForDay = effectiveSchedules.find((s) => s.id === day.scheduleId);
    let current = scheduleForDay?.allowedProducts ?? [];
    if (day.scheduleId.startsWith("remote-")) {
      const month = Number(day.scheduleId.replace("remote-", ""));
      const monthSchedule =
        remote?.schedule?.months?.find((m) => m.month === month) ??
        (remote?.schedule?.month === month ? remote.schedule : undefined);
      const weekOverride = monthSchedule?.introduction_plan?.find((w) => w.week === day.weekNumber)?.allowed_products;
      const weekAllowed = flattenAllowedProducts(weekOverride);
      if (weekAllowed.length) current = weekAllowed;
    }
    return [...new Set(current)];
  }, [effectivePlanDays, progressDateStr, effectiveSchedules, remote?.schedule?.introduction_plan]);

  const shiftedMealsByDate = useMemo(() => {
    return appliedRemoteOverlay.shiftedMealsByDate;
  }, [appliedRemoteOverlay.shiftedMealsByDate]);

  const displacedByDate = useMemo(() => {
    return appliedRemoteOverlay.displacedByDate;
  }, [appliedRemoteOverlay.displacedByDate]);

  const eatenMealsByDate = useMemo(() => {
    return userOverlay?.eatenMealsByDate ?? {};
  }, [userOverlay]);

  const dayEatenByDate = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const d of remoteDayPlans) {
      if (!d.meals.length) {
        out[d.date] = false;
        continue;
      }
      const state = eatenMealsByDate[d.date] ?? {};
      out[d.date] = d.meals.every((m) => !!state[m.mealType]);
    }
    return out;
  }, [eatenMealsByDate, remoteDayPlans]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [days, scheds, overlay] = await Promise.all([
      getPlanDays(),
      getLoadedSchedules(),
      getUserOverlay(),
    ]);
    setPlanDaysState(days);
    setSchedules(scheds);
    setUserOverlay(overlay);
    setLoading(false);
  }, []);

  useEffect(() => {
    const listener = () => {
      refresh();
    };
    scheduleRefreshListeners.add(listener);
    return () => {
      scheduleRefreshListeners.delete(listener);
    };
  }, [refresh]);

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
        allowedProducts: flattenAllowedProducts(source.allowed_products),
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

  const shiftMealTypeTimeline = useCallback(
    async (mealType: MealType, shiftDays: number, fromDate?: string): Promise<void> => {
      const days = Math.trunc(shiftDays);
      if (!Number.isFinite(days) || days === 0) return;
      await addShiftOperation({
        mode: "mealType",
        mealType,
        shiftDays: days,
        fromDate,
      });
      await refresh();
    },
    [refresh],
  );

  const shiftProductTimeline = useCallback(
    async (
      mealType: MealType,
      product: string,
      shiftDays: number,
      fromDate?: string,
    ): Promise<void> => {
      const days = Math.trunc(shiftDays);
      const cleanProduct = product.trim();
      if (!cleanProduct || !Number.isFinite(days) || days === 0) return;
      await addShiftOperation({
        mode: "product",
        mealType,
        product: cleanProduct,
        shiftDays: days,
        fromDate,
      });
      await refresh();
    },
    [refresh],
  );

  const toggleMealEatenForDate = useCallback(
    async (date: string, mealType: MealType): Promise<void> => {
      await toggleMealEaten(date, mealType);
      await refresh();
    },
    [refresh],
  );

  const isMealEaten = useCallback(
    (date: string, mealType: MealType): boolean => {
      return !!eatenMealsByDate[date]?.[mealType];
    },
    [eatenMealsByDate],
  );

  const revertShiftAtSlot = useCallback(
    async (date: string, mealType: MealType): Promise<void> => {
      const shiftId = displacedByDate[date]?.[mealType]?.shiftId;
      if (!shiftId) return;
      await removeShiftOperation(shiftId);
      await refresh();
    },
    [displacedByDate, refresh],
  );

  const replaceShiftedMealAtSlot = useCallback(
    async (
      date: string,
      mealType: MealType,
      product: string,
      amountGrams: number,
    ): Promise<void> => {
      await setReplacementMeal(date, mealType, product, amountGrams);
      await refresh();
    },
    [refresh],
  );

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
    allowedProductsForCurrentDay,
    remoteDayPlans,
    tomorrowPlan,
    getScheduleForDay,
    loadJson,
    deleteSchedule,
    updatePlanDay,
    updateAllPlanDaysTime,
    getDaysForSchedule,
    getRandomSafetyTip,
    shiftMealTypeTimeline,
    shiftProductTimeline,
    toggleMealEatenForDate,
    isMealEaten,
    shiftedMealsByDate,
    dayEatenByDate,
    displacedByDate,
    revertShiftAtSlot,
    replaceShiftedMealAtSlot,
  };
}
