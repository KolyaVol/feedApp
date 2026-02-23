import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useReminders } from "../hooks/useReminders";
import type { Reminder } from "../types";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { timeToDate, dateToTime } from "../utils/date";
import {
  requestPermissions,
  scheduleReminder,
  cancelScheduledNotification,
  rescheduleAllReminders,
} from "../notifications/schedule";

export function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { colors } = useTheme();
  const {
    reminders,
    addReminder,
    updateReminder: updateReminderState,
    deleteReminder,
    refresh,
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
    }).then(() => refresh());
  }, [refresh, updateReminderState]);

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
      if (editing.notificationId) await cancelScheduledNotification(editing.notificationId);
      const notifId = await scheduleReminder({ ...editing, title: trimmed, time: timeStr });
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
      if (notifId) await updateReminderState(added.id, { notificationId: notifId });
    }
    setModalVisible(false);
  };

  const remove = (item: Reminder) => {
    Alert.alert("Delete", `Remove "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (item.notificationId) await cancelScheduledNotification(item.notificationId);
          await deleteReminder(item.id);
        },
      },
    ]);
  };

  const onToggleEnabled = async (item: Reminder, enabled: boolean) => {
    if (item.notificationId && !enabled) await cancelScheduledNotification(item.notificationId);
    await updateReminderState(item.id, { enabled });
    if (enabled) {
      const notifId = await scheduleReminder({ ...item, enabled: true });
      if (notifId) await updateReminderState(item.id, { notificationId: notifId });
    } else {
      await updateReminderState(item.id, { notificationId: undefined });
    }
  };

  return (
    <View style={g.screenContainer}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>Reminders</Text>
      <TouchableOpacity style={g.primaryButton} onPress={openAdd}>
        <Text style={g.primaryButtonText}>+ Add reminder</Text>
      </TouchableOpacity>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={g.listContent}
        renderItem={({ item }) => (
          <View style={g.cardRow}>
            <View style={g.rowText}>
              <Text style={g.titleCard}>{item.title}</Text>
              <Text style={g.subtitle}>{item.time}</Text>
            </View>
            <Switch
              value={item.enabled}
              onValueChange={(v) => onToggleEnabled(item, v)}
              trackColor={{ false: colors.switchTrack, true: colors.primary }}
            />
            <TouchableOpacity onPress={() => openEdit(item)} style={g.actionBtn}>
              <Text style={g.linkText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(item)} style={g.actionBtn}>
              <Text style={g.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{editing ? "Edit reminder" : "New reminder"}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title (e.g. Feed time)"
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
              <Text style={[g.labelMuted, styles.timeLabel]}>Time</Text>
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
              <TouchableOpacity style={g.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={g.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={save}>
                <Text style={g.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  timeLabel: { marginRight: 12 },
});
