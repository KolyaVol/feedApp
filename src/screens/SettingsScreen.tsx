import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale, type Locale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";
import {
  getGithubToken,
  setGithubToken as saveGithubToken,
  getLastSyncAt,
} from "../data/settings";
import { getFeedDays, setFeedDays } from "../data/feedDays";
import type { FeedDay } from "../types";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme, colors } = useTheme();
  const s = useStyles(colors);

  const [githubToken, setGithubToken] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getGithubToken().then(setGithubToken);
    getLastSyncAt().then(setLastSync);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSaveToken = useCallback(async () => {
    await saveGithubToken(githubToken);
    showToast(t("settingsSaved"));
  }, [githubToken, showToast, t]);

  const handleExport = useCallback(async () => {
    try {
      const days = await getFeedDays();
      const json = JSON.stringify(days, null, 2);
      const file = new File(Paths.cache, "feed-data.json");
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
      showToast(t("settingsExportSuccess"));
    } catch (e: any) {
      Alert.alert(t("error"), e?.message ?? "Export failed");
    }
  }, [showToast, t]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0]!.uri;
      const importedFile = new File(uri);
      const content = await importedFile.text();
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        Alert.alert(t("error"), t("settingsImportError"));
        return;
      }
      const days = parsed as FeedDay[];
      await setFeedDays(days);
      showToast(t("settingsImportSuccess", { count: days.length }));
    } catch (e: any) {
      Alert.alert(t("error"), e?.message ?? t("settingsImportError"));
    }
  }, [showToast, t]);

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("titleSettings")}
      </Text>

      {/* Theme */}
      <View style={[s.card, { backgroundColor: colors.card }]}>
        <Text style={[s.cardLabel, { color: colors.textMuted }]}>{t("settingsTheme")}</Text>
        <View style={s.chipRow}>
          <TouchableOpacity
            style={[
              s.chip,
              { backgroundColor: theme === "light" ? colors.primary : colors.chipBg },
            ]}
            onPress={() => setTheme("light")}
          >
            <Text
              style={[s.chipText, { color: theme === "light" ? "#fff" : colors.text }]}
            >
              {t("settingsThemeLight")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.chip,
              { backgroundColor: theme === "dark" ? colors.primary : colors.chipBg },
            ]}
            onPress={() => setTheme("dark")}
          >
            <Text
              style={[s.chipText, { color: theme === "dark" ? "#fff" : colors.text }]}
            >
              {t("settingsThemeDark")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Language */}
      <View style={[s.card, { backgroundColor: colors.card }]}>
        <Text style={[s.cardLabel, { color: colors.textMuted }]}>{t("settingsLanguage")}</Text>
        <View style={s.chipRow}>
          <TouchableOpacity
            style={[
              s.chip,
              { backgroundColor: locale === "en" ? colors.primary : colors.chipBg },
            ]}
            onPress={() => setLocale("en" as Locale)}
          >
            <Text style={[s.chipText, { color: locale === "en" ? "#fff" : colors.text }]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.chip,
              { backgroundColor: locale === "ru" ? colors.primary : colors.chipBg },
            ]}
            onPress={() => setLocale("ru" as Locale)}
          >
            <Text style={[s.chipText, { color: locale === "ru" ? "#fff" : colors.text }]}>
              Русский
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* GitHub token */}
      <View style={[s.card, { backgroundColor: colors.card }]}>
        <Text style={[s.cardLabel, { color: colors.textMuted }]}>{t("settingsGithubToken")}</Text>
        <TextInput
          style={[g.input, { color: colors.text, marginBottom: 10 }]}
          value={githubToken}
          onChangeText={setGithubToken}
          placeholder={t("settingsGithubTokenPlaceholder")}
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSaveToken}
        >
          <Text style={s.saveBtnText}>{t("save")}</Text>
        </TouchableOpacity>
        <Text style={[s.syncInfo, { color: colors.textMuted }]}>
          {t("settingsLastSync")}: {lastSync ? new Date(lastSync).toLocaleString() : t("settingsNeverSynced")}
        </Text>
      </View>

      {/* Export / Import */}
      <View style={[s.card, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.chipBg }]}
          onPress={handleExport}
        >
          <Text style={[s.actionBtnText, { color: colors.text }]}>{t("settingsExport")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.chipBg }]}
          onPress={handleImport}
        >
          <Text style={[s.actionBtnText, { color: colors.text }]}>{t("settingsImport")}</Text>
        </TouchableOpacity>
      </View>

      {toast && (
        <View style={[s.toast, { backgroundColor: colors.pastelGreen }]}>
          <Text style={[s.toastText, { color: colors.text }]}>{toast}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function useStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  pastelGreen: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusLg,
          padding: 16,
          marginBottom: 14,
        },
        cardLabel: {
          fontSize: 13,
          fontFamily: fonts.medium,
          marginBottom: 10,
        },
        chipRow: {
          flexDirection: "row",
          gap: 10,
        },
        chip: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
        },
        chipText: {
          fontSize: 15,
          fontFamily: fonts.semiBold,
        },
        saveBtn: {
          paddingVertical: 12,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
        },
        saveBtnText: {
          color: "#fff",
          fontSize: 15,
          fontFamily: fonts.semiBold,
        },
        syncInfo: {
          fontSize: 12,
          fontFamily: fonts.regular,
          marginTop: 10,
          textAlign: "center",
        },
        actionBtn: {
          paddingVertical: 14,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
          marginBottom: 8,
        },
        actionBtnText: {
          fontSize: 15,
          fontFamily: fonts.medium,
        },
        toast: {
          marginHorizontal: spacing.screenPadding,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginTop: 8,
        },
        toastText: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
      }),
    [colors],
  );
}
