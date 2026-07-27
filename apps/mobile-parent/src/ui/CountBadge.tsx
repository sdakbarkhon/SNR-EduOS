/**
 * CountBadge — бейдж-счётчик (колокольчик шапки, непрочитанные сообщения).
 * Спека: «SNR EduOS v2 Light.dc.html»:
 * — колокольчик шапки П5, строка 223: min-width/height 17, r9, паддинг 0 4,
 *   цифра 9.5/800 #fff, градиент 135° #F43F5E→#EF4444,
 *   тень 0 4 10 rgba(244,63,94,.4) (preset 'alert');
 * — список сообщений, badge(): JS строка 3585: 17px r9, паддинг 0 5,
 *   accent-градиент, тень 0 4 10 rgba(124,58,237,.4) (preset 'accent');
 * — компакт 15–16px r8 — шапка §s7 (строка 2768).
 * Тёмная пара тени — glow tokens.shColor. Presentational, тема — useTheme().
 */
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, shadowStyle, useTheme } from "../theme";

export interface CountBadgeProps {
  value: number | string;
  /** 'alert' — красный (колокольчик), 'accent' — фиолетовый (сообщения). */
  preset?: "alert" | "accent";
  /** Диаметр 15–17 (по умолчанию 17 — строки 223, 3585). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Градиент alert 135° #F43F5E→#EF4444 — макет строка 223 (нет в токенах). */
const ALERT_GRAD: [string, string] = ["#F43F5E", "#EF4444"];
/** Тени (светлая): alert 0 4 10 rgba(244,63,94,.4) (строка 223), accent 0 4 10 rgba(124,58,237,.4) (строка 3585). */
const SHADOW_LIGHT = {
  alert: { x: 0, y: 4, blur: 10, color: "rgba(244,63,94,0.4)" },
  accent: { x: 0, y: 4, blur: 10, color: "rgba(124,58,237,0.4)" },
};
/** RGB для тёмного glow (tokens.shColor). */
const GLOW_RGB = { alert: "244,63,94", accent: "124,58,237" };

export function CountBadge({ value, preset = "alert", size = 17, style }: CountBadgeProps) {
  const { tokens, scheme } = useTheme();
  const grad =
    preset === "alert" ? ALERT_GRAD : (tokens.accentGrad.colors as [string, string]);
  // Компакт таб-бара (строка 2651 макета): при size ≤ 15 — цифра 8.5/800,
  // паддинг 0 3 и БЕЗ тени; стандартный 17 (строки 223/3585) — 9.5/800,
  // паддинг 0 4, тень/glow.
  const compact = size <= 15;
  const shadow = compact
    ? null
    : scheme === "dark"
      ? tokens.shColor(GLOW_RGB[preset])
      : SHADOW_LIGHT[preset];

  return (
    <LinearGradient
      colors={grad}
      {...gradPoints(135)}
      style={[
        styles.badge,
        shadow ? shadowStyle(shadow) : null,
        {
          minWidth: size,
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: compact ? 3 : 4,
        },
        style,
      ]}
    >
      <Text style={[styles.value, compact && styles.valueCompact]}>{String(value)}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  value: {
    fontFamily: fonts.manrope800,
    fontSize: 9.5,
    color: "#FFFFFF",
  },
  valueCompact: {
    fontSize: 8.5,
  },
});
