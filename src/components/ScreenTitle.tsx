import React from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalStyles } from "../globalStyles";

interface ScreenTitleProps {
  children: React.ReactNode;
}

export function ScreenTitle({ children }: ScreenTitleProps) {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  return <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>{children}</Text>;
}
