import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { useReminders } from "../hooks/useReminders";
import { usePreferences } from "../contexts/PreferencesContext";
import { timeToDate, dateToTime } from "../utils/date";
import {
  requestPermissions,
  scheduleReminder,
  cancelScheduledNotification,
  rescheduleAllReminders,
} from "../notifications/schedule";
import type { Reminder } from "../types";
import { spacing } from "../theme";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme, colors } = useTheme();
  const isDark = theme === "dark";
  const styles = useLocalStyles(colors);

  const { hideSubstitutions, setHideSubstitutions } = usePreferences();
  const {
    reminders,
    addReminder,
    updateReminder: updateReminderState,
    deleteReminder,
    refresh: refreshReminders,
  } = useReminders();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(() => new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    requestPermissions();
    rescheduleAllReminders(async (id, notificationId) => {
      await updateReminderState(id, { notificationId });
    }).then(() => refreshReminders());
  }, [refreshReminders, updateReminderState]);

  const openAdd = () => {
    setEditing(null);
    setTitle("");
    setTime(new Date());
    setModalVisible(true);
  };

  const openEdit = (item: Reminder) => {
    setEditing(item);
    setTitle(item.title);
    setTime(timeToDate(item.time));
    setModalVisible(true);
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const timeStr = dateToTime(time);
    if (editing) {
      if (editing.notificationId)
        await cancelScheduledNotification(editing.notificationId);
      const notifId = await scheduleReminder({
        ...editing,
        title: trimmed,
        time: timeStr,
      });
      await updateReminderState(editing.id, {
        title: trimmed,
        time: timeStr,
        notificationId: notifId ?? undefined,
      });
    } else {
      const added = await addReminder({
        title: trimmed,
        time: timeStr,
        enabled: true,
      });
      const notifId = await scheduleReminder(added);
      if (notifId)
        await updateReminderState(added.id, { notificationId: notifId });
    }
    setModalVisible(false);
  };

  const removeReminder = (item: Reminder) => {
    Alert.alert(
      t("remindersDeleteConfirmTitle"),
      t("remindersDeleteConfirmMessage", { name: item.title }),
      [
        { text: t("remindersCancel"), style: "cancel" },
        {
          text: t("remindersDelete"),
          style: "destructive",
          onPress: async () => {
            if (item.notificationId)
              await cancelScheduledNotification(item.notificationId);
            await deleteReminder(item.id);
          },
        },
      ],
    );
  };

  const onToggleEnabled = async (item: Reminder, enabled: boolean) => {
    if (item.notificationId && !enabled)
      await cancelScheduledNotification(item.notificationId);
    await updateReminderState(item.id, { enabled });
    if (enabled) {
      const notifId = await scheduleReminder({ ...item, enabled: true });
      if (notifId)
        await updateReminderState(item.id, { notificationId: notifId });
    } else {
      await updateReminderState(item.id, { notificationId: undefined });
    }
  };

  return (
    <ScrollView
      style={g.screenContainer}
      contentContainerStyle={g.screenContent}
    >
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("settingsTitle")}
      </Text>

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
              backgroundColor:
                locale === "en" ? colors.primary : colors.switchTrack,
            }}
          >
            <Text
              style={[
                g.textBody,
                {
                  fontWeight: "600",
                  color: locale === "en" ? "#fff" : colors.text,
                },
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
              backgroundColor:
                locale === "ru" ? colors.primary : colors.switchTrack,
            }}
          >
            <Text
              style={[
                g.textBody,
                {
                  fontWeight: "600",
                  color: locale === "ru" ? "#fff" : colors.text,
                },
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

      <View style={[g.cardRow, { marginHorizontal: 16 }]}>
        <View style={g.rowText}>
          <Text style={g.titleCard}>{t("settingsHideSubstitutions")}</Text>
          <Text style={g.subtitle}>{t("settingsHideSubstitutionsSubtitle")}</Text>
        </View>
        <Switch
          value={hideSubstitutions}
          onValueChange={setHideSubstitutions}
          trackColor={{ false: colors.switchTrack, true: colors.primary }}
        />
      </View>

      <View style={styles.section}>
        <Text style={g.titleSection}>{t("remindersScreenTitle")}</Text>
        <TouchableOpacity
          style={[g.primaryButtonOutline, styles.sectionBtn]}
          onPress={openAdd}
        >
          <Text style={g.primaryButtonOutlineText}>
            {t("remindersAddReminder")}
          </Text>
        </TouchableOpacity>
        {reminders.map((item) => (
          <View key={item.id} style={[g.cardRow, styles.reminderRow]}>
            <View style={g.rowText}>
              <Text style={g.titleCard}>{item.title}</Text>
              <Text style={g.subtitle}>{item.time}</Text>
            </View>
            <Switch
              value={item.enabled}
              onValueChange={(v) => onToggleEnabled(item, v)}
              trackColor={{ false: colors.switchTrack, true: colors.primary }}
            />
            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={g.actionBtn}
            >
              <Text style={g.linkText}>{t("remindersEdit")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeReminder(item)}
              style={g.actionBtn}
            >
              <Text style={g.deleteText}>{t("remindersDelete")}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>
              {editing
                ? t("remindersEditReminder")
                : t("remindersNewReminder")}
            </Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={title}
              onChangeText={setTitle}
              placeholder={t("remindersTitlePlaceholder")}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[g.labelMuted, styles.timeLabel]}>
                {t("remindersTime")}
              </Text>
              <Text style={g.textBody}>{dateToTime(time)}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  if (d) setTime(d);
                  setShowTimePicker(Platform.OS === "ios");
                }}
              />
            )}
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={g.cancelBtnText}>{t("remindersCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={save}>
                <Text style={g.saveBtnText}>{t("remindersSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function useLocalStyles(colors: { borderLight: string }) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginHorizontal: spacing.screenPadding,
          marginTop: spacing.contentBottom,
          paddingTop: spacing.screenPadding,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
        },
        sectionBtn: { marginTop: 8 },
        reminderRow: { marginTop: 8 },
        timeRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 20,
        },
        timeLabel: { marginRight: 12 },
      }),
    [colors],
  );
}
