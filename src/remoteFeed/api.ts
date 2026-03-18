import type { RemoteFeedSchedule, RemoteFeedWeek, RemoteFeedDay } from "./types";

function withCacheBusting(url: string): string {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}t=${Date.now()}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string") out.push(x);
  }
  return out;
}

function parseDay(v: unknown): RemoteFeedDay | null {
  if (!isRecord(v)) return null;
  const day = asNumber(v.day);
  const time = asString(v.time);
  const foodType = asString(v.food_type);
  const food = asString(v.food);
  const amountGrams = asNumber(v.amount_grams);
  if (day === null || !time || !foodType || !food || amountGrams === null) return null;

  const substitutions = asStringArray(v.substitutions);
  const notes = asString(v.notes) ?? undefined;

  return {
    day,
    time,
    food_type: foodType,
    food,
    amount_grams: amountGrams,
    substitutions,
    notes,
  };
}

function parseWeek(v: unknown): RemoteFeedWeek | null {
  if (!isRecord(v)) return null;
  const week = asNumber(v.week);
  const daysRaw = v.days;
  if (week === null || !Array.isArray(daysRaw)) return null;

  const days: RemoteFeedDay[] = [];
  for (const d of daysRaw) {
    const parsed = parseDay(d);
    if (parsed) days.push(parsed);
  }
  if (!days.length) return null;

  return { week, days };
}

function parseSchedule(v: unknown): RemoteFeedSchedule | null {
  if (!isRecord(v)) return null;
  const month = asNumber(v.month);
  const weeklyRaw = v.weekly_schedule;
  if (month === null || !Array.isArray(weeklyRaw)) return null;

  const weekly_schedule: RemoteFeedWeek[] = [];
  for (const w of weeklyRaw) {
    const parsed = parseWeek(w);
    if (parsed) weekly_schedule.push(parsed);
  }
  if (!weekly_schedule.length) return null;

  const signs_of_readiness = asStringArray(v.signs_of_readiness);
  const safety_guidelines = asStringArray(v.safety_guidelines);

  return {
    month,
    weekly_schedule,
    signs_of_readiness,
    safety_guidelines,
  };
}

export async function fetchRemoteJson(url: string): Promise<RemoteFeedSchedule | null> {
  try {
    const res = await fetch(withCacheBusting(url));
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return parseSchedule(json);
  } catch {
    return null;
  }
}

