/**
 * PrimaryButton — главная accent-кнопка («Оплатить всё» / checkout).
 * Спека: «SNR EduOS v2 Light.dc.html», строка 397 (кнопка «Оплатить всё» П17):
 * accent-градиент 135° (tokens.accentGrad), r16, padding 15, текст 14/800 #fff,
 * тень 0 14 32 rgba(124,58,237,.4) (тёмная пара — glow tokens.shColor),
 * inset-блик «inset 0 1.5 0 W35» → верхняя hairline-полоска.
 * Presentational: тексты/иконка только через props, тема — useTheme().
 */
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, shadowStyle, useTheme } from "../theme";

export interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Иконка слева от текста (белый SVG-глиф 16px, gap 8 — макет строка 397). */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Тень кнопки (светлая) 0 14 32 rgba(124,58,237,.4) — макет строка 397. */
const SHADOW_LIGHT = { x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.4)" };
/** RGB акцента для тёмного glow (tokens.shColor — тёмная пара цветной тени). */
const ACCENT_RGB = "124,58,237";
/** Hairline-блик W35 «inset 0 1.5 0 rgba(255,255,255,.35)» — макет строка 397. */
const INSET_HAIRLINE = { height: 1.5, color: "rgba(255,255,255,0.35)" };

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
  style,
}: PrimaryButtonProps) {
  const { tokens, scheme } = useTheme();
  const shadow = scheme === "dark" ? tokens.shColor(ACCENT_RGB) : SHADOW_LIGHT;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        shadowStyle(shadow),
        { borderRadius: 16 },
        // Disabled-состояние прозрачностью (в макете отдельного стиля нет).
        disabled ? { opacity: 0.5 } : null,
        pressed && !disabled ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      <LinearGradient
        colors={tokens.accentGrad.colors as [string, string]}
        {...gradPoints(tokens.accentGrad.angle)}
        style={styles.inner}
      >
        {icon ? <View>{icon}</View> : null}
        <Text style={styles.label}>{label}</Text>
        {/* inset-блик стекла → верхняя hairline-полоска (W35). */}
        <View
          pointerEvents="none"
          style={[styles.hairline, { height: INSET_HAIRLINE.height, backgroundColor: INSET_HAIRLINE.color }]}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
    borderRadius: 16,
    overflow: "hidden",
  },
  label: {
    fontFamily: fonts.manrope800,
    fontSize: 14,
    color: "#FFFFFF",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
