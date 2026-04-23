import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ModalSheet } from "../../components/ModalSheet";
import {
  GramSuggestionChips,
  ProductSuggestionChips,
} from "../../components/SuggestionChips";
import type { MealType } from "../../types";
import type { DataScreenStyles } from "./styles";

interface AddProductModalColors {
  text: string;
  placeholder: string;
}

interface AddProductModalProps {
  visible: boolean;
  mealType: MealType | null;
  styles: DataScreenStyles;
  globalStyles: {
    input: any;
    modalTitle: any;
    modalButtons: any;
    cancelBtn: any;
    cancelBtnText: any;
    saveBtn: any;
    saveBtnText: any;
    buttonDisabled: any;
  };
  colors: AddProductModalColors;
  t: (key: string) => string;
  mealLabel: (type: MealType) => string;
  product: string;
  grams: string;
  onProductChange: (value: string) => void;
  onGramsChange: (value: string) => void;
  onFocusProductField: () => void;
  onFocusGramsField: () => void;
  productSuggestions: string[];
  gramSuggestions: number[];
  onClose: () => void;
  onConfirm: () => void;
}

export function AddProductModal({
  visible,
  mealType,
  styles: s,
  globalStyles: g,
  colors,
  t,
  mealLabel,
  product,
  grams,
  onProductChange,
  onGramsChange,
  onFocusProductField,
  onFocusGramsField,
  productSuggestions,
  gramSuggestions,
  onClose,
  onConfirm,
}: AddProductModalProps) {
  return (
    <ModalSheet visible={visible} onRequestClose={onClose} animationType="slide">
      <Text style={g.modalTitle}>
        {t("dataAddProduct")} — {mealType ? mealLabel(mealType) : ""}
      </Text>
      <TextInput
        style={[g.input, { color: colors.text, marginBottom: 12 }]}
        value={product}
        onChangeText={onProductChange}
        onFocus={onFocusProductField}
        placeholder={t("product")}
        placeholderTextColor={colors.placeholder}
        autoFocus
      />
      <ProductSuggestionChips
        suggestions={productSuggestions}
        keyPrefix="modal-product-"
        wrapStyleOverride={s.modalSuggestionsRow}
        onSelect={onProductChange}
      />
      <TextInput
        style={[g.input, { color: colors.text, marginBottom: 12 }]}
        value={grams}
        onChangeText={onGramsChange}
        onFocus={onFocusGramsField}
        placeholder={`${t("dataAmount")} (${t("grams")})`}
        placeholderTextColor={colors.placeholder}
        keyboardType="numeric"
      />
      <GramSuggestionChips
        suggestions={gramSuggestions}
        keyPrefix="modal-"
        rowStyleOverride={s.modalSuggestionsRow}
        onSelect={(gram) => onGramsChange(String(gram))}
      />
      <View style={g.modalButtons}>
        <TouchableOpacity style={g.cancelBtn} onPress={onClose}>
          <Text style={g.cancelBtnText}>{t("cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[g.saveBtn, !product.trim() && g.buttonDisabled]}
          onPress={onConfirm}
          disabled={!product.trim()}
        >
          <Text style={g.saveBtnText}>{t("add")}</Text>
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}
