/**
 * StatusChip — статус-чип шести цветовых семей.
 * Спека: «SNR EduOS v2 Light.dc.html», «Библиотека» §s3 (строки 2702–2721):
 * r999, паддинг 5×10, текст 10.5/800; фон rgba(цвет,.13–.14) + граница
 * rgba(цвет,.32–.35) (через tokens.chip) + тёмная ступень цвета в тексте
 * (светлая тема) / светлый акцент (тёмная) — tokens.status[family].text.
 * variant 'live' — точка-индикатор 6px (строка 2708 «В школе»);
 * variant 'new' — единственный заливной градиент NEW (строка 2715).
 * Presentational: данные только через props, тема — useTheme().
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, radius, shadowStyle, useTheme } from "../theme";

export type StatusFamily = "green" | "red" | "violet" | "orange" | "blue" | "gray";

export interface StatusChipProps {
  label: string;
  family?: StatusFamily;
  /** 'live' — точка-индикатор; 'new' — заливной градиент NEW. */
  variant?: "default" | "live" | "new";
  style?: StyleProp<ViewStyle>;
}

/** Градиент NEW-чипа — единственный заливной, макет строка 2715 (135° #8B5CF6→#6366F1). */
const NEW_GRAD: [string, string] = ["#8B5CF6", "#6366F1"];
/** Бордер NEW-чипа rgba(255,255,255,.4) — макет строка 2715. */
const NEW_BORDER = "rgba(255,255,255,0.4)";
/** Тень NEW-чипа (светлая) 0 5 12 rgba(124,58,237,.35) — макет строка 2715. */
const NEW_SHADOW_LIGHT = { x: 0, y: 5, blur: 12, color: "rgba(124,58,237,0.35)" };
/** RGB акцента для тёмного glow (тёмная пара цветной тени — tokens.shColor). */
const ACCENT_RGB = "124,58,237";

export function StatusChip({
  label,
  family = "gray",
  variant = "default",
  style,
}: StatusChipProps) {
  const { tokens, scheme } = useTheme();

  if (variant === "new") {
    return (
      <LinearGradient
        colors={NEW_GRAD}
        {...gradPoints(135)}
        style={[
          styles.chip,
          shadowStyle(scheme === "dark" ? tokens.shColor(ACCENT_RGB) : NEW_SHADOW_LIGHT),
          { borderColor: NEW_BORDER, borderWidth: 1 },
          style,
        ]}
      >
        <Text style={[styles.label, { color: "#FFFFFF" }]}>{label}</Text>
      </LinearGradient>
    );
  }

  const st = tokens.status[family];
  const chip = tokens.chip(st.rgb);
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: chip.bg, borderColor: chip.border, borderWidth: 1 },
        style,
      ]}
    >
      {variant === "live" ? (
        // Точка живого статуса 6px — чистый цвет семьи (макет строка 2708).
        <View style={[styles.dot, { backgroundColor: `rgb(${st.rgb})` }]} />
      ) : null}
      <Text style={[styles.label, { color: st.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.chip,
  },
  label: {
    fontFamily: fonts.manrope800,
    fontSize: 10.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
