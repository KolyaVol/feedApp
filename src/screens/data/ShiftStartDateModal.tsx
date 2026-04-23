import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ModalSheet } from "../../components/ModalSheet";

interface ShiftStartDateModalColors {
  text: string;
  placeholder: string;
}

interface ShiftStartDateModalProps {
  visible: boolean;
  value: string;
  globalStyles: {
    input: any;
    modalTitle: any;
    modalButtons: any;
    labelMuted: any;
    cancelBtn: any;
    cancelBtnText: any;
    saveBtn: any;
    saveBtnText: any;
  };
  colors: ShiftStartDateModalColors;
  t: (key: string) => string;
  onChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export function ShiftStartDateModal({
  visible,
  value,
  globalStyles: g,
  colors,
  t,
  onChange,
  onClose,
  onApply,
}: ShiftStartDateModalProps) {
  return (
    <ModalSheet visible={visible} onRequestClose={onClose}>
      <Text style={g.modalTitle}>{t("dataStartDateTitle")}</Text>
      <Text style={[g.labelMuted, { marginBottom: 10 }]}>{t("dataStartDateHint")}</Text>
      <TextInput
        style={[g.input, { color: colors.text, marginBottom: 12 }]}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={g.modalButtons}>
        <TouchableOpacity style={g.cancelBtn} onPress={onClose}>
          <Text style={g.cancelBtnText}>{t("cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={g.saveBtn} onPress={onApply}>
          <Text style={g.saveBtnText}>{t("save")}</Text>
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}
