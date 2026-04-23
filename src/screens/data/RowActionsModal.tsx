import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { ModalSheet } from "../../components/ModalSheet";
import type { FeedDay, MealType } from "../../types";
import { formatIsoDateShort } from "../../utils/dates";
import type { DataScreenStyles } from "./styles";

interface RowActionsModalColors {
  text: string;
  chipBg: string;
  pastelRed: string;
  secondaryBtn: string;
}

interface RowActionsModalProps {
  dayId: string | null;
  day: FeedDay | null;
  styles: DataScreenStyles;
  globalStyles: {
    modalTitle: any;
    labelMuted: any;
  };
  colors: RowActionsModalColors;
  locale: string;
  t: (key: string) => string;
  onClose: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onInsertAbove: (id: string) => void;
  onInsertBelow: (id: string) => void;
  onAddMeal: (day: FeedDay, mealType: MealType) => void;
  onDelete: (id: string) => void;
}

export function RowActionsModal({
  dayId,
  day,
  styles: s,
  globalStyles: g,
  colors,
  locale,
  t,
  onClose,
  onMoveUp,
  onMoveDown,
  onInsertAbove,
  onInsertBelow,
  onAddMeal,
  onDelete,
}: RowActionsModalProps) {
  return (
    <ModalSheet visible={!!dayId} onRequestClose={onClose} cardStyle={s.actionsModal}>
      <Text style={g.modalTitle}>{t("dataRowActions")}</Text>
      {day && (
        <Text style={[g.labelMuted, { marginBottom: 12 }]}>
          {formatIsoDateShort(day.date, locale)}
        </Text>
      )}
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
        onPress={() => dayId && onMoveUp(dayId)}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>↑ {t("dataMoveUp")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
        onPress={() => dayId && onMoveDown(dayId)}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>↓ {t("dataMoveDown")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
        onPress={() => dayId && onInsertAbove(dayId)}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>+ {t("dataAddAbove")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
        onPress={() => dayId && onInsertBelow(dayId)}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>+ {t("dataAddBelow")}</Text>
      </TouchableOpacity>
      {day && day.morning.length === 0 && (
        <TouchableOpacity
          style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
          onPress={() => onAddMeal(day, "morning")}
        >
          <Text style={[s.actionModalBtnText, { color: colors.text }]}>+ {t("mealMorning")}</Text>
        </TouchableOpacity>
      )}
      {day && day.lunch.length === 0 && (
        <TouchableOpacity
          style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
          onPress={() => onAddMeal(day, "lunch")}
        >
          <Text style={[s.actionModalBtnText, { color: colors.text }]}>+ {t("mealLunch")}</Text>
        </TouchableOpacity>
      )}
      {day && day.evening.length === 0 && (
        <TouchableOpacity
          style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
          onPress={() => onAddMeal(day, "evening")}
        >
          <Text style={[s.actionModalBtnText, { color: colors.text }]}>+ {t("mealEvening")}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.pastelRed }]}
        onPress={() => dayId && onDelete(dayId)}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>{t("dataDeleteRow")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.actionModalBtn, { backgroundColor: colors.secondaryBtn, marginTop: 8 }]}
        onPress={onClose}
      >
        <Text style={[s.actionModalBtnText, { color: colors.text }]}>{t("cancel")}</Text>
      </TouchableOpacity>
    </ModalSheet>
  );
}
