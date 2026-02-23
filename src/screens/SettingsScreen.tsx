import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { useBackup } from "../hooks/useBackup";
import { useEntries } from "../hooks/useEntries";
import { useFoodTypes } from "../hooks/useFoodTypes";
import { useReminders } from "../hooks/useReminders";
import { getBackupEmailSettings, setBackupEmailSettings } from "../data/backupEmailSettings";
import { spacing } from "../theme";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale, setLocale } = useLocale();
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
  const {
    exportData,
    importData,
    sendToEmail,
    exporting,
    importing,
    sendingToEmail,
    message,
    isSuccess,
    clearMessage,
  } = useBackup(refreshAll);
  const [backupEmail, setBackupEmail] = useState("");
  const [backupSubject, setBackupSubject] = useState("");

  useEffect(() => {
    getBackupEmailSettings().then((s) => {
      setBackupEmail(s.email);
      setBackupSubject(s.subject ?? "");
    });
  }, []);

  const saveBackupEmailSettings = useCallback(() => {
    setBackupEmailSettings({
      email: backupEmail.trim(),
      subject: backupSubject.trim() || undefined,
    });
  }, [backupEmail, backupSubject]);

  const styles = useDataStyles(colors);

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>{t("settingsTitle")}</Text>
      <View style={[g.cardRow, { marginHorizontal: 16 }]}>
        <View style={g.rowText}>
          <Text style={g.titleCard}>{t("settingsLanguage")}</Text>
          <Text style={g.subtitle}>
            {t("settingsEnglish")} / {t("settingsRussian")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setLocale("en")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: locale === "en" ? colors.primary : colors.switchTrack,
            }}
          >
            <Text
              style={[
                g.textBody,
                { fontWeight: "600", color: locale === "en" ? "#fff" : colors.text },
              ]}
            >
              {t("settingsEnglish")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLocale("ru")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: locale === "ru" ? colors.primary : colors.switchTrack,
            }}
          >
            <Text
              style={[
                g.textBody,
                { fontWeight: "600", color: locale === "ru" ? "#fff" : colors.text },
              ]}
            >
              {t("settingsRussian")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[g.cardRow, { marginHorizontal: 16 }]}>
        <View style={g.rowText}>
          <Text style={g.titleCard}>{t("settingsDarkTheme")}</Text>
          <Text style={g.subtitle}>{t("settingsDarkThemeSubtitle")}</Text>
        </View>
        <Switch
          value={isDark}
          onValueChange={(v) => setTheme(v ? "dark" : "light")}
          trackColor={{ false: colors.switchTrack, true: colors.primary }}
        />
      </View>
      <View style={styles.dataSection}>
        <Text style={g.titleSection}>{t("settingsData")}</Text>
        <Text style={g.subtitle}>{t("settingsDataSubtitle")}</Text>
        {message !== null && (
          <TouchableOpacity onPress={clearMessage} style={styles.messageRow}>
            <Text
              style={[
                g.textBody,
                isSuccess ? styles.messageOk : styles.messageErr,
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
            <Text style={g.primaryButtonOutlineText}>{t("settingsDownload")}</Text>
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
            <Text style={g.primaryButtonOutlineText}>{t("settingsLoad")}</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.dataSection}>
        <Text style={g.titleSection}>{t("settingsBackupByEmail")}</Text>
        <Text style={g.subtitle}>{t("settingsBackupByEmailSubtitle")}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.borderLight }]}
          placeholder={t("settingsBackupEmailPlaceholder")}
          placeholderTextColor={colors.placeholder}
          value={backupEmail}
          onChangeText={setBackupEmail}
          onBlur={saveBackupEmailSettings}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.borderLight }]}
          placeholder={t("settingsBackupSubjectPlaceholder")}
          placeholderTextColor={colors.placeholder}
          value={backupSubject}
          onChangeText={setBackupSubject}
          onBlur={saveBackupEmailSettings}
        />
        <TouchableOpacity
          style={[g.primaryButtonOutline, styles.dataBtn]}
          onPress={sendToEmail}
          disabled={exporting || importing || sendingToEmail || !backupEmail.trim()}
        >
          {sendingToEmail ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={g.primaryButtonOutlineText}>{t("backupSendToEmail")}</Text>
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
        input: {
          marginTop: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          fontSize: 16,
        },
      }),
    [colors],
  );
}
