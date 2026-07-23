/**
 * Liquid Glass design system — токены редизайна mobile-parent.
 * Извлечены 1:1 из макета Claude Design «SNR EduOS Liquid Glass.dc.html»
 * (тёмный фон-градиент + радиальные glow-пятна + матовое стекло).
 *
 * ВАЖНО: это НОВАЯ тема (тёмная). Старый src/theme.ts (светлый) пока оставлен —
 * его используют ещё не переверстанные экраны. По мере переноса экранов они
 * переключаются на этот модуль; старый theme.ts удалим, когда не останется
 * зависимостей.
 */
import { Platform, type TextStyle, type ViewStyle } from "react-native";

// ─── Палитра ────────────────────────────────────────────────────────────────
export const palette = {
  bgSolid: "#0a1130", // сплошной фон под статус-баром / фолбэк
  // Акценты (из макета)
  violet: "#8b5cf6",
  violetBright: "#7c5cff",
  violetSoft: "#a78bfa",
  violetPale: "#c4b5fd",
  cyan: "#22d3ee",
  cyanSoft: "#67e8f9",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  pink: "#ec4899",
  rose: "#f43f5e",
  green: "#34d399",
  greenSoft: "#6ee7b7",
  amber: "#fcd34d",
  // Текст (на тёмном фоне)
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.45)",
  textDim: "rgba(255,255,255,0.35)",
  // Стекло
  glassBorder: "rgba(255,255,255,0.14)",
  glassBorderSoft: "rgba(255,255,255,0.16)",
  glassBorderStrong: "rgba(255,255,255,0.2)",
  highlight: "rgba(255,255,255,0.22)", // верхняя inset-подсветка (замена inset box-shadow)
} as const;

// Градиенты аватарок детей (из мока: Амир 3-А, Мадина 7-А, Жасур 10-А)
export const childGradients = {
  amir: ["#22d3ee", "#3b82f6"] as const,
  madina: ["#8b5cf6", "#ec4899"] as const,
  jasur: ["#34d399", "#0ea5e9"] as const,
};

// ─── Градиенты ───────────────────────────────────────────────────────────────
export const gradients = {
  // Фон экрана — 168° (в RN задаётся через start/end у LinearGradient)
  screenBg: ["#161038", "#241a5e", "#13224e", "#0a1130"] as const,
  screenBgLocations: [0, 0.36, 0.7, 1] as const,
  // Матовое стекло (135°) — три уровня «плотности»
  glassStd: ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.04)"] as const,
  glassElevated: ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"] as const,
  glassBright: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.06)"] as const, // таб-бар
  // Активные акценты
  primary: ["#8b5cf6", "#3b82f6"] as const,
  tabActive: ["rgba(139,92,246,0.55)", "rgba(59,130,246,0.38)"] as const,
  childChipActive: ["rgba(139,92,246,0.45)", "rgba(59,130,246,0.25)"] as const,
  badge: ["#ec4899", "#f43f5e"] as const,
} as const;

// Радиальные glow-пятна фона (react-native-svg RadialGradient, см. ScreenBackground)
export const glowBlobs = [
  { color: "rgba(124,92,255,0.5)", size: 430, top: -120, left: -90 },
  { color: "rgba(34,211,238,0.3)", size: 400, top: 280, right: -150 },
  { color: "rgba(236,72,153,0.26)", size: 440, bottom: -150, left: 30 },
] as const;

// ─── Радиусы / отступы ───────────────────────────────────────────────────────
export const radii = { sm: 12, md: 14, lg: 18, xl: 20, xxl: 22, xxxl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 } as const;

// ─── Шрифты (загружаются в App.tsx через @expo-google-fonts) ─────────────────
export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  display: "Unbounded_600SemiBold",       // дисплейные заголовки/крупные цифры
  displayBold: "Unbounded_700Bold",
} as const;

export const typography: Record<string, TextStyle> = {
  screenTitle: { fontFamily: fonts.extrabold, fontSize: 23, color: palette.text },
  displayStat: { fontFamily: fonts.display, fontSize: 21, color: palette.text },
  displayLg: { fontFamily: fonts.display, fontSize: 30, color: palette.text },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: palette.textFaint },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: palette.text },
  body: { fontFamily: fonts.medium, fontSize: 14, color: palette.text },
  bodyMuted: { fontFamily: fonts.medium, fontSize: 13, color: palette.textMuted },
  small: { fontFamily: fonts.semibold, fontSize: 12, color: palette.textMuted },
  tiny: { fontFamily: fonts.semibold, fontSize: 10.5, color: palette.textFaint },
};

// ─── Тени (RN не поддерживает inset box-shadow — inset-подсветка реализована
// отдельной hairline-полоской в GlassCard, см. palette.highlight) ─────────────
export const shadows: Record<string, ViewStyle> = {
  card: { shadowColor: "#040614", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  tabBar: { shadowColor: "#030512", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 20 },
  glowViolet: { shadowColor: "#7c5cff", shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  glowGreen: { shadowColor: "#10b981", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
};

/**
 * ЕДИНЫЙ КОНФИГ БЛЮРА (требование по Android-производительности).
 * Меняя ТОЛЬКО эти значения, можно понизить/выключить блюр во всём приложении,
 * не трогая экраны:
 *  - useBlur=false → BlurView заменяется полупрозрачной заливкой (fallbackFill),
 *    визуально близко, но без дорогого нативного блюра.
 *  - blurIntensity — сила блюра (0–100 у expo-blur). На Android блюр тяжелее,
 *    поэтому дефолт ниже. experimentalBlurMethod включает реальный блюр на Android.
 */
export const glass = {
  useBlur: true,
  blurIntensity: Platform.OS === "android" ? 30 : 42,
  tint: "dark" as const,
  androidBlurMethod: "dimezisBlurView" as const,
  // Фолбэк-заливка, когда useBlur=false (тёмное стекло без блюра)
  fallbackFill: "rgba(26,20,64,0.78)",
} as const;

export type GlassVariant = "std" | "elevated" | "bright";
