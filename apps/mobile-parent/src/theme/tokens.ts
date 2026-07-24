/**
 * Дизайн-токены SNR EduOS v2 — перенос 1:1 из утверждённого макета
 * «SNR EduOS v2 Light.dc.html», секция §s10 «Токены · светлая / тёмная»
 * (строки 2784–2830) + CSS-оверрайды тёмной темы (строки 23–190).
 * Значения не «улучшать» — они дословно из макета.
 */

export type Scheme = "light" | "dark";

/** Линейный градиент в терминах CSS-угла (конвертация в start/end — helper ниже). */
export interface LinearGrad {
  /** CSS-угол в градусах (0° = вверх, по часовой). */
  angle: number;
  colors: string[];
  /** Позиции стопов 0..1; если нет — равномерно. */
  locations?: number[];
}

/** Радиальный блоб фона страницы (геометрия макета, строки 213–216, кадр 390×844). */
export interface BlobToken {
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface GlassToken extends LinearGrad {
  blur: number;
}

export interface ShadowToken {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface SubjectToken {
  /** Базовый цвет предмета (текст/глифы в светлой теме). */
  base: string;
  /** Акцент текста/глифов в текущей теме (в тёмной — свой, из §s10). */
  accent: string;
  /** Градиент плитки 135° (общий для тем). */
  grad: [string, string];
}

export interface StatusToken {
  /** Цвет текста/глифа статуса в текущей теме. */
  text: string;
  /** База семьи «R,G,B» для chip/бордеров через rgba(). */
  rgb: string;
}

export interface ThemeTokens {
  scheme: Scheme;
  ink1: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentGrad: LinearGrad;
  bgPage: LinearGrad;
  blobs: BlobToken[];
  glass1: GlassToken;
  glass2: GlassToken;
  glassBorder: string;
  /** inset 0 y 0 color (RN не умеет inset-тени — рисуем верхней линией-бликом). */
  glassInset: { y: number; color: string };
  shCard: ShadowToken;
  shFloat: ShadowToken;
  /** sh-color: светлая 0 8 18 rgba(субъект,.30); тёмная glow 0 0 10 rgba(субъект,.50). */
  shColor: (rgb: string) => ShadowToken;
  /** chip-bg/bd: rgba(цвет, α) из «R,G,B». */
  chip: (rgb: string) => { bg: string; border: string };
  subjects: {
    prog: SubjectToken;
    robo: SubjectToken;
    math: SubjectToken;
    eng: SubjectToken;
    rus: SubjectToken;
  };
  status: {
    green: StatusToken;
    red: StatusToken;
    violet: StatusToken;
    orange: StatusToken;
    blue: StatusToken;
    gray: StatusToken;
  };
}

/* ===== Геометрия и шрифты (общие для тем, §s10) ===== */

export const radius = {
  card: 24,
  tile: 18,
  chip: 999,
  phone: 48,
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  /** Поля экрана. */
  page: 18,
  /** Межблочные отступы 12–14. */
  block: 12,
} as const;

export const fonts = {
  manrope400: "Manrope_400Regular",
  manrope500: "Manrope_500Medium",
  manrope600: "Manrope_600SemiBold",
  manrope700: "Manrope_700Bold",
  manrope800: "Manrope_800ExtraBold",
  unbounded500: "Unbounded_500Medium",
  unbounded600: "Unbounded_600SemiBold",
  unbounded700: "Unbounded_700Bold",
} as const;

/* ===== Светлая тема ===== */

export const lightTokens: ThemeTokens = {
  scheme: "light",
  ink1: "#171243",
  ink2: "rgba(26,19,74,0.64)",
  ink3: "rgba(26,19,74,0.45)",
  accent: "#7C3AED",
  accentGrad: { angle: 135, colors: ["#7C3AED", "#4F6DF5"] },
  bgPage: {
    angle: 165,
    colors: ["#DCD2FD", "#C7D3FD", "#C2E0FC", "#ECD9FB"],
    locations: [0, 0.34, 0.64, 1],
  },
  // Геометрия блобов — дословно строки 213–216 макета (кадр 390×844).
  blobs: [
    { color: "rgba(124,92,255,0.5)", size: 380, top: -110, left: -80 },
    { color: "rgba(34,211,238,0.42)", size: 360, top: 250, right: -120 },
    { color: "rgba(244,114,182,0.4)", size: 380, top: 480, left: -110 },
    { color: "rgba(96,140,255,0.44)", size: 340, bottom: -100, right: -70 },
  ],
  glass1: { angle: 160, colors: ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.46)"], blur: 22 },
  glass2: { angle: 160, colors: ["rgba(255,255,255,0.58)", "rgba(255,255,255,0.36)"], blur: 20 },
  glassBorder: "rgba(255,255,255,0.78)",
  glassInset: { y: 1.5, color: "rgba(255,255,255,0.95)" },
  shCard: { x: 0, y: 14, blur: 34, color: "rgba(99,86,214,0.16)" },
  shFloat: { x: 0, y: 20, blur: 48, color: "rgba(78,66,190,0.30)" },
  shColor: (rgb) => ({ x: 0, y: 8, blur: 18, color: `rgba(${rgb},0.30)` }),
  chip: (rgb) => ({ bg: `rgba(${rgb},0.13)`, border: `rgba(${rgb},0.33)` }),
  subjects: {
    prog: { base: "#0284C7", accent: "#0284C7", grad: ["#38BDF8", "#0284C7"] },
    robo: { base: "#0D9488", accent: "#0D9488", grad: ["#2DD4BF", "#0D9488"] },
    math: { base: "#CA8A04", accent: "#CA8A04", grad: ["#FACC15", "#CA8A04"] },
    eng: { base: "#DB2777", accent: "#DB2777", grad: ["#F472B6", "#DB2777"] },
    rus: { base: "#A21CAF", accent: "#A21CAF", grad: ["#E879F9", "#A21CAF"] },
  },
  status: {
    green: { text: "#047857", rgb: "16,185,129" },
    red: { text: "#B91C1C", rgb: "239,68,68" },
    violet: { text: "#6D28D9", rgb: "139,92,246" },
    orange: { text: "#C2410C", rgb: "249,115,22" },
    blue: { text: "#1D4ED8", rgb: "59,130,246" },
    gray: { text: "#475569", rgb: "100,116,139" },
  },
};

/* ===== Тёмная тема (утв. комплект Б) ===== */

export const darkTokens: ThemeTokens = {
  scheme: "dark",
  ink1: "#FFFFFF",
  ink2: "rgba(255,255,255,0.60)",
  ink3: "rgba(255,255,255,0.40)",
  accent: "#8B5CF6",
  accentGrad: { angle: 135, colors: ["#8B5CF6", "#3B82F6"] },
  bgPage: {
    angle: 168,
    colors: ["#161038", "#241A5E", "#13224E", "#0A1130"],
    locations: [0, 0.38, 0.68, 1],
  },
  // Тёмная: фиолет .5 / циан .3 / роз .26 / — (4-й блоб убран, CSS строка 27).
  blobs: [
    { color: "rgba(124,92,255,0.5)", size: 380, top: -110, left: -80 },
    { color: "rgba(34,211,238,0.3)", size: 360, top: 250, right: -120 },
    { color: "rgba(244,114,182,0.26)", size: 380, top: 480, left: -110 },
  ],
  glass1: { angle: 135, colors: ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"], blur: 24 },
  glass2: { angle: 135, colors: ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.04)"], blur: 20 },
  glassBorder: "rgba(255,255,255,0.16)",
  glassInset: { y: 1, color: "rgba(255,255,255,0.22)" },
  shCard: { x: 0, y: 12, blur: 32, color: "rgba(4,6,20,0.35)" },
  shFloat: { x: 0, y: 18, blur: 40, color: "rgba(3,5,18,0.50)" },
  shColor: (rgb) => ({ x: 0, y: 0, blur: 10, color: `rgba(${rgb},0.50)` }),
  chip: (rgb) => ({ bg: `rgba(${rgb},0.14)`, border: `rgba(${rgb},0.38)` }),
  subjects: {
    prog: { base: "#0284C7", accent: "#38BDF8", grad: ["#38BDF8", "#0284C7"] },
    robo: { base: "#0D9488", accent: "#2DD4BF", grad: ["#2DD4BF", "#0D9488"] },
    math: { base: "#CA8A04", accent: "#EAB308", grad: ["#FACC15", "#CA8A04"] },
    eng: { base: "#DB2777", accent: "#F472B6", grad: ["#F472B6", "#DB2777"] },
    rus: { base: "#A21CAF", accent: "#E879F9", grad: ["#E879F9", "#A21CAF"] },
  },
  // Тёмные акценты статусов — из CSS-маппинга макета (строки 93–104).
  status: {
    green: { text: "#34D399", rgb: "16,185,129" },
    red: { text: "#F87171", rgb: "239,68,68" },
    violet: { text: "#C4B5FD", rgb: "139,92,246" },
    orange: { text: "#FB923C", rgb: "249,115,22" },
    blue: { text: "#93C5FD", rgb: "59,130,246" },
    gray: { text: "#CBD5E1", rgb: "100,116,139" },
  },
};

/**
 * Конвертация CSS-угла градиента в start/end для expo-linear-gradient.
 * CSS: 0° — вверх, угол растёт по часовой; вектор направления (sinθ, -cosθ).
 */
export function gradPoints(angle: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return {
    start: { x: 0.5 - dx, y: 0.5 - dy },
    end: { x: 0.5 + dx, y: 0.5 + dy },
  };
}

/** Тень RN из ShadowToken (iOS shadow* + android elevation-приближение). */
export function shadowStyle(t: ShadowToken) {
  return {
    shadowColor: t.color,
    shadowOffset: { width: t.x, height: t.y },
    shadowRadius: t.blur / 2,
    shadowOpacity: 1,
    elevation: Math.round(t.blur / 4),
  } as const;
}
