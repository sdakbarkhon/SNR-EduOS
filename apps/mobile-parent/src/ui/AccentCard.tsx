/**
 * AccentCard — непрозрачная акцентная градиентная карточка + подкомпонент AccentInset.
 * Спека: «SNR EduOS v2 Light.dc.html», «Библиотека» §s4 (строки 2729–2741):
 * r18, паддинг 12×14, непрозрачный градиент (пары из макета), снаружи цветная
 * тень в тоне градиента (.28–.32 → токен shColor / тёмный glow), «стекло внутри
 * них — вложенные блоки rgba(255,255,255,.2)+blur(8)+граница W35» (строка 2741).
 * Примеры на экранах: П5 (строки 242–254), П10 (строка 282), П17.
 * Внутренний блик inset W35 (строка 242: inset 0 1.5px 0 rgba(255,255,255,.35))
 * → верхняя hairline-полоска.
 * Presentational: градиент, тень и контент — только через props.
 */
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradPoints, shadowStyle, useTheme } from "../theme";
import { GlassBlur, glassConfig, cssBlurToIntensity } from "./glass";

/** Внутренний блик акцентных карточек: inset 0 1.5 0 W35 (строка 242 макета). */
const ACCENT_INSET = { y: 1.5, color: "rgba(255,255,255,0.35)" };

export interface AccentCardProps {
  /** Пара (или больше) стопов градиента из макета, напр. ["#6366F1","#38BDF8"]. */
  gradient: string[];
  /** CSS-угол градиента, по умолчанию 135° (§s4; встречаются 120°/125°). */
  angle?: number;
  /**
   * База цветной тени «R,G,B» в тоне градиента (напр. "99,102,241").
   * Светлая: 0 8 18 rgba(rgb,.30); тёмная: glow 0 0 10 rgba(rgb,.50) — токен shColor.
   */
  shadowRgb?: string;
  /** Радиус, по умолчанию 18 (карточки §s4; на экранах есть 20/22 — через prop). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Стиль контентной области (паддинги, gap). */
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: ReactNode;
}

export function AccentCard({
  gradient,
  angle = 135,
  shadowRgb,
  radius: r = 18,
  style,
  contentStyle,
  onPress,
  children,
}: AccentCardProps) {
  const { tokens } = useTheme();

  const inner = (
    <View style={[{ borderRadius: r, overflow: "hidden" }, contentStyle]}>
      <LinearGradient
        colors={gradient as [string, string, ...string[]]}
        {...gradPoints(angle)}
        style={StyleSheet.absoluteFill}
      />
      {/* Внутренний блик inset W35 → hairline (строка 242 макета). */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: ACCENT_INSET.y,
          backgroundColor: ACCENT_INSET.color,
        }}
      />
      {children}
    </View>
  );

  const outerStyle = [
    shadowRgb ? shadowStyle(tokens.shColor(shadowRgb)) : null,
    { borderRadius: r },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...outerStyle,
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={outerStyle}>{inner}</View>;
}

/**
 * AccentInset — «стеклянная вставка» внутри непрозрачной градиентной карточки:
 * rgba(255,255,255,.2) + blur(8) + border rgba(255,255,255,.35)
 * (строка 2741 «Библиотеки»; примеры — строки 244, 251, 286 макета, r11–15).
 * Одинакова в обеих темах (лежит на собственном градиенте карточки).
 */
export interface AccentInsetProps {
  /** Радиус вставки, по умолчанию 12 (в макете 11–15 по месту). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: ReactNode;
}

export function AccentInset({
  radius: r = 12,
  style,
  onPress,
  children,
}: AccentInsetProps) {
  const inner = (
    <View
      style={[
        {
          borderRadius: r,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
        },
        style,
      ]}
    >
      {glassConfig.useBlur ? (
        <GlassBlur
          intensity={cssBlurToIntensity(8)}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(255,255,255,0.2)" },
        ]}
      />
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}
