/**
 * Popover — всплывающее меню (дропдаун периода/дат).
 * Спека: «SNR EduOS v2 Light.dc.html», строка 298 (дропдаун периода П10):
 * position absolute top:110%, width 170, r16, градиент 160° W94→W82,
 * backdrop-filter blur(24), border W90, тень 0 18 40 rgba(64,54,150,.28);
 * аналогично дропдаун дат (строка ~989).
 * Тёмная пара — из CSS-оверрайдов макета:
 *  фон: строки 38–42 → 160° rgba(44,36,102,.97)→rgba(23,18,62,.97);
 *  border W90 → rgba(255,255,255,.18) (строка 61);
 *  для тени точной тёмной пары в CSS нет — берём tokens.shFloat (строка 74,
 *  общий тёмный float-shadow 0 18 40 rgba(3,5,18,.5)).
 * Presentational: строки меню — children, позиционирование относительным
 * родителем управляет вызывающий экран.
 */
import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradPoints, shadowStyle, useTheme, type GlassToken, type ShadowToken } from "../theme";
import { GlassBlur, glassSurface } from "./glass";

/** Светлое стекло поповера (строка 298 макета). */
const POPOVER_GLASS_LIGHT: GlassToken = {
  angle: 160,
  colors: ["rgba(255,255,255,0.94)", "rgba(255,255,255,0.82)"],
  blur: 24,
};
/** Тёмное стекло поповера (CSS-оверрайды, строки 38–42 макета). */
const POPOVER_GLASS_DARK: GlassToken = {
  angle: 160,
  colors: ["rgba(44,36,102,0.97)", "rgba(23,18,62,0.97)"],
  blur: 24,
};
/** Светлый бордер W90 (строка 298); тёмный — CSS строка 61. */
const POPOVER_BORDER_LIGHT = "rgba(255,255,255,0.9)";
const POPOVER_BORDER_DARK = "rgba(255,255,255,0.18)";
/** Светлая тень 0 18 40 rgba(64,54,150,.28) (строка 298 макета). */
const POPOVER_SHADOW_LIGHT: ShadowToken = {
  x: 0,
  y: 18,
  blur: 40,
  color: "rgba(64,54,150,0.28)",
};

export interface PopoverProps {
  /** Показывать ли меню; false → null (управляет вызывающий экран). */
  visible?: boolean;
  /** Ширина, по умолчанию 170 (строка 298 макета). */
  width?: number;
  /** Прижать к левому (по умолчанию) или правому краю якоря. */
  align?: "left" | "right";
  /** Отступ сверху от якоря, по умолчанию '110%' (строка 298 макета). */
  top?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Popover({
  visible = true,
  width = 170,
  align = "left",
  top = "110%",
  style,
  children,
}: PopoverProps) {
  const { tokens, scheme } = useTheme();
  if (!visible) return null;

  const dark = scheme === "dark";
  const surface = glassSurface(
    dark ? POPOVER_GLASS_DARK : POPOVER_GLASS_LIGHT,
    scheme,
  );
  const shadow = dark ? tokens.shFloat : POPOVER_SHADOW_LIGHT;

  return (
    <View
      style={[
        {
          position: "absolute",
          top,
          zIndex: 25,
          width,
          ...(align === "right" ? { right: 0 } : { left: 0 }),
          borderRadius: 16,
        },
        shadowStyle(shadow),
        style,
      ]}
    >
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: dark ? POPOVER_BORDER_DARK : POPOVER_BORDER_LIGHT,
          flexDirection: "column",
        }}
      >
        {surface.mode === "blur" ? (
          <>
            <GlassBlur
              intensity={surface.intensity}
              tint={surface.tint}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={surface.colors as [string, string, ...string[]]}
              {...gradPoints(surface.angle)}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]}
          />
        )}
        {children}
      </View>
    </View>
  );
}
