/**
 * SNR EduOS — общие дизайн-токены (design_spec §1).
 * Framework-agnostic: используются и в web (Tailwind / инлайн-стили),
 * и в mobile (React Native StyleSheet). Числовые значения — в px/pt.
 */

export const colors = {
  primary: "#2D5BFF",
  primaryAlt: "#3B6FF5",
  bgApp: "#F4F6FB",
  bgAppAlt: "#EEF2FB",
  bgCard: "#FFFFFF",
  textPrimary: "#1A2138",
  textMuted: "#8A93A8",
  success: "#2DBE7E",
  warning: "#F5A623",
  danger: "#F0556B",
  info: "#39B6F5",
  typeFile: "#2563EB",
  typeTest: "#7C3AED",
} as const;

/** Сине-фиолетовый градиент: панель логина, hero-блоки, полноэкранный отсчёт. */
export const primaryGradient = ["#2D5BFF", "#7A4DFF"] as const;

export const radii = {
  card: 16,
  cardLg: 20,
  cardXl: 24,
  button: 12,
  tile: 14,
  chip: 999,
} as const;

export const spacing = {
  cardPadding: 16,
  cardPaddingLg: 20,
  gap: 16,
} as const;

export const shadows = {
  card: "0 8px 24px rgba(40, 60, 120, 0.08)",
} as const;

export const typography = {
  fontFamily: "Inter, system-ui, sans-serif",
  screenTitle: 24,
  cardTitle: 17,
  body: 14,
  meta: 12,
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/** Статус-чипы (design_spec §1.4) — единый цветовой словарь. */
export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

export const statusColors: Record<StatusVariant, { bg: string; fg: string }> = {
  success: { bg: "rgba(45, 190, 126, 0.12)", fg: colors.success },
  warning: { bg: "rgba(245, 166, 35, 0.14)", fg: colors.warning },
  danger: { bg: "rgba(240, 85, 107, 0.12)", fg: colors.danger },
  info: { bg: "rgba(57, 182, 245, 0.12)", fg: colors.info },
  neutral: { bg: "rgba(138, 147, 168, 0.14)", fg: colors.textMuted },
};

/** Градиентный сайдбар (синий → тёмно-синий). */
export const sidebar = {
  from: "#2A75FF",
  to: "#0A3CB4",
} as const;

/** Градиент баннера «Факт дня». */
export const factBanner = {
  from: "#179BFF",
  mid: "#336FF8",
  to: "#6D4AFF",
} as const;

/** Палитра экрана Login (референс design-reference): космический фон + glass-карточка. */
export const brand = {
  blue: "#007BFF",
  blueHover: "#0069D9",
  blueLink: "#0056B3",
  yellow: "#FFC107",
  logoAccent: "#F59E0B",
  navy: "#101B4C",
  navy2: "#13206A",
  logoFrom: "#417BFF",
  logoTo: "#0B3EDB",
  glowBlue: "#3B82F6",
  glowPurple: "#9C51F0",
  fieldBg: "#F0F4F8",
  ink: "#1A1A24",
  inkMuted: "#4A5568",
} as const;

export const tokens = {
  colors,
  brand,
  sidebar,
  factBanner,
  primaryGradient,
  radii,
  spacing,
  shadows,
  typography,
  statusColors,
} as const;

export type Tokens = typeof tokens;
