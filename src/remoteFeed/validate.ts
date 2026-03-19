import { flattenScheduleDays } from "./deriveToday";
import type { RemoteFeedSchedule } from "./types";

export function getScheduleDayCount(schedule: RemoteFeedSchedule): number {
  return flattenScheduleDays(schedule).length;
}

export function isScheduleValid(schedule: RemoteFeedSchedule): boolean {
  if (!schedule.weekly_schedule?.length) return false;
  return getScheduleDayCount(schedule) >= 1;
}

export function shouldRejectFreshInFavorOfCache(
  fresh: RemoteFeedSchedule,
  cached: RemoteFeedSchedule | null,
): boolean {
  if (!cached) return false;
  return getScheduleDayCount(fresh) < getScheduleDayCount(cached);
}
