import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";

export function CenteredLoader() {
  const g = useGlobalStyles();
  const { colors } = useTheme();
  return (
    <View style={[g.screenContainer, styles.center]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
