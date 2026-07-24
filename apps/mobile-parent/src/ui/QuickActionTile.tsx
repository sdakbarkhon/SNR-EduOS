/**
 * QuickActionTile + QuickActionsGrid — стеклянные тайлы быстрых действий.
 * Спека: «SNR EduOS v2 Light.dc.html»:
 * — П5 «Быстрые действия», строки 249–253 (grid 3 колонки, gap 9): тайл r18,
 *   паддинг 11×4, gap 6, стекло 160° W72→W46 + blur(20) + бордер W78 +
 *   тень 0 10 24 rgba(99,86,214,.13) + inset-блик W95; плитка-иконка 38 r13
 *   с градиентом 135° и цветной тенью 0 7 16 rgba(цвет,.3); подпись 10.5/700;
 * — П17 (кошелёк), строка ~432 (grid 4 колонки, gap 8): тайл r16, паддинг 10×4,
 *   gap 5, тень 0 10 22 rgba(99,86,214,.12); плитка 34 r11 без тени; подпись 9/700.
 * Тёмные пары: стекло — tokens.glass1 (CSS строка 28), тень тайла — tokens.shCard
 * (CSS строка 68), цветная тень плитки — glow tokens.shColor.
 * Presentational: label/icon/градиент только через props, тема — useTheme().
 */
import { Children, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, shadowStyle, useTheme, type ShadowToken } from "../theme";
import { GlassBlur, glassSurface } from "./glass";

export interface QuickActionTileProps {
  label: string;
  /** Белый SVG-глиф 17px (md) / 15px (sm) — передаётся готовым элементом. */
  icon: ReactNode;
  /** Градиент цветной плитки-иконки 135° (например ["#FB923C","#EF4444"]). */
  gradient: [string, string];
  /** «R,G,B» для цветной тени плитки (только md, строка 250); без него тени нет. */
  shadowRgb?: string;
  /** md — грид 3 колонки (П5), sm — грид 4 колонки (П17). */
  size?: "md" | "sm";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Тень тайла (светлая): md 0 10 24 rgba(99,86,214,.13) (строка 250), sm 0 10 22 rgba(99,86,214,.12) (строка 432). */
const TILE_SHADOW_LIGHT: Record<"md" | "sm", ShadowToken> = {
  md: { x: 0, y: 10, blur: 24, color: "rgba(99,86,214,0.13)" },
  sm: { x: 0, y: 10, blur: 22, color: "rgba(99,86,214,0.12)" },
};
/** Цветная тень плитки-иконки (светлая) 0 7 16 rgba(цвет,.3) — строка 250. */
const PLAQUE_SHADOW_LIGHT = (rgb: string): ShadowToken => ({
  x: 0,
  y: 7,
  blur: 16,
  color: `rgba(${rgb},0.3)`,
});

const METRICS = {
  md: { radius: 18, padV: 11, padH: 4, gap: 6, plaque: 38, plaqueR: 13, label: 10.5 },
  sm: { radius: 16, padV: 10, padH: 4, gap: 5, plaque: 34, plaqueR: 11, label: 9 },
} as const;

export function QuickActionTile({
  label,
  icon,
  gradient,
  shadowRgb,
  size = "md",
  onPress,
  style,
}: QuickActionTileProps) {
  const { tokens, scheme } = useTheme();
  const m = METRICS[size];
  // Стекло тайла: цвета glass-1, blur(20) из макета (строки 250, 432).
  const surface = glassSurface({ ...tokens.glass1, blur: 20 }, scheme);
  const tileShadow = scheme === "dark" ? tokens.shCard : TILE_SHADOW_LIGHT[size];
  const plaqueShadow = shadowRgb
    ? scheme === "dark"
      ? tokens.shColor(shadowRgb)
      : PLAQUE_SHADOW_LIGHT(shadowRgb)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shadowStyle(tileShadow),
        { borderRadius: m.radius },
        pressed ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      <View
        style={{
          borderRadius: m.radius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          alignItems: "center",
          gap: m.gap,
          paddingVertical: m.padV,
          paddingHorizontal: m.padH,
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
              locations={surface.locations as [number, number, ...number[]] | undefined}
              {...gradPoints(surface.angle)}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
        )}
        {/* inset-блик стекла → верхняя hairline-полоска (токен glassInset). */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: tokens.glassInset.y,
            backgroundColor: tokens.glassInset.color,
          }}
        />
        <LinearGradient
          colors={gradient}
          {...gradPoints(135)}
          style={[
            {
              width: m.plaque,
              height: m.plaque,
              borderRadius: m.plaqueR,
              alignItems: "center",
              justifyContent: "center",
            },
            plaqueShadow ? shadowStyle(plaqueShadow) : null,
          ]}
        >
          {icon}
        </LinearGradient>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: m.label,
            color: tokens.ink1,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export interface QuickActionsGridProps {
  /** 3 — П5 (gap 9, строка 249), 4 — П17 (gap 8, строка 432). */
  columns?: 3 | 4;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function QuickActionsGrid({ columns = 3, children, style }: QuickActionsGridProps) {
  const gap = columns === 3 ? 9 : 8;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -gap / 2,
          rowGap: gap,
        },
        style,
      ]}
    >
      {Children.map(children, (child) => (
        <View style={{ width: `${100 / columns}%`, paddingHorizontal: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
