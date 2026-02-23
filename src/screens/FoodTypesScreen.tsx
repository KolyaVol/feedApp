import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFoodTypes } from "../hooks/useFoodTypes";
import type { FoodType, FoodPriority } from "../types";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { foodTypePresetColors, fonts, spacing } from "../theme";
import type { TranslationKey } from "../i18n/en";

const PRIORITY_OPTIONS: { value: FoodPriority | ""; labelKey: TranslationKey }[] = [
  { value: "", labelKey: "foodTypesNoPriority" },
  { value: "low", labelKey: "foodTypesLow" },
  { value: "middle", labelKey: "foodTypesMiddle" },
  { value: "high", labelKey: "foodTypesHigh" },
];

const PRIORITY_LABEL_KEYS: Record<FoodPriority, TranslationKey> = {
  low: "foodTypesLow",
  middle: "foodTypesMiddle",
  high: "foodTypesHigh",
};

export function FoodTypesScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useFoodTypesScreenStyles(colors);
  const { foodTypes, addFoodType, updateFoodType, deleteFoodType } = useFoodTypes();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FoodType | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ml");
  const [color, setColor] = useState<string>(foodTypePresetColors[0]);
  const [priority, setPriority] = useState<FoodPriority | "">("");
  const [weeklyMinimumAmount, setWeeklyMinimumAmount] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showRandomColorBtn, setShowRandomColorBtn] = useState(false);
  const sameColorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const existingWithSameColor = foodTypes.filter(
    (f) => f.color === color && f.id !== (editing?.id ?? "")
  );
  const hasDuplicateColor = existingWithSameColor.length > 0;

  useEffect(() => {
    if (!modalVisible || !hasDuplicateColor) {
      setShowRandomColorBtn(false);
      if (sameColorTimerRef.current) {
        clearTimeout(sameColorTimerRef.current);
        sameColorTimerRef.current = null;
      }
      return;
    }
    sameColorTimerRef.current = setTimeout(() => setShowRandomColorBtn(true), 5000);
    return () => {
      if (sameColorTimerRef.current) {
        clearTimeout(sameColorTimerRef.current);
        sameColorTimerRef.current = null;
      }
    };
  }, [modalVisible, hasDuplicateColor, color]);

  const pickRandomUnusedColor = () => {
    const used = new Set(
      foodTypes.filter((f) => f.id !== editing?.id).map((f) => f.color)
    );
    const available = foodTypePresetColors.filter((c) => !used.has(c));
    if (available.length) {
      setColor(available[Math.floor(Math.random() * available.length)]);
      setShowRandomColorBtn(false);
      if (sameColorTimerRef.current) {
        clearTimeout(sameColorTimerRef.current);
        sameColorTimerRef.current = null;
      }
    }
  };

  const openAdd = () => {
    setEditing(null);
    setName("");
    setUnit("ml");
    setColor(foodTypePresetColors[0]);
    setPriority("");
    setWeeklyMinimumAmount("");
    setToastMessage(null);
    setShowRandomColorBtn(false);
    setModalVisible(true);
  };

  const openEdit = (item: FoodType) => {
    setEditing(item);
    setName(item.name);
    setUnit(item.unit);
    setColor(item.color);
    setPriority(item.priority ?? "");
    setWeeklyMinimumAmount(
      item.weeklyMinimumAmount != null ? String(item.weeklyMinimumAmount) : "",
    );
    setToastMessage(null);
    setShowRandomColorBtn(false);
    setModalVisible(true);
  };

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setToastMessage(t("foodTypesEnterName"));
      return;
    }
    const trimmedUnit = unit.trim();
    if (!trimmedUnit) {
      setToastMessage(t("foodTypesEnterUnit"));
      return;
    }
    const weeklyNum =
      weeklyMinimumAmount.trim() === ""
        ? undefined
        : parseInt(weeklyMinimumAmount, 10);
    if (
      weeklyMinimumAmount.trim() !== "" &&
      (weeklyNum === undefined || Number.isNaN(weeklyNum) || weeklyNum < 0)
    ) {
      setToastMessage(t("foodTypesWeeklyMinPositive"));
      return;
    }
    const payload = {
      name: trimmedName,
      unit: trimmedUnit,
      color,
      priority: priority || undefined,
      ...(weeklyNum !== undefined && !Number.isNaN(weeklyNum)
        ? { weeklyMinimumAmount: weeklyNum }
        : {}),
    };
    if (editing) {
      await updateFoodType(editing.id, payload);
    } else {
      await addFoodType(payload);
    }
    setModalVisible(false);
  };

  const saveDisabled = !name.trim();

  const remove = (item: FoodType) => {
    Alert.alert(
      t("foodTypesDeleteConfirmTitle"),
      t("foodTypesDeleteConfirmMessage", { name: item.name }),
      [
        { text: t("foodTypesCancel"), style: "cancel" },
        { text: t("foodTypesDelete"), style: "destructive", onPress: () => deleteFoodType(item.id) },
      ],
    );
  };

  return (
    <View style={g.screenContainer}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>{t("foodTypesScreenTitle")}</Text>
      <TouchableOpacity style={g.primaryButton} onPress={openAdd}>
        <Text style={g.primaryButtonText}>{t("foodTypesAddNewVariant")}</Text>
      </TouchableOpacity>
      <FlatList
        data={foodTypes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={g.listContent}
        renderItem={({ item }) => (
          <View style={g.cardRow}>
            <View style={[g.cardDot, { backgroundColor: item.color }]} />
            <View style={g.rowText}>
              <Text style={g.titleCard}>{item.name}</Text>
              <Text style={g.subtitle}>
                {item.unit}
                {item.priority != null ? ` · ${t(PRIORITY_LABEL_KEYS[item.priority])}` : ""}
                {item.weeklyMinimumAmount != null
                  ? ` · ${item.weeklyMinimumAmount} ${item.unit}${t("foodTypesWeeklyMinSuffix")}`
                  : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={g.actionBtn}>
              <Text style={g.linkText}>{t("foodTypesEdit")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(item)} style={g.actionBtn}>
              <Text style={g.deleteText}>{t("foodTypesDelete")}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            {toastMessage ? (
              <View style={styles.toast}>
                <Text style={styles.toastText}>{toastMessage}</Text>
              </View>
            ) : null}
            <Text style={g.modalTitle}>{editing ? t("foodTypesEditType") : t("foodTypesNewFoodType")}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={name}
              onChangeText={setName}
              placeholder={t("foodTypesNamePlaceholder")}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
            />
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={unit}
              onChangeText={setUnit}
              placeholder={t("foodTypesUnitPlaceholder")}
              placeholderTextColor={colors.placeholder}
            />
            <Text style={[g.labelMuted, styles.optionalLabel]}>{t("foodTypesPriorityOptional")}</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(({ value, labelKey }) => (
                <TouchableOpacity
                  key={value || "none"}
                  style={[styles.priorityChip, priority === value && styles.priorityChipSelected]}
                  onPress={() => setPriority(value)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      priority === value && styles.priorityChipTextSelected,
                    ]}
                  >
                    {t(labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[g.labelMuted, styles.optionalLabel]}>
              {t("foodTypesWeeklyMinOptional")}
            </Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={weeklyMinimumAmount}
              onChangeText={setWeeklyMinimumAmount}
              placeholder="e.g. 500"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
            />
            <Text style={[g.labelMuted, styles.colorLabel]}>{t("foodTypesColor")}</Text>
            {hasDuplicateColor ? (
              <View style={styles.duplicateColorTip}>
                <Text style={styles.duplicateColorTipText}>
                  {t("foodTypesColorUsedBy", {
                    names: existingWithSameColor.map((f) => f.name).join(", "),
                  })}
                </Text>
                {showRandomColorBtn ? (
                  <TouchableOpacity
                    style={styles.randomColorBtn}
                    onPress={pickRandomUnusedColor}
                  >
                    <Text style={styles.randomColorBtnText}>{t("foodTypesChooseRandom")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorScroll}
              contentContainerStyle={styles.colorScrollContent}
            >
              <View style={styles.colorRows}>
                {[0, 1].map((rowIndex) => {
                  const half = Math.ceil(foodTypePresetColors.length / 2);
                  const rowColors =
                    rowIndex === 0
                      ? foodTypePresetColors.slice(0, half)
                      : foodTypePresetColors.slice(half);
                  return (
                    <View key={rowIndex} style={styles.colorRow}>
                      {rowColors.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.colorOption,
                            { backgroundColor: c },
                            color === c && styles.colorOptionSelected,
                          ]}
                          onPress={() => setColor(c)}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={g.modalButtons}>
              <TouchableOpacity style={g.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={g.cancelBtnText}>{t("foodTypesCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[g.saveBtn, saveDisabled && styles.saveBtnDisabled]}
                onPress={save}
                disabled={saveDisabled}
              >
                <Text style={g.saveBtnText}>{t("foodTypesSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function useFoodTypesScreenStyles(colors: {
  text: string;
  textMuted: string;
  chipBg: string;
  primary: string;
  card: string;
  background: string;
  border: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        optionalLabel: { marginBottom: 8 },
        colorLabel: { marginBottom: 8 },
        colorScroll: { marginBottom: 20 },
        colorScrollContent: { paddingRight: 8 },
        colorRows: { flexDirection: "column" },
        colorRow: { flexDirection: "row", marginBottom: 8 },
        colorOption: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
        colorOptionSelected: { borderWidth: 3, borderColor: colors.text },
        priorityRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.radiusMd,
          marginBottom: 16,
        },
        priorityChip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: spacing.radiusMd,
          backgroundColor: colors.chipBg,
        },
        priorityChipSelected: { backgroundColor: colors.primary },
        priorityChipText: { fontSize: 14, color: colors.text },
        priorityChipTextSelected: { color: colors.card, fontWeight: "600" },
        toast: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 12,
        },
        toastText: { fontSize: 14, color: colors.text, fontFamily: fonts.regular },
        duplicateColorTip: {
          marginBottom: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: colors.chipBg,
          borderRadius: spacing.radiusMd,
        },
        duplicateColorTipText: {
          fontSize: 13,
          color: colors.textMuted,
          marginBottom: 8,
        },
        randomColorBtn: {
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: colors.primary,
          borderRadius: spacing.radiusMd,
        },
        randomColorBtnText: { fontSize: 14, color: colors.card, fontWeight: "600" },
        saveBtnDisabled: { opacity: 0.5 },
      }),
    [colors],
  );
}
