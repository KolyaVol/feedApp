import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getColors, type ThemeMode } from "../theme";
import type { ColorSet } from "../theme";
import { KEYS } from "../data/storageKeys";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  colors: ColorSet;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(KEYS.THEME).then((stored) => {
      if (stored === "dark" || stored === "light") setThemeState(stored);
    });
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(KEYS.THEME, mode);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      colors: getColors(theme),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
