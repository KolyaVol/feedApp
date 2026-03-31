import * as Notifications from "expo-notifications";
import type { RemoteFeedSchedule } from "./types";

const REMOTE_FEED_TAG = "remote-feed-meal";

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
  _schedule: RemoteFeedSchedule,
  _startDate: string,
): Promise<void> {
  try {
    await cancelAllRemoteFeedNotifications();
  } catch {
    // ignore
  }
}

