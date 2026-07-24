/**
 * ЕДИНЫЙ конфиг стекла для всех групп UI-кита v2 (создан группой A, остальные импортируют).
 *
 * В макете стекло — это CSS `backdrop-filter: blur(N)` поверх полупрозрачного
 * градиента (см. «SNR EduOS v2 Light.dc.html», строки 2795–2796 §s10:
 * glass-1 160° W72→W46 · blur 22; glass-2 160° W58→W36 · blur 20).
 * В RN blur даёт expo-blur BlurView; на слабых устройствах / при проблемах
 * с производительностью переключаем ОДИН флаг ниже — и все стеклянные
 * поверхности переходят в fallback-режим «полупрозрачная заливка без блюра»:
 * плоская заливка по верхнему стопу glass-градиента с усиленной альфой
 * (светлая тема — усиленная белая, тёмная — аналогично из тёмных glass-токенов).
 *
 * TODO(SDK57): коэффициент cssBlurToIntensity подбирался под expo-blur из SDK 54.
 * После апгрейда на expo-blur 57.0.2 публичный API (intensity/tint/style) не менялся
 * и фиксированного px→intensity маппинга в доках нет, но native-реализация блюра
 * могла быть перекалибрована на iOS/Android — может потребоваться визуальная
 * перепроверка на устройстве и лёгкая правка множителя. Отдельно: prop
 * `experimentalBlurMethod` в 57 объявлен deprecated в пользу `blurMethod` —
 * мы его не используем, но если появится, переименовать здесь.
 */
import { createElement } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import type { GlassToken, Scheme } from "../theme";

export const glassConfig = {
  /** true — рендерим BlurView; false — fallback-заливка без блюра. */
  useBlur: true,
};

/**
 * Перевод CSS-значения blur(px) в intensity expo-blur (0–100).
 * Точного соответствия у платформ нет — эмпирический коэффициент 2.5
 * (blur 22px макета ≈ intensity 55). Ограничение платформы, не менять
 * по экранам — только здесь.
 */
export function cssBlurToIntensity(px: number): number {
  return Math.min(100, Math.round(px * 2.5));
}

/** Усилить альфу rgba()/rgb()-строки на delta (кламп 0..1). */
export function boostAlpha(color: string, delta: number): string {
  const m = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!m) return color;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  const next = Math.min(1, Math.max(0, a + delta));
  return `rgba(${m[1]},${m[2]},${m[3]},${next})`;
}

export interface GlassBlurProps {
  /** Intensity expo-blur 0–100 (обычно cssBlurToIntensity(px)). */
  intensity: number;
  tint: "light" | "dark" | "default";
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
}

/**
 * GlassBlur — ЕДИНСТВЕННАЯ точка входа expo-blur в UI-ките.
 * Компоненты НЕ импортируют expo-blur напрямую (правило интеграции UI-кита) —
 * только этот враппер: это позволяет менять реализацию блюра (или глушить его)
 * в одном месте. Файл .ts — поэтому createElement вместо JSX.
 */
export function GlassBlur(props: GlassBlurProps) {
  return createElement(BlurView, props);
}

/** Описание поверхности: либо blur + градиент, либо плоская fallback-заливка. */
export type GlassSurface =
  | {
      mode: "blur";
      intensity: number;
      tint: "light" | "dark";
      angle: number;
      colors: string[];
      locations?: number[];
    }
  | { mode: "fill"; color: string };

/**
 * Выбор «BlurView или полупрозрачная заливка» для произвольного glass-описания
 * (tokens.glass1 / tokens.glass2 или локального {angle, colors, blur} из макета).
 */
export function glassSurface(glass: GlassToken, scheme: Scheme): GlassSurface {
  if (glassConfig.useBlur) {
    return {
      mode: "blur",
      intensity: cssBlurToIntensity(glass.blur),
      tint: scheme,
      angle: glass.angle,
      colors: glass.colors,
      locations: glass.locations,
    };
  }
  // Fallback: плоская заливка по верхнему (первому) стопу градиента,
  // усиленная (+0.2 к альфе), чтобы компенсировать отсутствие блюра.
  return { mode: "fill", color: boostAlpha(glass.colors[0], 0.2) };
}
