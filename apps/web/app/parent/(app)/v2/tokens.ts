/**
 * Блок 7.1 — дизайн-токены SNR EduOS v2 для ВЕБ-родителя.
 *
 * Источник 1:1 — apps/mobile-parent/src/theme/tokens.ts с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go),
 * которая, в свою очередь, перенесена дословно из утверждённого макета
 * «SNR EduOS v2 Light.dc.html» §s10 «Токены».
 *
 * ВАЖНО: значения не «улучшать» — они дословные. Мобилка задаёт эталон,
 * веб обязан совпадать. При расхождении правится сначала макет.
 *
 * Отличия от мобильного файла (осознанные, из-за платформы):
 *   * только СВЕТЛАЯ тема — тёмную веб пока не поддерживает (прямое
 *     указание задачи), поэтому darkTokens не переносятся вовсе;
 *   * градиенты хранятся сразу CSS-строками (в RN нужен был helper
 *     gradPoints() под expo-linear-gradient — вебу он не нужен, CSS
 *     понимает угол напрямую, и это как раз ИСХОДНАЯ форма из макета);
 *   * тени — CSS box-shadow строками (в RN была раскладка на
 *     shadowOffset/shadowRadius + elevation).
 */

/* ===== Геометрия (общая, §s10) ===== */

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
  /** Межблочные отступы. */
  block: 12,
} as const;

/* ===== Светлая тема ===== */

export const ink1 = "#171243";
export const ink2 = "rgba(26,19,74,0.64)";
export const ink3 = "rgba(26,19,74,0.45)";

export const accent = "#7C3AED";
export const accentGrad = "linear-gradient(135deg, #7C3AED, #4F6DF5)";

/** Фон страницы (§s10 bg-page). */
export const bgPage =
  "linear-gradient(165deg, #DCD2FD 0%, #C7D3FD 34%, #C2E0FC 64%, #ECD9FB 100%)";

/** Радиальные блобы фона — геометрия макета (строки 213–216, кадр 390×844). */
export const blobs = [
  { color: "rgba(124,92,255,0.5)", size: 380, top: -110, left: -80 },
  { color: "rgba(34,211,238,0.42)", size: 360, top: 250, right: -120 },
  { color: "rgba(244,114,182,0.4)", size: 380, top: 480, left: -110 },
  { color: "rgba(96,140,255,0.44)", size: 340, bottom: -100, right: -70 },
] as const;

/** Стекло: основное (glass-1) и тонкое (glass-2). */
export const glass1 = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46))",
  blur: 22,
};
export const glass2 = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.58), rgba(255,255,255,0.36))",
  blur: 20,
};

export const glassBorder = "rgba(255,255,255,0.78)";
/** inset-блик сверху (в вебе — настоящий inset box-shadow, в RN его пришлось рисовать линией). */
export const glassInset = "inset 0 1.5px 0 rgba(255,255,255,0.95)";

export const shCard = "0 14px 34px rgba(99,86,214,0.16)";
export const shFloat = "0 20px 48px rgba(78,66,190,0.30)";

/** Цветная тень под акцентной плиткой: sh-color. */
export const shColor = (rgb: string) => `0 8px 18px rgba(${rgb},0.30)`;

/** Фон/бордер чипа из базы «R,G,B». */
export const chip = (rgb: string) => ({
  background: `rgba(${rgb},0.13)`,
  borderColor: `rgba(${rgb},0.33)`,
});

/* ===== Предметы (§s10) ===== */

export type SubjectKey = "prog" | "robo" | "math" | "eng" | "rus";

export const subjects: Record<SubjectKey, { base: string; accent: string; grad: [string, string] }> = {
  prog: { base: "#0284C7", accent: "#0284C7", grad: ["#38BDF8", "#0284C7"] },
  robo: { base: "#0D9488", accent: "#0D9488", grad: ["#2DD4BF", "#0D9488"] },
  math: { base: "#CA8A04", accent: "#CA8A04", grad: ["#FACC15", "#CA8A04"] },
  eng: { base: "#DB2777", accent: "#DB2777", grad: ["#F472B6", "#DB2777"] },
  rus: { base: "#A21CAF", accent: "#A21CAF", grad: ["#E879F9", "#A21CAF"] },
};

/** Градиент плитки предмета — всегда 135°, как в макете. */
export const subjectGrad = (k: SubjectKey) =>
  `linear-gradient(135deg, ${subjects[k].grad[0]}, ${subjects[k].grad[1]})`;

/* ===== Статусы (§s10) ===== */

export type StatusKey = "green" | "red" | "violet" | "orange" | "blue" | "gray";

export const status: Record<StatusKey, { text: string; rgb: string }> = {
  green: { text: "#047857", rgb: "16,185,129" },
  red: { text: "#B91C1C", rgb: "239,68,68" },
  violet: { text: "#6D28D9", rgb: "139,92,246" },
  orange: { text: "#C2410C", rgb: "249,115,22" },
  blue: { text: "#1D4ED8", rgb: "59,130,246" },
  gray: { text: "#475569", rgb: "100,116,139" },
};

/* ===== Шрифты =====
 * Макет: Manrope (текст) + Unbounded (акцидентные заголовки). Подключены
 * через next/font в layout родителя — здесь только имена CSS-переменных.
 */
export const fontSans = "var(--font-manrope), 'Segoe UI', sans-serif";
export const fontDisplay = "var(--font-unbounded), var(--font-manrope), sans-serif";
