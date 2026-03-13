import { createContext, useContext } from "react";

export const DARK = {
  isDark: true,
  bg: "#0D0D12",
  bgCard: "#15151E",
  bgInput: "#101018",
  bgInset: "#0D0D12",
  border: "#1E1E2C",
  borderMid: "#2A2A3E",
  borderActive: "#48486A",
  text: "#EEEEF6",
  textMuted: "#7878A2",
  textFaint: "#42425E",
  textDim: "#28283A",
  textGold: "#A094FF",
  textWarm: "#A08870",
  accent: "#7B6FFF",
  accentBg: "#111228",
  filterBg: "#101018",
  filterText: "#505078",
  pillBg: "#1C1C2C",
  red: "#FF6B6B",
  green: "#3DD68C",
};

export const LIGHT = {
  isDark: false,
  bg: "#F4F4FB",
  bgCard: "#FFFFFF",
  bgInput: "#FFFFFF",
  bgInset: "#EBEBF6",
  border: "#E0E0EE",
  borderMid: "#C6C6DC",
  borderActive: "#A4A4C8",
  text: "#0E0E1C",
  textMuted: "#5A5A82",
  textFaint: "#9090B8",
  textDim: "#C0C0D8",
  textGold: "#4C3FE0",
  textWarm: "#6A5438",
  accent: "#5046E4",
  accentBg: "#EAEAFF",
  filterBg: "#FFFFFF",
  filterText: "#6060A0",
  pillBg: "#EDEDF8",
  red: "#DC2626",
  green: "#0EA56A",
};

export const ThemeCtx = createContext(DARK);
export const useTheme = () => useContext(ThemeCtx);
