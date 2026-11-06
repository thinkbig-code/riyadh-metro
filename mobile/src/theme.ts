import { useColorScheme, TextStyle, ViewStyle } from "react-native";
import { MAP_GEOMETRY, LineColorKey, ThemeMode, ThemePalette } from "./map/geometry";

export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemePalette & {
    accent: string;
    danger: string;
    warningBg: string;
    warningFg: string;
    cardBorder: string;
  };
  fonts: {
    regular?: string;
    bold?: string;
  };
}

export function resolveTheme(
  mode: ThemeMode,
  fontsLoaded = false,
  isArabicScript = false,
): AppTheme {
  const base = MAP_GEOMETRY.colors[mode];
  const isDark = mode === "dark";

  const regularFont = fontsLoaded
    ? isArabicScript
      ? "NotoSansArabic-Regular"
      : "GolosText-Regular"
    : undefined;
  const boldFont = fontsLoaded
    ? isArabicScript
      ? "NotoSansArabic-Bold"
      : "GolosText-Bold"
    : undefined;

  return {
    mode,
    isDark,
    colors: {
      ...base,
      accent: base.blue,
      danger: base.red,
      warningBg: isDark ? "#2C2214" : "#FFF6E5",
      warningFg: isDark ? "#FFD84D" : "#855000",
      cardBorder: base.rule,
    },
    fonts: {
      regular: regularFont,
      bold: boldFont,
    },
  };
}

export function useSystemThemeMode(): ThemeMode {
  const scheme = useColorScheme();
  return scheme === "dark" ? "dark" : "light";
}

export function directionalRow(rtl: boolean): ViewStyle {
  return {
    flexDirection: rtl ? "row-reverse" : "row",
  };
}

export function directionalText(
  rtl: boolean,
  theme: AppTheme,
  bold = false,
): TextStyle {
  return {
    color: theme.colors.fg,
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
    fontFamily: bold ? theme.fonts.bold : theme.fonts.regular,
  };
}

export function lineBadgeTextColor(lineId: LineColorKey): string {
  return lineId === "yellow" ? "#18212A" : "#FFFFFF";
}
