import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { en } from "../i18n/en";
import type { TranslationKey } from "../i18n/en";
import { ru } from "../i18n/ru";
import {
  getLocale as loadLocale,
  setLocale as persistLocale,
  type LocaleCode,
} from "../data/settings";

export type Locale = LocaleCode;

const translations: Record<Locale, Record<TranslationKey, string>> = { en, ru };

type TParams = Record<string, string | number>;

function interpolate(str: string, params?: TParams): string {
  if (!params) return str;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v)),
    str,
  );
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, params?: TParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    loadLocale().then(setLocaleState);
  }, []);

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    void persistLocale(value);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, params?: TParams) => {
      const k = key in en ? (key as TranslationKey) : null;
      const str = k ? translations[locale][k] ?? en[k] : String(key);
      return interpolate(str, params);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
