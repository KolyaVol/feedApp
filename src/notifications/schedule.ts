import { Platform } from "react-native";
import type { Reminder } from "../types";
import { getReminders } from "../data/reminders";
import { getPlanDays, formatDateStr, addDays, getPlanDayForDate } from "../data/planDays";

const Notifications =
  Platform.OS === "web" ? null : require("expo-notifications") as typeof import("expo-notifications");

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const PLAN_NOTIFICATION_TAG = "daily-plan-notification";

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleReminder(reminder: Reminder): Promise<string | null> {
  if (!Notifications) return null;
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
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (!Notifications) return;
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
  await scheduleDailyPlanNotification();
}

export async function scheduleDailyPlanNotification(): Promise<void> {
  if (!Notifications) return;
  const granted = await requestPermissions();
  if (!granted) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (
      n.content.data &&
      (n.content.data as Record<string, unknown>).tag === PLAN_NOTIFICATION_TAG
    ) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const days = await getPlanDays();
  const tomorrowStr = addDays(formatDateStr(new Date()), 1);
  const tomorrowPlan = getPlanDayForDate(days, tomorrowStr);

  if (!tomorrowPlan) return;

  const { hour, minute } = parseTime(tomorrowPlan.time);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${tomorrowPlan.food} ${tomorrowPlan.amountGrams}г`,
      body: tomorrowPlan.foodType,
      data: { tag: PLAN_NOTIFICATION_TAG },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
