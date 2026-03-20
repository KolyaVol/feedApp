import type {
  RemoteFeedDayMeal,
  RemoteFeedPlanDay,
  RemoteFeedPlanWeek,
  RemoteFeedSchedule,
  RemoteFeedSlot,
} from "./types";

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

function parseAllowedProducts(v: unknown): RemoteFeedSchedule["allowed_products"] | undefined {
  if (!isRecord(v)) return undefined;
  return {
    vegetables: asStringArray(v.vegetables),
    cereals: asStringArray(v.cereals),
    fruits: asStringArray(v.fruits),
    meat: asStringArray(v.meat),
  };
}

function parseMeal(v: unknown): RemoteFeedDayMeal | null {
  if (!isRecord(v)) return null;
  const product = asString(v.product);
  const amount_grams = asNumber(v.amount_grams);
  if (!product || amount_grams === null) return null;
  return { product, amount_grams };
}

function parsePlanDay(v: unknown): RemoteFeedPlanDay | null {
  if (!isRecord(v)) return null;
  const day = asNumber(v.day);
  if (day === null) return null;
  const morning = parseMeal(v.morning);
  const lunch = Array.isArray(v.lunch)
    ? (v.lunch.map(parseMeal).filter(Boolean) as RemoteFeedDayMeal[])
    : undefined;
  const evening = Array.isArray(v.evening)
    ? (v.evening.map(parseMeal).filter(Boolean) as RemoteFeedDayMeal[])
    : undefined;
  if (!morning && !lunch?.length && !evening?.length) return null;
  return { day, notes: asString(v.notes) ?? undefined, morning: morning ?? undefined, lunch, evening };
}

function parseWeek(v: unknown): RemoteFeedPlanWeek | null {
  if (!isRecord(v)) return null;
  const week = asNumber(v.week);
  const daysRaw = v.days;
  if (week === null || !Array.isArray(daysRaw)) return null;
  const days = daysRaw.map(parsePlanDay).filter(Boolean) as RemoteFeedPlanDay[];
  if (!days.length) return null;
  return {
    week,
    focus: asString(v.focus) ?? undefined,
    notes: asString(v.notes) ?? undefined,
    allowed_products: parseAllowedProducts(v.allowed_products),
    days,
  };
}

function parseSlot(v: unknown): RemoteFeedSlot | null {
  if (!isRecord(v)) return null;
  const name = asString(v.name);
  const time = asString(v.time);
  if (!name || !time) return null;
  if (name !== "morning" && name !== "lunch" && name !== "evening") return null;
  return {
    name,
    time,
    purpose: asString(v.purpose) ?? undefined,
    rules: asStringArray(v.rules),
    activation_condition: asString(v.activation_condition) ?? undefined,
  };
}

function parseSchedule(v: unknown): RemoteFeedSchedule | null {
  if (!isRecord(v)) return null;
  const month = asNumber(v.month);
  const introRaw = v.introduction_plan;
  if (month === null || !Array.isArray(introRaw)) return null;

  const introduction_plan = introRaw.map(parseWeek).filter(Boolean) as RemoteFeedPlanWeek[];
  if (!introduction_plan.length) return null;

  return {
    month,
    breastfeeding: isRecord(v.breastfeeding)
      ? {
          on_demand:
            typeof v.breastfeeding.on_demand === "boolean"
              ? v.breastfeeding.on_demand
              : undefined,
          priority: asString(v.breastfeeding.priority) ?? undefined,
          rules: asStringArray(v.breastfeeding.rules),
        }
      : undefined,
    feeding_schedule: isRecord(v.feeding_schedule)
      ? {
          meal_slots: Array.isArray(v.feeding_schedule.meal_slots)
            ? (v.feeding_schedule.meal_slots.map(parseSlot).filter(Boolean) as RemoteFeedSlot[])
            : undefined,
        }
      : undefined,
    introduction_plan,
    hidden_risks: asStringArray(v.hidden_risks),
    allowed_products: parseAllowedProducts(v.allowed_products),
  };
}

function parseRoot(v: unknown): RemoteFeedSchedule | null {
  const direct = parseSchedule(v);
  if (direct) return direct;
  if (!isRecord(v) || !Array.isArray(v.months)) return null;
  for (const monthNode of v.months) {
    const parsed = parseSchedule(monthNode);
    if (parsed) return parsed;
  }
  return null;
}

export async function fetchRemoteJson(url: string): Promise<RemoteFeedSchedule | null> {
  try {
    const res = await fetch(withCacheBusting(url));
    if (!res.ok) return null;
    const text = await res.text();
    const clean = text.replace(/^\uFEFF/, "").replace(/,\s*([}\]])/g, "$1");
    const json = JSON.parse(clean) as unknown;
    return parseRoot(json);
  } catch {
    return null;
  }
}

