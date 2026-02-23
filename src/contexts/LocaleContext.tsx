import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { en, type TranslationKey } from "../i18n/en";
import { ru } from "../i18n/ru";
import { KEYS } from "../data/storageKeys";

export type Locale = "en" | "ru";

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
  t: (key: TranslationKey, params?: TParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    AsyncStorage.getItem(KEYS.LOCALE).then((stored) => {
      if (stored === "en" || stored === "ru") setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    AsyncStorage.setItem(KEYS.LOCALE, value);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TParams) => {
      const str = translations[locale][key] ?? en[key];
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
