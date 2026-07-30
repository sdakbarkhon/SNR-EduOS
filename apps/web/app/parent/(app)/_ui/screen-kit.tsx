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
  ink1,
  ink2,
  ink3,
  radius,
  status,
  type StatusKey,
} from "../v2/tokens";

/* ── Производные цвета (в мобилке — внутри соответствующих ui-компонентов) ── */

/** Разделитель строк внутри карточки-списка. */
export const DIVIDER = "rgba(23,18,67,0.07)";
/** Цвет SectionHeader — rgba(26,19,74,.5). */
export const SECTION_CAP = "rgba(26,19,74,0.5)";
/** Шеврон строки. */
export const CHEVRON = "rgba(26,19,74,0.4)";
/** Неактивная пилюля SegmentPills: 160° W60→W40, текст .66. */
export const PILL_INACTIVE_BG =
  "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(255,255,255,0.4))";
export const PILL_INACTIVE_TEXT = "rgba(26,19,74,0.66)";
/** Тень активной пилюли: 0 8 18 rgba(124,58,237,.35). */
export const PILL_ACTIVE_SHADOW = "0 8px 18px rgba(124,58,237,0.35)";
/** Онлайн-точка макета: #22C55E + белая обводка 2px. */
export const ONLINE_GREEN = "#22C55E";
export const WHITE = "#FFFFFF";

/** Градиент 135° из пары стопов — форма макета для всех плиток/аватаров. */
export function grad135(g: readonly [string, string]): string {
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

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
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/** Часто используемые глифы (те же пути, что в RN-экранах мобилки). */
export const ICON = {
  back: ["M19 12H5", "m12 19-7-7 7-7"],
  chevron: ["m9 18 6-6-6-6"],
  kebab: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  mega: ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  chat: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  doc: [
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
    "M14 3v5h5",
    "M9 13h6",
    "M9 17h4",
  ],
  shield: [
    "M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z",
    "m9 12 2 2 4-4",
  ],
  check: ["M20 6 9 17l-5-5"],
  checkSquare: [
    "M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z",
    "m8.5 12 2.5 2.5 5-5",
  ],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  wallet: [
    "M20 12V8H6a2 2 0 0 1 0-4h12v4",
    "M4 6v12a2 2 0 0 0 2 2h14v-6",
    "M18 12a2 2 0 0 0 0 4h4v-4Z",
  ],
  card: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
  lock: ["M4 11h16v10H4Z", "M8 11V7a4 4 0 0 1 8 0v4"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M3 12h18", "M12 3a13 13 0 0 1 0 18", "M12 3a13 13 0 0 0 0 18"],
  help: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M9 10a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7",
    "M12 17h.01",
  ],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8h.01", "M11 12h1v4h1"],
  user: ["M20 21a8 8 0 1 0-16 0", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  pin: ["M12 17v5", "M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z"],
  inbox: ["M3 12h5l2 3h4l2-3h5", "M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z"],
} as const;

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
