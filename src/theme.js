import { createContext, useContext } from "react";

export const DARK = {
  isDark: true,
  bg: "#111110",
  bgCard: "#1C1B18",
  bgInput: "#161513",
  bgInset: "#111110",
  border: "#272521",
  borderMid: "#363129",
  borderActive: "#463F35",
  text: "#EDE7DB",
  textMuted: "#7A7268",
  textFaint: "#4A4640",
  textDim: "#343028",
  textGold: "#9D96F5",
  textWarm: "#A08868",
  accent: "#7C75F0",
  accentBg: "#1A1928",
  filterBg: "#161513",
  filterText: "#5A5448",
  pillBg: "#222018",
  red: "#F87171",
  green: "#4ADE80",
};

export const LIGHT = {
  isDark: false,
  bg: "#F7F3EC",
  bgCard: "#FFFFFF",
  bgInput: "#FFFFFF",
  bgInset: "#EEE9DF",
  border: "#E4DDD1",
  borderMid: "#C8BEB0",
  borderActive: "#B0A594",
  text: "#1C1810",
  textMuted: "#6E6456",
  textFaint: "#A09080",
  textDim: "#C4BAA8",
  textGold: "#4338CA",
  textWarm: "#7A5C38",
  accent: "#4338CA",
  accentBg: "#EEEEFF",
  filterBg: "#FFFFFF",
  filterText: "#6E6456",
  pillBg: "#EDE8DF",
  red: "#BE123C",
  green: "#15803D",
};

export const ThemeCtx = createContext(DARK);
export const useTheme = () => useContext(ThemeCtx);
