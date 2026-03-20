import * as Notifications from "expo-notifications";
import type { Reminder } from "../types";
import { getReminders } from "../data/reminders";
import { getPlanDays, formatDateStr, addDays, getPlanDayForDate } from "../data/planDays";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "../data/storageKeys";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PLAN_NOTIFICATION_TAG = "daily-plan-notification";

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

function parseMealMetaLine(notes: string | undefined, prefix: "__lunch=" | "__evening="): { product: string; amount: number } | null {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((x) => x.trim())
    .find((x) => x.startsWith(prefix));
  if (!line) return null;
  const [productRaw, amountRaw] = line.slice(prefix.length).split("|");
  const product = (productRaw ?? "").trim();
  const amount = parseInt((amountRaw ?? "").trim(), 10);
  if (!product || !Number.isFinite(amount)) return null;
  return { product, amount };
}

async function getNotificationContext(reminder: Reminder): Promise<{ body: string }> {
  const allDays = await getPlanDays();
  const realToday = formatDateStr(new Date());
  const storedProgress = await AsyncStorage.getItem(KEYS.PROGRESS_DATE);
  const progressDate = storedProgress && /^\d{4}-\d{2}-\d{2}$/.test(storedProgress) ? storedProgress : realToday;
  const plan = getPlanDayForDate(allDays, progressDate);
  if (!plan) return { body: "Baby feed notification" };

  let foodLine = `${plan.food} ${plan.amountGrams}g`;
  let linkedMealMissing = false;
  if (reminder.linkedMealType === "lunch") {
    const lunch = parseMealMetaLine(plan.notes, "__lunch=");
    if (lunch) foodLine = `${lunch.product} ${lunch.amount}g`;
    else linkedMealMissing = true;
  } else if (reminder.linkedMealType === "evening") {
    const evening = parseMealMetaLine(plan.notes, "__evening=");
    if (evening) foodLine = `${evening.product} ${evening.amount}g`;
    else linkedMealMissing = true;
  }
  if (linkedMealMissing) foodLine = `${foodLine}\nLinked meal not found, using main meal`;

  const sameSchedule = allDays
    .filter((d) => d.scheduleId === plan.scheduleId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const endDate = sameSchedule[sameSchedule.length - 1]?.date;
  if (!endDate) return { body: foodLine };
  const remaining = Math.floor(
    (new Date(endDate + "T00:00:00").getTime() - new Date(progressDate + "T00:00:00").getTime()) / 86400000,
  );
  if (remaining <= 7) return { body: `${foodLine}\n${Math.max(0, remaining)} days remaining in schedule` };
  return { body: foodLine };
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
  const context = await getNotificationContext(reminder);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: reminder.title, body: context.body },
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
  await scheduleDailyPlanNotification();
}

const PLAN_NOTIFICATION_DAYS_AHEAD = 14;

function dateAtTime(dateStr: string, time: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const { hour, minute } = parseTime(time);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
}

export async function scheduleDailyPlanNotification(): Promise<void> {
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
  const realToday = formatDateStr(new Date());
  const now = Date.now();

  for (let i = 0; i < PLAN_NOTIFICATION_DAYS_AHEAD; i++) {
    const dateStr = addDays(realToday, i);
    const plan = getPlanDayForDate(days, dateStr);
    if (!plan) continue;
    const triggerDate = dateAtTime(dateStr, plan.time);
    if (triggerDate.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${plan.food} ${plan.amountGrams}г`,
        body: plan.foodType,
        data: { tag: PLAN_NOTIFICATION_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
}
