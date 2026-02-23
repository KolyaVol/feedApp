import React, { useState } from "react";
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
import { foodTypePresetColors, spacing } from "../theme";

const PRIORITY_OPTIONS: { value: FoodPriority | ""; label: string }[] = [
  { value: "", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "middle", label: "Middle" },
  { value: "high", label: "High" },
];

export function FoodTypesScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
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

  const openAdd = () => {
    setEditing(null);
    setName("");
    setUnit("ml");
    setColor(foodTypePresetColors[0]);
    setPriority("");
    setWeeklyMinimumAmount("");
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
    setModalVisible(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      unit,
      color,
      priority: priority || undefined,
      weeklyMinimumAmount:
        weeklyMinimumAmount.trim() === "" ? undefined : parseInt(weeklyMinimumAmount, 10),
    };
    if (Number.isNaN(payload.weeklyMinimumAmount)) payload.weeklyMinimumAmount = undefined;
    if (editing) {
      await updateFoodType(editing.id, payload);
    } else {
      await addFoodType(payload);
    }
    setModalVisible(false);
  };

  const remove = (item: FoodType) => {
    Alert.alert("Delete", `Remove "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFoodType(item.id) },
    ]);
  };

  return (
    <View style={g.screenContainer}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>Food types</Text>
      <TouchableOpacity style={g.primaryButton} onPress={openAdd}>
        <Text style={g.primaryButtonText}>+ Add new variant</Text>
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
                {item.priority != null ? ` · ${item.priority}` : ""}
                {item.weeklyMinimumAmount != null
                  ? ` · ${item.weeklyMinimumAmount} ${item.unit}/week min`
                  : ""}
              </Text>
            </View>
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
            <Text style={g.modalTitle}>{editing ? "Edit type" : "New food type"}</Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={name}
              onChangeText={setName}
              placeholder="Name (e.g. Breast, Formula)"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
            />
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit (ml, g, portion)"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={[g.labelMuted, styles.optionalLabel]}>Priority (optional)</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(({ value, label }) => (
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
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[g.labelMuted, styles.optionalLabel]}>
              Weekly minimum amount (optional)
            </Text>
            <TextInput
              style={[g.input, g.inputWithMargin]}
              value={weeklyMinimumAmount}
              onChangeText={setWeeklyMinimumAmount}
              placeholder="e.g. 500"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
            />
            <Text style={[g.labelMuted, styles.colorLabel]}>Color</Text>
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

function useFoodTypesScreenStyles(colors: {
  text: string;
  chipBg: string;
  primary: string;
  card: string;
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
      }),
    [colors],
  );
}
