import * as Notifications from "expo-notifications";
import type { RemoteFeedSchedule } from "./types";
import { getTodayFromSchedule } from "./deriveToday";
import { requestPermissions } from "../notifications/schedule";

const REMOTE_FEED_TAG = "remote-feed-meal";

function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export async function cancelAllRemoteFeedNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content.data as any)?.tag === REMOTE_FEED_TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}

export async function scheduleMealsFromFeedData(
  schedule: RemoteFeedSchedule,
  startDate: string,
): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    const today = getTodayFromSchedule(schedule, startDate);
    if (!today) return;

    await cancelAllRemoteFeedNotifications();

    for (const meal of today.meals) {
      const parsedTime = parseTime(meal.time);
      if (!parsedTime) continue;
      const body = meal.notes ? `${meal.food} — ${meal.notes}` : meal.food;

      await Notifications.scheduleNotificationAsync({
        content: { title: "Feeding time", body, data: { tag: REMOTE_FEED_TAG } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsedTime.hour,
          minute: parsedTime.minute,
        },
      });
    }
  } catch {
    // ignore
  }
}

