import type { MealType } from "../types";
import type { TranslationKey } from "../i18n/en";

export function mealLabel(
  t: (key: TranslationKey) => string,
  type: MealType,
): string {
  if (type === "morning") return t("mealMorning");
  if (type === "lunch") return t("mealLunch");
  return t("mealEvening");
}
