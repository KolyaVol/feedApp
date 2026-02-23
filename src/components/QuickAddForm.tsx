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
import { g } from "../globalStyles";

interface QuickAddFormProps {
  foodTypes: FoodType[];
  onAdd: (foodTypeId: string, amount: number) => Promise<void>;
  chipBackgroundByFoodTypeId?: Record<string, string>;
}

export function QuickAddForm({ foodTypes, onAdd, chipBackgroundByFoodTypeId }: QuickAddFormProps) {
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
                <Text style={g.chipText}>{f.name}</Text>
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
          placeholderTextColor="#999"
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
