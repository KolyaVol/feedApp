import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "../data/storageKeys";

type PreferencesContextValue = {
  hideSubstitutions: boolean;
  setHideSubstitutions: (value: boolean) => void;
  isDeveloper: boolean;
  setIsDeveloper: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [hideSubstitutions, setHideSubstitutionsState] = useState(false);
  const [isDeveloper, setIsDeveloperState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEYS.HIDE_SUBSTITUTIONS).then((stored) => {
      if (stored === "true") setHideSubstitutionsState(true);
    });
    AsyncStorage.getItem(KEYS.IS_DEVELOPER).then((stored) => {
      if (stored === "true") setIsDeveloperState(true);
    });
  }, []);

  const setHideSubstitutions = (value: boolean) => {
    setHideSubstitutionsState(value);
    AsyncStorage.setItem(KEYS.HIDE_SUBSTITUTIONS, String(value));
  };

  const setIsDeveloper = (value: boolean) => {
    setIsDeveloperState(value);
    AsyncStorage.setItem(KEYS.IS_DEVELOPER, String(value));
  };

  const value = useMemo<PreferencesContextValue>(
    () => ({ hideSubstitutions, setHideSubstitutions, isDeveloper, setIsDeveloper }),
    [hideSubstitutions, isDeveloper],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
