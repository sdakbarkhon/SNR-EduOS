/**
 * Мелкие детали, общие для подэкранов «Оплаты».
 *
 * Всё крупное (InnerHeader, ScreenScroll, SectionCap, SegmentPills, IconTile,
 * StatusChip, EmptyState, Glyph/ICON) берётся из `../_ui/screen-kit` — здесь
 * ТОЛЬКО то, чего там нет и что нужно минимум двум экранам раздела:
 * бренд-плашка платёжной системы, цветной info-баннер и строка «пока не
 * работает».
 *
 * Директивы "use client" файлу не нужно: он не держит состояния и попадает в
 * клиентский бандл вместе с теми экранами, которые его импортируют.
 */
import { Glyph } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON, WHITE } from "../_ui/screen-tokens";
import { chip, ink1, ink2, status, type StatusKey } from "../v2/tokens";

/** Глифы, которых нет в общем ICON: нужны только платёжным экранам. */
export const PAY_GLYPH = {
  plus: ["M12 5v14", "M5 12h14"],
  bolt: ["m13 2-2 9h6l-8 11 2-9H5l8-11Z"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
} as const;

/* ── Бренд-плашка платёжной системы (40×28, макет 1080–1082) ────────────── */

export function BrandChip({
  gradient,
  label,
}: {
  gradient: readonly [string, string];
  label: string;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 40,
        height: 28,
        borderRadius: 8,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        fontSize: 7,
        fontWeight: 800,
        letterSpacing: 0.28,
        color: WHITE,
      }}
    >
      {label}
    </span>
  );
}

/* ── Цветной info-баннер (green / blue) ─────────────────────────────────── */

/**
 * Плашка «на цветной подложке» из макета: rgba(<status>,.10) + border .30,
 * r18, иконка слева. Встречается на трёх экранах раздела с разными цветами.
 */
export function NoticeBanner({
  family,
  paths = ICON.shield,
  title,
  text,
}: {
  family: StatusKey;
  paths?: readonly string[];
  title?: string;
  text: string;
}) {
  const st = status[family];
  return (
    <div
      className="flex items-start"
      style={{
        gap: 10,
        padding: "12px 14px",
        borderRadius: 18,
        background: `rgba(${st.rgb},0.10)`,
        border: `1px solid rgba(${st.rgb},0.30)`,
      }}
    >
      <span style={{ paddingTop: 1 }}>
        <Glyph paths={paths} size={17} color={st.text} strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        {title ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>{title}</span>
        ) : null}
        <span style={{ fontSize: 10, fontWeight: 600, lineHeight: "15.5px", color: ink2 }}>
          {text}
        </span>
      </span>
    </div>
  );
}

/* ── «Функция появится скоро» ───────────────────────────────────────────── */

/**
 * Ответ на нажатие действия, которое упирается в отсутствующий платёжный
 * бэкенд. Показывается ПРЯМО У НАЖАТОЙ кнопки (а не общим тостом наверху
 * экрана), чтобы родитель увидел объяснение там, где он только что кликнул.
 */
export function SoonNote({ text }: { text: string }) {
  const c = chip(status.violet.rgb);
  return (
    <p
      role="status"
      className="flex items-start"
      style={{
        gap: 8,
        marginTop: 8,
        padding: "9px 11px",
        borderRadius: 12,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
      }}
    >
      <span style={{ paddingTop: 1 }}>
        <Glyph paths={ICON.info} size={13} color={status.violet.text} strokeWidth={2} />
      </span>
      <span
        className="min-w-0 flex-1"
        style={{ fontSize: 10, fontWeight: 700, lineHeight: "15px", color: status.violet.text }}
      >
        {text}
      </span>
    </p>
  );
}
