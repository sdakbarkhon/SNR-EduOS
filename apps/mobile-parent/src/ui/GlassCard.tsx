/**
 * GlassCard — базовое стекло glass-1 / glass-2.
 * Спека: «SNR EduOS v2 Light.dc.html», «Библиотека» §s10 (строки 2784–2799:
 * glass-1 160° W72→W46 blur 22, glass-2 160° W58→W36 blur 20, glass-border W78,
 * glass-inset «inset 0 1.5 0 W95», sh-card 0 14 34) + типовая карточка экранов
 * (например строка 228: r22–24, border, тень, inset-блик).
 * Тема — из useTheme(); значения — только токены. Presentational: данные через props.
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
import { gradPoints, radius, shadowStyle, useTheme } from "../theme";
import { GlassBlur, glassSurface } from "./glass";

export interface GlassCardProps {
  /** glass-1 (по умолчанию) — основные карточки, glass-2 — второстепенные. */
  variant?: "glass1" | "glass2";
  /** Радиус, по умолчанию r-card 24 (токен radius.card). */
  radius?: number;
  /** Внешний стиль (отступы, ширина). */
  style?: StyleProp<ViewStyle>;
  /** Стиль контентной области (паддинги, gap, flexDirection). */
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: ReactNode;
}

export function GlassCard({
  variant = "glass1",
  radius: r = radius.card,
  style,
  contentStyle,
  onPress,
  children,
}: GlassCardProps) {
  const { tokens, scheme } = useTheme();
  const glass = variant === "glass2" ? tokens.glass2 : tokens.glass1;
  const surface = glassSurface(glass, scheme);

  const inner = (
    <View
      style={[
        {
          borderRadius: r,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
        },
        contentStyle,
      ]}
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
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]}
        />
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
      {children}
    </View>
  );

  // Тень — на внешнем слое (иначе overflow:hidden срежет её на iOS).
  const outerStyle = [shadowStyle(tokens.shCard), { borderRadius: r }, style];

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
