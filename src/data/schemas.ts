import { z } from "zod";
import type { BestPracticesData, FeedDay, MealEntry } from "../types";

const MealEntrySchema: z.ZodType<MealEntry> = z.object({
  product: z.string(),
  grams: z.number(),
});

const EatenSchema = z
  .object({
    morning: z.boolean().optional(),
    lunch: z.boolean().optional(),
    evening: z.boolean().optional(),
  })
  .partial()
  .optional();

export const FeedDaySchema: z.ZodType<FeedDay> = z.object({
  id: z.string(),
  date: z.string(),
  morning: z.array(MealEntrySchema).default([]),
  lunch: z.array(MealEntrySchema).default([]),
  evening: z.array(MealEntrySchema).default([]),
  notes: z.string().default(""),
  eaten: EatenSchema,
});

export const FeedDaysSchema = z.array(FeedDaySchema);

const BestPracticesSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

export const BestPracticesSchema: z.ZodType<BestPracticesData> = z.object({
  productOrder: z
    .array(
      z.object({
        product: z.string(),
        ageMonths: z.number(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
  portionGuide: z
    .array(
      z.object({
        ageMonths: z.number(),
        mealType: z.enum(["morning", "lunch", "evening"]),
        grams: z.number(),
      }),
    )
    .default([]),
  safetyTips: z.array(z.string()),
  sections: z.array(BestPracticesSectionSchema),
  updatedAt: z.string().optional(),
});

export function parseFeedDaysLoose(value: unknown): FeedDay[] {
  if (!Array.isArray(value)) return [];
  const out: FeedDay[] = [];
  for (const item of value) {
    const result = FeedDaySchema.safeParse(item);
    if (result.success) out.push(result.data);
  }
  return out;
}

export type FeedDaysParseResult =
  | { ok: true; days: FeedDay[] }
  | { ok: false; message: string };

export function parseFeedDaysStrict(value: unknown): FeedDaysParseResult {
  if (!Array.isArray(value)) {
    return { ok: false, message: "Expected an array of feed days." };
  }
  const result = FeedDaysSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue ? issue.path.join(".") : "";
    const msg = issue ? `${path ? `${path}: ` : ""}${issue.message}` : "Invalid feed day shape.";
    return { ok: false, message: msg };
  }
  return { ok: true, days: result.data };
}

export function parseBestPractices(value: unknown): BestPracticesData | null {
  const result = BestPracticesSchema.safeParse(value);
  return result.success ? result.data : null;
}
