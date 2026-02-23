import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import type { FoodType } from "../types";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";

function isLightBg(hex: string): boolean {
  const m = hex.replace(/^#/, "").match(/.{2}/g);
  if (!m) return false;
  const r = parseInt(m[0], 16) / 255;
  const g = parseInt(m[1], 16) / 255;
  const b = parseInt(m[2], 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.55;
}

interface QuickAddFormProps {
  foodTypes: FoodType[];
  onAdd: (foodTypeId: string, amount: number) => Promise<void>;
  chipBackgroundByFoodTypeId?: Record<string, string>;
}

export function QuickAddForm({ foodTypes, onAdd, chipBackgroundByFoodTypeId }: QuickAddFormProps) {
  const g = useGlobalStyles();
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<string>(foodTypes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (foodTypes.length && !foodTypes.some((f) => f.id === selectedId)) {
      setSelectedId(foodTypes[0].id);
    }
  }, [foodTypes, selectedId]);

  const selected = foodTypes.find((f) => f.id === selectedId);
  const unit = selected?.unit ?? "";

  const handleAdd = async () => {
    const num = parseInt(amount, 10);
    if (!selectedId || isNaN(num) || num <= 0) {
      Alert.alert("Invalid input", "Select a food type and enter a positive amount.");
      return;
    }
    setLoading(true);
    try {
      await onAdd(selectedId, num);
      setAmount("");
    } finally {
      setLoading(false);
    }
  };

  if (!foodTypes.length) {
    return (
      <View style={g.emptyBox}>
        <Text style={g.emptyText}>Add a food type first</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={g.formCard}
    >
      <View style={g.formRow}>
        <View style={g.pickerWrap}>
          {foodTypes.map((f) => {
            const bgColor = chipBackgroundByFoodTypeId?.[f.id];
            const isSelected = selectedId === f.id;
            const useDarkChipText = bgColor != null && isLightBg(bgColor);
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  g.chip,
                  bgColor != null && { backgroundColor: bgColor },
                  isSelected && (bgColor != null ? g.chipSelectedBorderOnly : g.chipSelected),
                ]}
                onPress={() => setSelectedId(f.id)}
              >
                <View style={[g.chipDot, { backgroundColor: f.color }]} />
                <Text style={[g.chipText, useDarkChipText && { color: "#333" }]}>{f.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={g.formRow}>
        <TextInput
          style={[g.input, g.inputFlex]}
          value={amount}
          onChangeText={setAmount}
          placeholder={`Amount (${unit})`}
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
        />
        <Text style={[g.labelMuted, g.unitLabel]}>{unit}</Text>
      </View>
      <TouchableOpacity
        style={[g.buttonFull, loading && g.buttonDisabled]}
        onPress={handleAdd}
        disabled={loading}
      >
        <Text style={g.buttonFullText}>{loading ? "Adding…" : "Add entry"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
