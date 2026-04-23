import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fonts, spacing } from "../theme";

interface ProductSuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onPressIn?: () => void;
  keyPrefix?: string;
  wrapStyle?: ViewStyle;
  wrapStyleOverride?: ViewStyle;
}

export function ProductSuggestionChips({
  suggestions,
  onSelect,
  onPressIn,
  keyPrefix = "",
  wrapStyle,
  wrapStyleOverride,
}: ProductSuggestionChipsProps) {
  const { colors } = useTheme();
  if (suggestions.length === 0) return null;
  const viewStyle = wrapStyleOverride
    ? [wrapStyleOverride]
    : [styles.suggestionsWrap, { backgroundColor: colors.card }, wrapStyle];
  return (
    <View style={viewStyle}>
      {suggestions.map((suggestion) => (
        <TouchableOpacity
          key={`${keyPrefix}${suggestion}`}
          style={[styles.suggestionChip, { backgroundColor: colors.chipBg }]}
          onPressIn={onPressIn}
          onPress={() => onSelect(suggestion)}
        >
          <Text style={[styles.suggestionChipText, { color: colors.text }]}>
            {suggestion}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface GramSuggestionChipsProps {
  suggestions: number[];
  onSelect: (grams: number) => void;
  onPressIn?: () => void;
  keyPrefix?: string;
  rowStyle?: ViewStyle;
  rowStyleOverride?: ViewStyle;
}

export function GramSuggestionChips({
  suggestions,
  onSelect,
  onPressIn,
  keyPrefix = "",
  rowStyle,
  rowStyleOverride,
}: GramSuggestionChipsProps) {
  const { colors } = useTheme();
  if (suggestions.length === 0) return null;
  const viewStyle = rowStyleOverride
    ? [rowStyleOverride]
    : [styles.inlineSuggestionsRow, rowStyle];
  return (
    <View style={viewStyle}>
      {suggestions.map((gram) => (
        <TouchableOpacity
          key={`${keyPrefix}gram:${gram}`}
          style={[styles.gramChip, { backgroundColor: colors.chipBg }]}
          onPressIn={onPressIn}
          onPress={() => onSelect(gram)}
        >
          <Text style={[styles.gramChipText, { color: colors.text }]}>{gram}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    borderRadius: spacing.radiusSm,
    padding: 4,
    width: "100%",
    marginTop: 4,
    maxHeight: 84,
    overflow: "hidden",
  },
  suggestionChip: {
    borderRadius: spacing.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  suggestionChipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  inlineSuggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
    width: "100%",
  },
  gramChip: {
    borderRadius: spacing.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  gramChipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
});
