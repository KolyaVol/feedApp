import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { fonts, spacing } from "./theme";
import type { ColorSet } from "./theme";
import { lightColors } from "./theme";
import { useTheme } from "./contexts/ThemeContext";

export function createGlobalStyles(c: ColorSet) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: c.background,
    },
    screenContent: {
      paddingBottom: spacing.contentBottom,
    },
    screenTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: c.text,
      fontFamily: fonts.semiBold,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: 8,
    },
    contentPadding: {
      paddingHorizontal: spacing.screenPadding,
    },
    listContent: {
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.contentBottom,
    },
    primaryButton: {
      margin: spacing.screenPadding,
      padding: 14,
      backgroundColor: c.primary,
      borderRadius: spacing.radiusMd,
      alignItems: "center",
    },
    primaryButtonText: {
      color: c.card,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: fonts.semiBold,
    },
    primaryButtonOutline: {
      marginHorizontal: spacing.screenPadding,
      marginTop: 8,
      padding: 14,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: "dashed",
      alignItems: "center",
    },
    primaryButtonOutlineText: {
      color: c.primary,
      fontSize: 16,
      fontFamily: fonts.regular,
    },
    card: {
      backgroundColor: c.card,
      padding: 14,
      borderRadius: spacing.radiusMd,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      padding: 14,
      borderRadius: spacing.radiusMd,
      marginBottom: 8,
    },
    rowText: {
      flex: 1,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: spacing.radiusMd,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: fonts.regular,
    },
    inputWithMargin: {
      marginBottom: 12,
    },
    titleSection: {
      fontSize: 18,
      fontWeight: "600",
      color: c.text,
      fontFamily: fonts.semiBold,
    },
    titleCard: {
      fontSize: 16,
      fontWeight: "500",
      color: c.text,
      fontFamily: fonts.medium,
    },
    chartCenterText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
      fontFamily: fonts.semiBold,
    },
    subtitle: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 2,
      fontFamily: fonts.regular,
    },
    labelMuted: {
      fontSize: 14,
      color: c.textMuted,
      fontFamily: fonts.regular,
    },
    textBody: {
      fontSize: 16,
      color: c.text,
      fontFamily: fonts.regular,
    },
    emptyText: {
      fontSize: 14,
      color: c.textEmpty,
      fontFamily: fonts.regular,
    },
    emptyTextCenter: {
      textAlign: "center",
      padding: 20,
    },
    tabActiveText: {
      color: c.card,
      fontWeight: "600",
      fontFamily: fonts.semiBold,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      justifyContent: "center",
      padding: 24,
    },
    modal: {
      backgroundColor: c.card,
      borderRadius: spacing.radiusLg,
      padding: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 16,
      color: c.text,
      fontFamily: fonts.semiBold,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: spacing.radiusMd,
      backgroundColor: c.secondaryBtn,
    },
    cancelBtnText: {
      color: c.text,
      fontSize: 16,
      fontFamily: fonts.regular,
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: spacing.radiusMd,
      backgroundColor: c.primary,
    },
    saveBtnText: {
      color: c.card,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: fonts.semiBold,
    },
    linkText: {
      color: c.primary,
      fontSize: 14,
      fontFamily: fonts.regular,
    },
    deleteText: {
      color: c.danger,
      fontSize: 14,
      fontFamily: fonts.regular,
    },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    listCard: {
      marginHorizontal: spacing.screenPadding,
      backgroundColor: c.card,
      borderRadius: spacing.radiusMd,
      padding: 12,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
    },
    listDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },
    cardDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 12,
    },
    listItemTitle: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      fontFamily: fonts.regular,
    },
    listItemAmount: {
      fontSize: 15,
      fontWeight: "500",
      color: c.text,
      fontFamily: fonts.medium,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: spacing.radiusChip,
      backgroundColor: c.chipBg,
    },
    chipSelected: {
      backgroundColor: c.chipSelectedBg,
      borderWidth: 1,
      borderColor: c.primary,
    },
    chipSelectedBorderOnly: {
      borderWidth: 1,
      borderColor: c.primary,
    },
    chipDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 6,
    },
    formCard: {
      padding: 16,
      backgroundColor: c.card,
      borderRadius: spacing.radiusLg,
      marginHorizontal: spacing.screenPadding,
      marginVertical: 8,
    },
    buttonFull: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: spacing.radiusMd,
      alignItems: "center",
    },
    buttonFullText: {
      color: c.card,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: fonts.semiBold,
    },
    formRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    pickerWrap: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chipText: {
      fontSize: 14,
      color: c.text,
      fontFamily: fonts.regular,
    },
    inputFlex: {
      flex: 1,
    },
    unitLabel: {
      marginLeft: 8,
      minWidth: 28,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    emptyBox: {
      padding: 24,
      alignItems: "center",
    },
  });
}

export function useGlobalStyles() {
  const { colors } = useTheme();
  return useMemo(() => createGlobalStyles(colors), [colors]);
}

const g = createGlobalStyles(lightColors);
export const globalStyles = g;
export { g };
