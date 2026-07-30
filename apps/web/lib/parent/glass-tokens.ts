/**
 * Liquid Glass токены для веб-родителя (apps/web/app/parent/**) — значения
 * перенесены 1:1 из apps/mobile-parent/src/theme/tokens.ts. Мобильные
 * значения не "улучшать" — там они дословно из утверждённого макета.
 *
 * В RN токены применяются через expo-blur/expo-linear-gradient/RN shadow*;
 * здесь тот же визуальный эффект собирается на CSS (backdrop-filter +
 * linear-gradient + inset box-shadow) — см. apps/web/components/parent/glass/.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ТЁМНАЯ ТЕМА: почему здесь var(), а не цвета
 *
 * Всё это применяется ИНЛАЙН-стилями из серверных компонентов, где ни
 * Tailwind-вариант `dark:`, ни клиентский стейт не работают. Поэтому имена и
 * места использования сохранены, а константа хранит теперь ссылку на
 * CSS-переменную; значения обеих схем лежат в
 * apps/web/app/parent/parent-theme.css (`html { --p-* }` / `html.dark { --p-* }`).
 * Переключение — классом `dark` на <html>, разметка не меняется вовсе.
 *
 * Второй аргумент var() — светлое значение как fallback, и он тут не
 * косметика: этот модуль импортируют не только /parent, но и app/login
 * (QrModal). Если parent-theme.css на конкретном роуте не подключён,
 * экран останется светлым и рабочим вместо «чёрного по прозрачному».
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

export const accent = "var(--p-accent, #7C3AED)";
export const accentGradCss = "var(--p-accent-grad, linear-gradient(135deg, #7C3AED, #4F6DF5))";

export const bgPageCss =
  "var(--p-bg-page, linear-gradient(165deg, #DCD2FD 0%, #C7D3FD 34%, #C2E0FC 64%, #ECD9FB 100%))";

export interface BlobToken {
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

// Геометрия блобов дословно из мобильных токенов (кадр 390×844) — на узкой
// веб-колонке того же примерного max-width работает без пересчёта. В обеих
// темах она одинакова, различается только цвет: в тёмной циан и розовый
// бледнее, а четвёртый (синий) в прототипе спрятан целиком (--p-blob4:
// transparent), поэтому здесь по-прежнему четыре элемента.
export const blobs: BlobToken[] = [
  { color: "var(--p-blob1, rgba(124,92,255,0.5))", size: 380, top: -110, left: -80 },
  { color: "var(--p-blob2, rgba(34,211,238,0.42))", size: 360, top: 250, right: -120 },
  { color: "var(--p-blob3, rgba(244,114,182,0.4))", size: 380, top: 480, left: -110 },
  { color: "var(--p-blob4, rgba(96,140,255,0.44))", size: 340, bottom: -100, right: -70 },
];

// Здесь строка фильтра собирается целиком, поэтому темизируется и радиус
// размытия (тёмная тема: 24px у glass-1). Подставлять var() внутрь чужого
// шаблона `blur(${n}px)` нельзя — см. комментарий у glass1 в
// app/parent/(app)/v2/tokens.ts.
export const glass1Css = {
  background: "var(--p-glass1-bg, linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46)))",
  backdropFilter: "blur(var(--p-glass1-blur, 22px))",
  WebkitBackdropFilter: "blur(var(--p-glass1-blur, 22px))",
} as const;

export const glass2Css = {
  background: "var(--p-glass2-bg, linear-gradient(160deg, rgba(255,255,255,0.58), rgba(255,255,255,0.36)))",
  backdropFilter: "blur(var(--p-glass2-blur, 20px))",
  WebkitBackdropFilter: "blur(var(--p-glass2-blur, 20px))",
} as const;

export const glassBorder = "var(--p-glass-border, rgba(255,255,255,0.78))";
export const glassInsetCss = "var(--p-glass-inset, inset 0 1.5px 0 rgba(255,255,255,0.95))";

export const shCardCss = "var(--p-sh-card, 0 14px 34px rgba(99,86,214,0.16))";
export const shFloatCss = "var(--p-sh-float, 0 20px 48px rgba(78,66,190,0.30))";

export const ink1 = "var(--p-ink1, #171243)";
export const ink2 = "var(--p-ink2, rgba(26,19,74,0.64))";
export const ink3 = "var(--p-ink3, rgba(26,19,74,0.45))";
