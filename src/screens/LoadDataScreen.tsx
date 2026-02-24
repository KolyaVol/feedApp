import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useSchedule } from "../hooks/useSchedule";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";
import type { PlanDay } from "../types";

export function LoadDataScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useLocalStyles(colors);
  const {
    schedules,
    loading,
    refresh,
    loadJson,
    deleteSchedule,
    getDaysForSchedule,
    updatePlanDay,
  } = useSchedule();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<PlanDay | null>(null);
  const [editFood, setEditFood] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubs, setEditSubs] = useState("");
  const [importing, setImporting] = useState(false);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteText, setPasteText] = useState("");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setImporting(true);
      const pickedFile = new File(result.assets[0]);
      const content = pickedFile.textSync();
      await loadJson(content);
      setImporting(false);
    } catch (e: any) {
      setImporting(false);
      Alert.alert(t("loadDataError"), e.message ?? String(e));
    }
  };

  const handlePasteJson = async () => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    try {
      setImporting(true);
      await loadJson(trimmed);
      setImporting(false);
      setPasteModalVisible(false);
      setPasteText("");
    } catch (e: any) {
      setImporting(false);
      Alert.alert(t("loadDataError"), e.message ?? String(e));
    }
  };

  const handleDelete = (scheduleId: string) => {
    Alert.alert(t("loadDataDeleteTitle"), t("loadDataDeleteMessage"), [
      { text: t("loadDataCancel"), style: "cancel" },
      {
        text: t("loadDataDelete"),
        style: "destructive",
        onPress: async () => {
          await deleteSchedule(scheduleId);
          if (expandedId === scheduleId) setExpandedId(null);
        },
      },
    ]);
  };

  const openEditDay = (day: PlanDay) => {
    setEditingDay(day);
    setEditFood(day.food);
    setEditAmount(String(day.amountGrams));
    setEditNotes(day.notes ?? "");
    setEditSubs(day.substitutions.join(", "));
  };

  const saveDay = async () => {
    if (!editingDay) return;
    const amount = parseInt(editAmount, 10);
    if (isNaN(amount) || amount < 0) return;
    await updatePlanDay(editingDay.id, {
      food: editFood.trim(),
      amountGrams: amount,
      notes: editNotes.trim() || undefined,
      substitutions: editSubs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setEditingDay(null);
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  };

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={g.screenContainer}>
      <ScrollView contentContainerStyle={g.screenContent}>
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("loadDataTitle")}
        </Text>

        <TouchableOpacity
          style={g.primaryButton}
          onPress={handlePickFile}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={g.primaryButtonText}>{t("loadDataLoadMonth")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={g.primaryButtonOutline}
          onPress={() => setPasteModalVisible(true)}
          disabled={importing}
        >
          <Text style={g.primaryButtonOutlineText}>
            {t("loadDataPasteJson")}
          </Text>
        </TouchableOpacity>

        {schedules.length === 0 ? (
          <View style={g.emptyBox}>
            <Text style={g.emptyText}>{t("loadDataEmpty")}</Text>
          </View>
        ) : (
          schedules.map((schedule) => {
            const isExpanded = expandedId === schedule.id;
            const days = isExpanded ? getDaysForSchedule(schedule.id) : [];
            return (
              <View key={schedule.id} style={styles.scheduleCard}>
                <TouchableOpacity
                  style={styles.scheduleHeader}
                  onPress={() =>
                    setExpandedId(isExpanded ? null : schedule.id)
                  }
                >
                  <View style={styles.scheduleInfo}>
                    <Text style={g.titleCard}>
                      {t("loadDataMonth")} {schedule.month}
                    </Text>
                    <Text style={g.subtitle}>
                      {formatDateDisplay(schedule.startDate)} —{" "}
                      {formatDateDisplay(schedule.endDate)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(schedule.id)}
                    style={g.actionBtn}
                  >
                    <Text style={g.deleteText}>{t("loadDataDelete")}</Text>
                  </TouchableOpacity>
                  <Text style={styles.expandIcon}>
                    {isExpanded ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.daysList}>
                    {days.map((day) => (
                      <TouchableOpacity
                        key={day.id}
                        style={styles.dayRow}
                        onPress={() => openEditDay(day)}
                      >
                        <View style={styles.dayDate}>
                          <Text style={styles.dayDateText}>
                            {formatDateDisplay(day.date)}
                          </Text>
                        </View>
                        <View style={styles.dayInfo}>
                          <Text style={g.titleCard}>{day.food}</Text>
                          <Text style={g.subtitle}>
                            {day.amountGrams}{t("loadDataGrams")} · {day.foodType}
                          </Text>
                        </View>
                        <Text style={styles.editIcon}>✎</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={pasteModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("loadDataPasteJson")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin, styles.pasteInput]}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder={t("loadDataPastePlaceholder")}
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
            />
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => {
                  setPasteModalVisible(false);
                  setPasteText("");
                }}
              >
                <Text style={g.cancelBtnText}>{t("loadDataCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[g.saveBtn, !pasteText.trim() && styles.disabled]}
                onPress={handlePasteJson}
                disabled={!pasteText.trim() || importing}
              >
                {importing ? (
                  <ActivityIndicator color={colors.card} size="small" />
                ) : (
                  <Text style={g.saveBtnText}>{t("loadDataLoadBtn")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingDay} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("loadDataEditDay")}</Text>

            <Text style={g.labelMuted}>{t("loadDataFood")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={editFood}
              onChangeText={setEditFood}
              placeholderTextColor={colors.placeholder}
            />

            <Text style={g.labelMuted}>{t("loadDataAmount")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="numeric"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={g.labelMuted}>{t("loadDataSubstitutions")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={editSubs}
              onChangeText={setEditSubs}
              placeholder={t("loadDataSubsPlaceholder")}
              placeholderTextColor={colors.placeholder}
            />

            <Text style={g.labelMuted}>{t("loadDataNotes")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholderTextColor={colors.placeholder}
            />

            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => setEditingDay(null)}
              >
                <Text style={g.cancelBtnText}>{t("loadDataCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={saveDay}>
                <Text style={g.saveBtnText}>{t("loadDataSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function useLocalStyles(colors: {
  card: string;
  border: string;
  borderLight: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { justifyContent: "center", alignItems: "center" },
        scheduleCard: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 12,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          overflow: "hidden",
        },
        scheduleHeader: {
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
        },
        scheduleInfo: { flex: 1 },
        expandIcon: {
          fontSize: 12,
          color: colors.textMuted,
          marginLeft: 8,
        },
        daysList: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
        },
        dayRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        dayDate: {
          width: 60,
          marginRight: 10,
        },
        dayDateText: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.medium,
        },
        dayInfo: { flex: 1 },
        editIcon: {
          fontSize: 18,
          color: colors.primary,
          marginLeft: 8,
        },
        pasteInput: {
          height: 200,
          fontFamily: fonts.regular,
          fontSize: 13,
        },
        disabled: {
          opacity: 0.5,
        },
      }),
    [colors],
  );
}
