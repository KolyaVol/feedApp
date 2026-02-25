import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "../data/storageKeys";

type PreferencesContextValue = {
  hideSubstitutions: boolean;
  setHideSubstitutions: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [hideSubstitutions, setHideSubstitutionsState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEYS.HIDE_SUBSTITUTIONS).then((stored) => {
      if (stored === "true") setHideSubstitutionsState(true);
    });
  }, []);

  const setHideSubstitutions = (value: boolean) => {
    setHideSubstitutionsState(value);
    AsyncStorage.setItem(KEYS.HIDE_SUBSTITUTIONS, String(value));
  };

  const value = useMemo<PreferencesContextValue>(
    () => ({ hideSubstitutions, setHideSubstitutions }),
    [hideSubstitutions],
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
