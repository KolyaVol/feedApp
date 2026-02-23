import React, { useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useBackup } from "../hooks/useBackup";
import { useEntries } from "../hooks/useEntries";
import { useFoodTypes } from "../hooks/useFoodTypes";
import { useReminders } from "../hooks/useReminders";
import { spacing } from "../theme";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { theme, setTheme, colors } = useTheme();
  const isDark = theme === "dark";
  const { refresh: refreshEntries } = useEntries();
  const { refresh: refreshFoodTypes } = useFoodTypes();
  const { refresh: refreshReminders } = useReminders();
  const refreshAll = useCallback(() => {
    refreshEntries();
    refreshFoodTypes();
    refreshReminders();
  }, [refreshEntries, refreshFoodTypes, refreshReminders]);
  const { exportData, importData, exporting, importing, message, clearMessage } =
    useBackup(refreshAll);
  const styles = useDataStyles(colors);

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>Settings</Text>
      <View style={[g.cardRow, { marginHorizontal: 16 }]}>
        <View style={g.rowText}>
          <Text style={g.titleCard}>Dark theme</Text>
          <Text style={g.subtitle}>Use dark appearance</Text>
        </View>
        <Switch
          value={isDark}
          onValueChange={(v) => setTheme(v ? "dark" : "light")}
          trackColor={{ false: colors.switchTrack, true: colors.primary }}
        />
      </View>
      <View style={styles.dataSection}>
        <Text style={g.titleSection}>Data</Text>
        <Text style={g.subtitle}>Download backup or load from file</Text>
        {message !== null && (
          <TouchableOpacity onPress={clearMessage} style={styles.messageRow}>
            <Text
              style={[
                g.textBody,
                message.startsWith("Data restored") ? styles.messageOk : styles.messageErr,
              ]}
            >
              {message}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[g.primaryButtonOutline, styles.dataBtn]}
          onPress={exportData}
          disabled={exporting || importing}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={g.primaryButtonOutlineText}>Download</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[g.primaryButtonOutline, styles.dataBtn]}
          onPress={importData}
          disabled={exporting || importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={g.primaryButtonOutlineText}>Load</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function useDataStyles(colors: { borderLight: string; primary: string; danger: string }) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        dataSection: {
          marginHorizontal: spacing.screenPadding,
          marginTop: spacing.contentBottom,
          paddingTop: spacing.screenPadding,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
        },
        dataBtn: { marginTop: 8 },
        messageRow: { marginTop: 8, paddingVertical: 4 },
        messageOk: { color: colors.primary },
        messageErr: { color: colors.danger },
      }),
    [colors],
  );
}
