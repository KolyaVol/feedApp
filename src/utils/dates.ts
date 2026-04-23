import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

const LOCALE_MAP: Record<string, DateFnsLocale> = {
  en: enUS,
  ru,
};

export function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseIsoDate(iso: string): Date {
  return parseISO(iso);
}

export function addDaysIso(iso: string, count: number): string {
  return formatIsoDate(addDays(parseIsoDate(iso), count));
}

export function formatIsoDateShort(iso: string, locale?: string): string {
  const d = parseIsoDate(iso);
  const fnsLocale = locale ? LOCALE_MAP[locale] : undefined;
  return format(d, "d MMM", fnsLocale ? { locale: fnsLocale } : undefined);
}

export function startOfIsoWeekMonday(iso: string): string {
  const d = parseIsoDate(iso);
  const monday = startOfWeek(d, { weekStartsOn: 1 });
  return formatIsoDate(monday);
}
