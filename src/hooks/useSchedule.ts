import { useCallback, useEffect, useState } from "react";
import type { PlanDay, LoadedSchedule } from "../types";
import {
  getPlanDays,
  setPlanDays,
  addPlanDays,
  updatePlanDay as updatePlanDayStorage,
  deletePlanDaysBySchedule,
  getPlanDayForDate,
  formatDateStr,
  addDays,
} from "../data/planDays";
import {
  getLoadedSchedules,
  addLoadedSchedule,
  deleteLoadedSchedule as deleteScheduleStorage,
} from "../data/loadedSchedules";
import { generateId } from "../utils/id";

interface ScheduleJson {
  month: number;
  signs_of_readiness?: string[];
  safety_guidelines?: string[];
  weekly_schedule: {
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
}

export function useSchedule() {
  const [planDays, setPlanDaysState] = useState<PlanDay[]>([]);
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([]);
  const [loading, setLoading] = useState(true);

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
    const today = formatDateStr(new Date());
    return getPlanDayForDate(planDays, today);
  }, [planDays]);

  const tomorrowPlan = useCallback((): PlanDay | undefined => {
    const tomorrow = addDays(formatDateStr(new Date()), 1);
    return getPlanDayForDate(planDays, tomorrow);
  }, [planDays]);

  const getScheduleForDay = useCallback(
    (day: PlanDay): LoadedSchedule | undefined => {
      return schedules.find((s) => s.id === day.scheduleId);
    },
    [schedules],
  );

  const loadJson = useCallback(
    async (content: string): Promise<void> => {
      const json: ScheduleJson = JSON.parse(content);
      if (!json.weekly_schedule?.length) {
        throw new Error("Invalid schedule format");
      }

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

      for (const week of json.weekly_schedule) {
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
            sourceMonth: json.month,
            weekNumber: week.week,
            scheduleId,
          });
          dayIndex++;
        }
      }

      const endDate = newDays[newDays.length - 1].date;

      const schedule: LoadedSchedule = {
        id: scheduleId,
        month: json.month,
        startDate,
        endDate,
        signsOfReadiness: json.signs_of_readiness ?? [],
        safetyGuidelines: json.safety_guidelines ?? [],
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

  const getDaysForSchedule = useCallback(
    (scheduleId: string): PlanDay[] => {
      return planDays
        .filter((d) => d.scheduleId === scheduleId)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [planDays],
  );

  const getRandomSafetyTip = useCallback((): string | undefined => {
    const allTips = schedules.flatMap((s) => s.safetyGuidelines);
    if (!allTips.length) return undefined;
    return allTips[Math.floor(Math.random() * allTips.length)];
  }, [schedules]);

  return {
    planDays,
    schedules,
    loading,
    refresh,
    todayPlan,
    tomorrowPlan,
    getScheduleForDay,
    loadJson,
    deleteSchedule,
    updatePlanDay,
    getDaysForSchedule,
    getRandomSafetyTip,
  };
}
