import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "./storageKeys";

export type ThemeMode = "light" | "dark";
export type LocaleCode = "en" | "ru";

export async function getTheme(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(KEYS.THEME);
    if (v === "dark" || v === "light") return v;
  } catch {}
  return "light";
}

export async function setTheme(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME, mode);
}

export async function getLocale(): Promise<LocaleCode> {
  try {
    const v = await AsyncStorage.getItem(KEYS.LOCALE);
    if (v === "en" || v === "ru") return v;
  } catch {}
  return "ru";
}

export async function setLocale(code: LocaleCode): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOCALE, code);
}

export async function getGithubToken(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(KEYS.GITHUB_TOKEN);
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

export async function setGithubToken(token: string): Promise<void> {
  const normalized = token.trim();
  if (normalized) {
    await AsyncStorage.setItem(KEYS.GITHUB_TOKEN, normalized);
  } else {
    await AsyncStorage.removeItem(KEYS.GITHUB_TOKEN);
  }
}

export async function getLastSyncAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC_AT);
  } catch {
    return null;
  }
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAST_SYNC_AT, iso);
}
