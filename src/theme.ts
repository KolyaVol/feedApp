export const fonts = {
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semiBold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
} as const;

export type ColorSet = {
  background: string;
  card: string;
  primary: string;
  text: string;
  textMuted: string;
  textEmpty: string;
  placeholder: string;
  border: string;
  borderLight: string;
  danger: string;
  chipBg: string;
  chipSelectedBg: string;
  modalOverlay: string;
  secondaryBtn: string;
  emptyChart: string;
  switchTrack: string;
  pastelGreen: string;
  pastelYellow: string;
  pastelOrange: string;
  pastelRed: string;
};

export const lightColors: ColorSet = {
  background: "#f8f8f8",
  card: "#fff",
  primary: "#4a9eff",
  text: "#333",
  textMuted: "#666",
  textEmpty: "#888",
  placeholder: "#999",
  border: "#ddd",
  borderLight: "#eee",
  danger: "#c00",
  chipBg: "#f0f0f0",
  chipSelectedBg: "#e0f0ff",
  modalOverlay: "rgba(0,0,0,0.5)",
  secondaryBtn: "#f0f0f0",
  emptyChart: "#f5f5f5",
  switchTrack: "#ccc",
  pastelGreen: "#c8e6c9",
  pastelYellow: "#fff9c4",
  pastelOrange: "#ffe0b2",
  pastelRed: "#ffcdd2",
};

export const darkColors: ColorSet = {
  background: "#1a1a1a",
  card: "#2d2d2d",
  primary: "#5aaeff",
  text: "#e8e8e8",
  textMuted: "#b0b0b0",
  textEmpty: "#888",
  placeholder: "#777",
  border: "#444",
  borderLight: "#3a3a3a",
  danger: "#f44",
  chipBg: "#3a3a3a",
  chipSelectedBg: "#2a3a4a",
  modalOverlay: "rgba(0,0,0,0.7)",
  secondaryBtn: "#3a3a3a",
  emptyChart: "#252525",
  switchTrack: "#555",
  pastelGreen: "#2d4a2d",
  pastelYellow: "#4a4a2d",
  pastelOrange: "#4a3d2d",
  pastelRed: "#4a2d2d",
};

export const colors = lightColors;

export const foodTypePresetColors = [
  "#FFB6C1",
  "#87CEEB",
  "#98FB98",
  "#ADD8E6",
  "#DDA0DD",
  "#F0E68C",
  "#FFA07A",
  "#E6E6FA",
  "#B0E0E6",
  "#FFDAB9",
  "#D8BFD8",
  "#F5DEB3",
  "#E0FFFF",
  "#FFE4E1",
  "#98D8AA",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8B500",
  "#52B788",
  "#E63946",
  "#457B9D",
  "#2A9D8F",
  "#E9C46A",
] as const;

export type ThemeMode = "light" | "dark";

export function getColors(theme: ThemeMode): ColorSet {
  return theme === "dark" ? darkColors : lightColors;
}

export function pastelColorForWeeklyMin(ratio: number): string {
  if (ratio >= 1) return colors.pastelGreen;
  if (ratio >= 0.5) return colors.pastelYellow;
  if (ratio >= 0.25) return colors.pastelOrange;
  return colors.pastelRed;
}

export const spacing = {
  screenPadding: 16,
  contentBottom: 24,
  radiusSm: 6,
  radiusMd: 8,
  radiusLg: 12,
  radiusChip: 20,
} as const;
