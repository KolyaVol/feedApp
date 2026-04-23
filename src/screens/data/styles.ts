import React from "react";
import { StyleSheet } from "react-native";
import { fonts, spacing } from "../../theme";

export interface DataScreenColors {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  border: string;
  borderLight: string;
  danger: string;
  pastelGreen: string;
  pastelRed: string;
}

export function useDataScreenStyles(colors: DataScreenColors, width: number) {
  const compact = width < 400;
  return React.useMemo(
    () =>
      StyleSheet.create({
        toolbar: {
          flexDirection: "row",
          gap: compact ? 6 : 8,
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 12,
          flexWrap: "wrap",
        },
        toolBtn: {
          paddingVertical: compact ? 9 : 10,
          paddingHorizontal: compact ? 12 : 14,
          borderRadius: spacing.radiusMd,
        },
        toolBtnText: {
          fontSize: 13,
          fontFamily: fonts.medium,
        },
        toolBtnTextWhite: {
          fontSize: 13,
          fontFamily: fonts.semiBold,
          color: "#fff",
        },
        emptyWrap: {
          alignItems: "center",
          padding: 40,
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: 12,
        },
        cardsWrap: {
          paddingHorizontal: spacing.screenPadding,
          gap: 10,
        },
        dayCard: {
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          padding: compact ? 8 : 10,
          gap: 8,
        },
        dateRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        cellInput: {
          borderWidth: 1,
          borderRadius: spacing.radiusSm,
          paddingVertical: compact ? 5 : 6,
          paddingHorizontal: compact ? 7 : 8,
          fontSize: 13,
          fontFamily: fonts.regular,
        },
        cellDate: { flex: 1 },
        cellProduct: { flex: 1, minWidth: 0 },
        cardGramsInput: { width: 64, textAlign: "right" },
        cellNotes: { width: "100%", minHeight: 36 },
        mealSection: {
          gap: 4,
        },
        mealTitle: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        mealEntryRow: {
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          gap: 6,
          marginBottom: 2,
          flexWrap: "wrap",
        },
        removeEntryBtn: {
          width: 22,
          height: 22,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        removeEntryText: {
          fontSize: 16,
          fontWeight: "bold",
        },
        addEntryBtn: {
          borderWidth: 1,
          borderStyle: "dashed",
          borderRadius: spacing.radiusSm,
          paddingVertical: 6,
          alignItems: "center",
        },
        addEntryText: {
          fontSize: 16,
          fontFamily: fonts.medium,
        },
        addMoreBtn: {
          paddingVertical: 3,
          alignItems: "center",
        },
        addMoreText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        modalSuggestionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        },
        rowActionsBtn: {
          width: 34,
          height: 34,
          borderRadius: spacing.radiusSm,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        rowActionsIcon: {
          fontSize: 14,
          fontFamily: fonts.semiBold,
        },
        actionsModal: {
          gap: 8,
        },
        actionModalBtn: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
        },
        actionModalBtnText: {
          fontSize: 15,
          fontFamily: fonts.medium,
        },
        toast: {
          position: "absolute",
          alignSelf: "center",
          width: "92%",
          maxWidth: 460,
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
          zIndex: 1000,
          elevation: 1000,
        },
        toastLayer: {
          flex: 1,
          width: "100%",
        },
        toastText: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
      }),
    [colors, compact],
  );
}

export type DataScreenStyles = ReturnType<typeof useDataScreenStyles>;
