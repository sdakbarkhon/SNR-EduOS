"use client";

/**
 * Общие примитивы «внутренних» (не-табовых) экранов веб-родителя.
 *
 * Это веб-эквивалент того, что в мобилке лежит в `apps/mobile-parent/src/ui/*`
 * (InnerHeader, GlassCircleButton, SegmentPills, Toggle, SectionHeader …) и
 * переиспользуется всеми stack-экранами. В вебе такого модуля ещё не было:
 * `v2/` содержит только фундамент табов (AppBackground / GlassCard /
 * RootHeader / FloatingTabBar), поэтому каждый новый экран иначе копировал бы
 * одни и те же 200 строк стекла и SVG.
 *
 * Папка `_ui` — приватная для App Router (имя с подчёркиванием не создаёт
 * маршрут), лежит рядом с экранами, которые её используют.
 *
 * Геометрия/цвета — из `../v2/tokens` (единственный источник правды, дословный
 * перенос макета «SNR EduOS v2 Light.dc.html»). Здесь НЕ вводится ни одного
 * нового цвета, кроме локальных производных (divider/chevron/caps), которые в
 * мобилке точно так же живут внутри ui-компонентов.
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  accentGrad,
  chip,
  fontDisplay,
  glass1,
  glassBorder,
  grad135,
  ink1,
  ink2,
  ink3,
  radius,
  status,
  type StatusKey,
} from "../v2/tokens";

/* ── Чистые значения ──────────────────────────────────────────────────────
 * Производные цвета и ICON переехали в `./screen-tokens` (модуль БЕЗ
 * "use client"), а `grad135` — в `../v2/tokens`. Причина подробно расписана
 * в шапке screen-tokens.ts: за границей "use client" не-компонентный экспорт
 * подменяется клиентской ссылкой, из-за чего в серверных компонентах
 * `ICON.doc` был undefined, а `${DIVIDER}` подставлял текст функции.
 *
 * Реэкспорт ниже — для КЛИЕНТСКИХ экранов: они как импортировали эти имена
 * из screen-kit, так и импортируют. Серверные компоненты обязаны брать их
 * напрямую из `./screen-tokens`.
 */
import {
  CHEVRON,
  DIVIDER,
  ICON,
  ONLINE_GREEN,
  PILL_ACTIVE_SHADOW,
  PILL_INACTIVE_BG,
  PILL_INACTIVE_TEXT,
  SECTION_CAP,
  WHITE,
} from "./screen-tokens";

export {
  CHEVRON,
  DIVIDER,
  ICON,
  ONLINE_GREEN,
  PILL_ACTIVE_SHADOW,
  PILL_INACTIVE_BG,
  PILL_INACTIVE_TEXT,
  SECTION_CAP,
  WHITE,
  grad135,
};

/* ── Глиф: SVG-пути 24×24, как ICONS макета ─────────────────────────────── */

export function Glyph({
  paths,
  size = 16,
  color = "#FFFFFF",
  strokeWidth = 1.9,
  fill = "none",
}: {
  paths: readonly string[];
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === "none" ? color : "none"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {/* `paths ?? []` — страховка: если иконка приедет undefined (например,
          серверный компонент прочитает ICON через клиентскую границу), экран
          останется без глифа, но не упадёт с «Cannot read … of undefined». */}
      {(paths ?? []).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/* ICON переехал в ./screen-tokens (см. шапку того файла) и реэкспортируется выше. */

/* ── Круглая стеклянная кнопка 38 (RootHeader.GlassCircleButton) ─────────── */

const CIRCLE_STYLE: CSSProperties = {
  background: glass1.background,
  border: `1px solid ${glassBorder}`,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

export function GlassCircleButton({
  href,
  onClick,
  ariaLabel,
  children,
}: {
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const cls =
    "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition-transform active:scale-95";
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cls} style={CIRCLE_STYLE}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cls} style={CIRCLE_STYLE}>
      {children}
    </button>
  );
}

/* ── InnerHeader: back(38) + Unbounded 15/600 title + правый слот ────────── */

/**
 * В мобилке «назад» — `navigation.goBack()` из стека. В вебе стека нет:
 * экран может быть открыт по прямой ссылке, и `router.back()` тогда уводит
 * вообще из приложения. Поэтому back — обычная ссылка на РОДИТЕЛЬСКИЙ экран
 * (`backHref`), это устойчиво и к прямому переходу, и к обновлению страницы.
 */
export function InnerHeader({
  title,
  backHref,
  titleSize = 15,
  right,
}: {
  title: string;
  backHref: string;
  titleSize?: number;
  right?: ReactNode;
}) {
  return (
    <header
      className="flex items-center"
      style={{
        gap: 12,
        paddingTop: "max(env(safe-area-inset-top), 46px)",
        paddingInline: 18,
        paddingBottom: 8,
      }}
    >
      <GlassCircleButton href={backHref} ariaLabel="Назад">
        <Glyph paths={ICON.back} size={18} color={ink1} strokeWidth={2} />
      </GlassCircleButton>
      <h1
        className="min-w-0 flex-1 truncate"
        style={{ fontFamily: fontDisplay, fontSize: titleSize, fontWeight: 600, color: ink1 }}
      >
        {title}
      </h1>
      {right}
    </header>
  );
}

/* ── Скролл-контейнер внутреннего экрана ────────────────────────────────── */

/** paddingH 18, paddingTop 4, gap 12 — как contentContainerStyle мобилки.
 *  Нижний отступ под плавающий таб-бар уже даёт ParentAppShell (pb-104). */
export function ScreenScroll({
  gap = 12,
  children,
}: {
  gap?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ gap, paddingInline: 18, paddingTop: 4, paddingBottom: 14 }}
    >
      {children}
    </div>
  );
}

/* ── SectionHeader / SectionCap ─────────────────────────────────────────── */

export function SectionCap({ label, tone = "section" }: { label: string; tone?: "section" | "ink3" }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: 0.84,
        textTransform: "uppercase",
        color: tone === "ink3" ? ink3 : SECTION_CAP,
      }}
    >
      {label}
    </span>
  );
}

/* ── SegmentPills ───────────────────────────────────────────────────────── */

export function SegmentPills({
  items,
  activeIndex,
  onChange,
  dotIndexes,
}: {
  items: readonly string[];
  activeIndex: number;
  onChange: (index: number) => void;
  dotIndexes?: readonly number[];
}) {
  return (
    <div className="flex gap-[7px]">
      {items.map((label, i) => {
        const active = i === activeIndex;
        const style: CSSProperties = active
          ? { background: accentGrad, color: WHITE, fontWeight: 800, boxShadow: PILL_ACTIVE_SHADOW }
          : { background: PILL_INACTIVE_BG, color: PILL_INACTIVE_TEXT, fontWeight: 700 };
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(i)}
            className="relative flex flex-1 items-center justify-center rounded-full py-[9px] text-[11.5px]"
            style={style}
          >
            {label}
            {dotIndexes?.includes(i) ? (
              <span
                aria-hidden
                className="pointer-events-none absolute rounded-full"
                style={{ top: 4, right: 6, width: 6, height: 6, background: "#EF4444" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── Шеврон / плитка-иконка / строка карточки ───────────────────────────── */

export function ChevronRight() {
  return <Glyph paths={ICON.chevron} size={14} color={CHEVRON} strokeWidth={2.2} />;
}

/** Градиентная плитка с белым глифом: 36×36 r12 (строки) или 38×38 r19 (круг). */
export function IconTile({
  gradient,
  paths,
  size = 36,
  round = false,
  glyphSize,
}: {
  gradient: readonly [string, string];
  paths: readonly string[];
  size?: number;
  round?: boolean;
  glyphSize?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 12,
        background: grad135(gradient),
        boxShadow: `0 6px 12px ${gradient[1]}44`,
      }}
    >
      <Glyph paths={paths} size={glyphSize ?? Math.round(size * 0.42)} color={WHITE} strokeWidth={1.9} />
    </span>
  );
}

/** Строка списка внутри GlassCard: gap 11, py 11, верхний divider кроме первой. */
export function CardRow({
  href,
  onClick,
  divider,
  children,
  paddingY = 11,
}: {
  href?: string;
  onClick?: () => void;
  divider: boolean;
  children: ReactNode;
  paddingY?: number;
}) {
  const style: CSSProperties = {
    gap: 11,
    paddingTop: paddingY,
    paddingBottom: paddingY,
    borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
  };
  const cls = "flex w-full items-center text-left";
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

/** Заголовок + подпись строки — общий текстовый блок CardRow. */
export function RowText({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
        {title}
      </span>
      {subtitle ? (
        <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}

/* ── Toggle / CheckDot ──────────────────────────────────────────────────── */

export function Toggle({
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 44,
        height: 26,
        background: value ? accentGrad : "rgba(23,18,67,0.14)",
        boxShadow: value ? "0 6px 14px rgba(124,58,237,0.32)" : undefined,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all"
        style={{
          top: 3,
          left: value ? 21 : 3,
          width: 20,
          height: 20,
          boxShadow: "0 2px 6px rgba(23,18,67,0.28)",
        }}
      />
    </button>
  );
}

export function CheckDot({ active }: { active: boolean }) {
  if (!active) {
    return (
      <span
        className="shrink-0 rounded-full"
        style={{ width: 22, height: 22, border: "1.5px solid rgba(23,18,67,0.22)" }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: 22, height: 22, background: accentGrad }}
    >
      <Glyph paths={ICON.check} size={12} color={WHITE} strokeWidth={3} />
    </span>
  );
}

/* ── Аватар с инициалами ────────────────────────────────────────────────── */

/** Avatar variant="ring": инициалы на градиенте 135° + кольцо(а) box-shadow. */
export function Avatar({
  size,
  initials,
  gradient,
  ringColor,
  fontSize,
  online = false,
}: {
  size: number;
  initials: string;
  gradient: readonly [string, string];
  ringColor?: string;
  fontSize?: number;
  online?: boolean;
}) {
  const ring = ringColor
    ? `0 0 0 2px ${WHITE}, 0 0 0 4.5px ${ringColor}`
    : `0 0 0 2px ${WHITE}`;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size, margin: ringColor ? 4.5 : 0 }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: grad135(gradient),
          boxShadow: ring,
          color: WHITE,
          fontSize: fontSize ?? Math.round(size * 0.3),
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
      {online ? (
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: Math.max(10, Math.round(size * 0.26)),
            height: Math.max(10, Math.round(size * 0.26)),
            background: ONLINE_GREEN,
            border: `2px solid ${WHITE}`,
          }}
        />
      ) : null}
    </span>
  );
}

/* ── Чипы ───────────────────────────────────────────────────────────────── */

export function StatusChip({
  label,
  family,
  dot = false,
  fontSize = 9,
}: {
  label: string;
  family: StatusKey;
  dot?: boolean;
  fontSize?: number;
}) {
  const st = status[family];
  const c = chip(st.rgb);
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap"
      style={{
        gap: 5,
        padding: "4px 9px",
        borderRadius: radius.chip,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
      }}
    >
      {dot ? (
        <span style={{ width: 6, height: 6, borderRadius: 3, background: `rgb(${st.rgb})` }} />
      ) : null}
      <span style={{ fontSize, fontWeight: 800, color: st.text, lineHeight: 1.2 }}>{label}</span>
    </span>
  );
}

/* ── Кнопки ─────────────────────────────────────────────────────────────── */

/** PrimaryButton макета: accent-градиент 135°, r16, тень 0 14 32, inset-блик. */
export function PrimaryButton({
  label,
  onClick,
  href,
  disabled = false,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const style: CSSProperties = {
    padding: 15,
    borderRadius: 16,
    background: accentGrad,
    boxShadow: "0 14px 32px rgba(124,58,237,0.4)",
    fontSize: 14,
    fontWeight: 800,
    color: WHITE,
    opacity: disabled ? 0.6 : 1,
  };
  const inner = (
    <>
      {label}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
      />
    </>
  );
  if (href) {
    return (
      <Link href={href} className="relative block overflow-hidden text-center" style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="relative overflow-hidden" style={style}>
      {inner}
    </button>
  );
}

/* ── Пустое состояние ───────────────────────────────────────────────────── */

/**
 * Единый empty-state. Нужен чаще, чем в мобилке: там экраны рисовали
 * фикстуры и «пусто» не бывало никогда, а здесь данные реальные — и часть
 * разделов у конкретной семьи действительно пуста.
 */
export function EmptyState({
  title,
  text,
  paths = ICON.inbox,
}: {
  title: string;
  text?: string;
  paths?: readonly string[];
}) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 8, paddingBlock: 26 }}>
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: 46, height: 46, background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.22)" }}
      >
        <Glyph paths={paths} size={20} color={ink2} strokeWidth={1.7} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: ink1, textAlign: "center" }}>{title}</span>
      {text ? (
        <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "16px", color: ink2, textAlign: "center" }}>
          {text}
        </span>
      ) : null}
    </div>
  );
}
