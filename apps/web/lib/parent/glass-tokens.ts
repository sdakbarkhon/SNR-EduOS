/**
 * Liquid Glass токены для веб-родителя (apps/web/app/parent/**) — значения
 * перенесены 1:1 из apps/mobile-parent/src/theme/tokens.ts (lightTokens),
 * только светлая тема (без переключения тем в этом заходе). Мобильные
 * значения не "улучшать" — там они дословно из утверждённого макета.
 *
 * В RN токены применяются через expo-blur/expo-linear-gradient/RN shadow*;
 * здесь тот же визуальный эффект собирается на CSS (backdrop-filter +
 * linear-gradient + inset box-shadow) — см. apps/web/components/parent/glass/.
 */

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
  page: 18,
  block: 12,
} as const;

export const accent = "#7C3AED";
export const accentGradCss = "linear-gradient(135deg, #7C3AED, #4F6DF5)";

export const bgPageCss =
  "linear-gradient(165deg, #DCD2FD 0%, #C7D3FD 34%, #C2E0FC 64%, #ECD9FB 100%)";

export interface BlobToken {
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

// Геометрия блобов дословно из мобильных токенов (кадр 390×844) — на узкой
// веб-колонке того же примерного max-width работает без пересчёта.
export const blobs: BlobToken[] = [
  { color: "rgba(124,92,255,0.5)", size: 380, top: -110, left: -80 },
  { color: "rgba(34,211,238,0.42)", size: 360, top: 250, right: -120 },
  { color: "rgba(244,114,182,0.4)", size: 380, top: 480, left: -110 },
  { color: "rgba(96,140,255,0.44)", size: 340, bottom: -100, right: -70 },
];

export const glass1Css = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46))",
  backdropFilter: "blur(22px)",
  WebkitBackdropFilter: "blur(22px)",
} as const;

export const glass2Css = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.58), rgba(255,255,255,0.36))",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const;

export const glassBorder = "rgba(255,255,255,0.78)";
export const glassInsetCss = "inset 0 1.5px 0 rgba(255,255,255,0.95)";

export const shCardCss = "0 14px 34px rgba(99,86,214,0.16)";
export const shFloatCss = "0 20px 48px rgba(78,66,190,0.30)";

export const ink1 = "#171243";
export const ink2 = "rgba(26,19,74,0.64)";
export const ink3 = "rgba(26,19,74,0.45)";
