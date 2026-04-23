import type { FeedDay, MealEntry, MealType } from "../types";

const MEAL_TYPES: MealType[] = ["morning", "lunch", "evening"];
const MEAL_TAG: Record<MealType, string> = {
  morning: "M",
  lunch: "L",
  evening: "E",
};

function escapeField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/:/g, "\\:");
}

function formatEntries(entries: MealEntry[]): string {
  return entries
    .map((entry) => {
      const product = escapeField((entry.product ?? "").trim());
      if (!product) return null;
      const grams =
        typeof entry.grams === "number" && !isNaN(entry.grams) && entry.grams > 0
          ? entry.grams
          : 0;
      return `${product}:${grams}`;
    })
    .filter((v): v is string => !!v)
    .join(",");
}

function formatDay(day: FeedDay): string {
  const parts: string[] = [day.date];
  for (const type of MEAL_TYPES) {
    const entries = day[type];
    if (!entries || entries.length === 0) continue;
    const formatted = formatEntries(entries);
    if (!formatted) continue;
    parts.push(`${MEAL_TAG[type]} ${formatted}`);
  }
  const notes = (day.notes ?? "").trim();
  if (notes) {
    parts.push(`n ${notes.replace(/\s+/g, " ")}`);
  }
  const eaten = day.eaten;
  if (eaten) {
    const flags = MEAL_TYPES.filter((m) => eaten[m]).map((m) => MEAL_TAG[m]);
    if (flags.length > 0) parts.push(`e ${flags.join("")}`);
  }
  return parts.join("|");
}

export function formatDaysForChat(days: FeedDay[]): string {
  const header =
    '# Feed log. Fields: DATE|M=morning,L=lunch,E=evening items as "product:grams" comma-sep|n:notes|e:eaten flags. Empty meals omitted.';
  const body = days.map(formatDay).join("\n");
  return body ? `${header}\n${body}` : header;
}
