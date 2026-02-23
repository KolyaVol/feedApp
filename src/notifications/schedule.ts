import * as Notifications from "expo-notifications";
import type { Reminder } from "../types";
import { getReminders } from "../data/reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleReminder(reminder: Reminder): Promise<string | null> {
  const granted = await requestPermissions();
  if (!granted) return null;
  const { hour, minute } = parseTime(reminder.time);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: reminder.title, body: "Baby feed reminder" },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleAllReminders(
  updateReminderNotificationId: (id: string, notificationId: string) => Promise<void>,
): Promise<void> {
  await cancelAllScheduledNotifications();
  const reminders = await getReminders();
  for (const r of reminders) {
    if (!r.enabled) continue;
    const notificationId = await scheduleReminder(r);
    if (notificationId) await updateReminderNotificationId(r.id, notificationId);
  }
}
