/**
 * Блок 7.2 — presentational-примитивы «учебных» экранов веб-родителя.
 *
 * Всё перенесено с ветки feat/mobile-parent-redesign (только читалась):
 *   apps/mobile-parent/src/ui/{SectionHeader,StatusChip,SubjectTile,
 *   ChildSwitcherCard,ListRow}.tsx и локальные под-компоненты экранов
 *   study/{AttendanceScreen,HomeworksScreen}.tsx.
 * View → div, Text → span, Pressable → button/Link, StyleSheet → Tailwind +
 * inline из ../v2/tokens.ts. Стекло — ../v2/GlassCard (второй копии не заводим).
 *
 * Файл БЕЗ "use client": это чистые компоненты без хуков и браузерных API,
 * поэтому их одинаково может рендерить и серверный, и клиентский экран.
 */

import type { CSSProperties, ReactNode } from "react";
import { GlassCard } from "../v2/GlassCard";
import {
  accentGrad,
  chip,
  fontDisplay,
  glass1,
  glassBorder,
  glassInset,
  ink1,
  ink2,
  ink3,
  shCard,
  status,
  type StatusKey,
} from "../v2/tokens";
import { DIVIDER, SECTION_CAP } from "../_ui/screen-tokens";
import { hexToRgbCsv, initials, subjectColor, subjectGlyph } from "./util";

/* ─── контейнер контента (макет: padding 4/18/118, gap 12) ────────────────── */

/** Нижний отступ под плавающий таб-бар даёт ParentAppShell (pb-[104px]) —
 *  здесь только горизонтальные поля и вертикальный ритм макета. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ paddingInline: 18, paddingTop: 4, gap: 12 }}>
      {children}
    </div>
  );
}

/* ─── caps-заголовок секции (SectionHeader, макет 2772) ───────────────────── */

/** Тот же цвет, что у общего SectionHeader родителя, — берём его токеном
 *  (rgba(26,19,74,.5) в светлой, белый с той же альфой в тёмной). */
const SECTION_TITLE = SECTION_CAP;

export function SectionCaps({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.84,
          textTransform: "uppercase",
          color: SECTION_TITLE,
        }}
      >
        {children}
      </span>
      {right}
    </div>
  );
}

/** Правая ссылка секции «Смотреть все ›» — 11.5/800 #6D28D9. */
export function SectionLink({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, color: status.violet.text }}>{children}</span>
  );
}

/* ─── статус-чип (StatusChip / MiniStatusChip) ────────────────────────────── */

export function MiniChip({
  label,
  family = "gray",
  dot = false,
}: {
  /** Не только строка: подпись состояния приезжает клиентским <StatusText/> —
   *  слово зависит от языка, а страницы раздела серверные. */
  label: ReactNode;
  family?: StatusKey;
  /** Точка-индикатор 5px слева («Идёт сейчас», макет 3522). */
  dot?: boolean;
}) {
  const st = status[family];
  const c = chip(st.rgb);
  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{
        gap: 4,
        paddingBlock: 2,
        paddingInline: 7,
        borderRadius: 999,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
        fontSize: 8.5,
        fontWeight: 800,
        color: st.text,
      }}
    >
      {dot && (
        <span
          style={{ width: 5, height: 5, borderRadius: 3, background: `rgb(${st.rgb})` }}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

/* ─── плитка предмета (SubjectTile, §s1 макета) ───────────────────────────── */

export function SubjectSquare({
  color,
  name,
  size = 40,
  radius = 13,
  glyph,
}: {
  color: string | null | undefined;
  name?: string | null;
  size?: number;
  radius?: number;
  /** Явный глиф; по умолчанию — 2 буквы названия. */
  glyph?: ReactNode;
}) {
  const base = subjectColor(color);
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${base}E6, ${base})`,
        boxShadow: `0 8px 18px rgba(${hexToRgbCsv(base)},0.30)`,
        fontSize: Math.round(size * 0.33),
        fontWeight: 800,
        letterSpacing: -0.2,
      }}
    >
      {glyph ?? subjectGlyph(name)}
    </span>
  );
}

/* ─── карточка ребёнка (ChildSwitcherCard variant="compact") ──────────────── */

/** У нашего родителя ребёнок ровно один, поэтому карточка НЕ кликабельна и
 *  без шеврона: шторка выбора вела бы в список из одного пункта. */
export function ChildCard({ name, className }: { name: string; className: string | null }) {
  return (
    <GlassCard radius={20}>
      <div className="flex items-center" style={{ gap: 11, padding: 11 }}>
        <span
          className="flex shrink-0 items-center justify-center text-white"
          style={{
            width: 44,
            height: 44,
            borderRadius: 15,
            background: accentGrad,
            boxShadow: "0 0 0 2px #fff",
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          {initials(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate" style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
            {name}
          </span>
          <span className="truncate" style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
            {className ?? "Класс не назначен"}
          </span>
        </span>
      </div>
    </GlassCard>
  );
}

/* ─── плитка статистики (AttendanceScreen StatTile, макет 593–595) ────────── */

export function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: StatusKey;
}) {
  const st = status[tone];
  return (
    <div
      className="flex flex-1 flex-col items-center"
      style={{
        gap: 2,
        paddingBlock: 12,
        paddingInline: 8,
        borderRadius: 16,
        background: `rgba(${st.rgb},0.13)`,
        border: `1px solid rgba(${st.rgb},0.32)`,
        boxShadow: `0 10px 22px rgba(${st.rgb},0.14)`,
      }}
    >
      <span style={{ fontFamily: fontDisplay, fontSize: 19, fontWeight: 600, color: st.text }}>
        {value}
      </span>
      <span
        className="text-center"
        style={{ fontSize: 8.5, fontWeight: 800, color: ink2, lineHeight: 1.25 }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── стеклянная плоская панель без скруглений GlassCard (списки) ─────────── */

/** Панель-список: та же поверхность glass1, но с пробросом padding —
 *  используется там, где макет рисует строки с border-top разделителями. */
export function GlassPanel({
  children,
  radius = 20,
  style,
}: {
  children: ReactNode;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: radius,
        background: glass1.background,
        border: `1px solid ${glassBorder}`,
        backdropFilter: "blur(var(--p-glass1-blur, 22px))",
        WebkitBackdropFilter: "blur(var(--p-glass1-blur, 22px))",
        boxShadow: `${shCard}, ${glassInset}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Разделитель строк внутри стеклянной карточки (макет: 1px rgba(23,18,67,.07)). */
export const ROW_DIVIDER = DIVIDER;
/** Разделитель колонок сводных полос (макет: 1px rgba(23,18,67,.08)) — тот же
 *  hairline, что и ROW_DIVIDER: разница в сотую альфы на глаз не читается, а
 *  отдельная пара переменных под неё темизацию только запутала бы. */
export const COL_DIVIDER = DIVIDER;

/* ─── пустое состояние ────────────────────────────────────────────────────── */

export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <GlassCard radius={20}>
      <p className="text-center" style={{ padding: 18, fontSize: 12, fontWeight: 700, color: ink2 }}>
        {children}
      </p>
    </GlassCard>
  );
}

/* ─── глифы (inline SVG, геометрия дословно из RN-экранов) ────────────────── */

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Цвет обводки задаётся CSS-свойством `stroke`, а не одноимённым атрибутом:
 *  сюда приходят токены-переменные (ink1 по умолчанию, status[*].text от
 *  вызывающих), а var() в презентационных атрибутах SVG браузеры не разрешают —
 *  глиф остался бы бесцветным в ОБЕИХ темах. Геометрия обводки (ширина,
 *  скругления) остаётся атрибутами, как в макете. */
function Stroke({
  size = 16,
  color = ink1,
  strokeWidth = 1.9,
  paths,
}: IconProps & { paths: string[] }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ stroke: color }}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const CAL_PATHS = [
  "M8 2v4",
  "M16 2v4",
  "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
  "M3 10h18",
];

export const IconCalendar = (p: IconProps) => <Stroke {...p} paths={CAL_PATHS} />;
export const IconCalendarCheck = (p: IconProps) => (
  <Stroke {...p} paths={[...CAL_PATHS, "m9.5 15 1.8 1.8 3.4-3.6"]} />
);
export const IconClock = (p: IconProps) => (
  <Stroke {...p} paths={["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"]} />
);
export const IconInfo = (p: IconProps) => (
  <Stroke {...p} paths={["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 16v-4", "M12 8h.01"]} />
);
export const IconFilter = (p: IconProps) => (
  <Stroke {...p} paths={["M3 6h18", "M7 12h10", "M10 18h4"]} />
);
export const IconChevronRight = (p: IconProps) => <Stroke {...p} paths={["m9 18 6-6-6-6"]} />;
export const IconChevronLeft = (p: IconProps) => <Stroke {...p} paths={["m15 18-6-6 6-6"]} />;
export const IconCheck = (p: IconProps) => <Stroke {...p} paths={["M20 6 9 17l-5-5"]} />;
export const IconCross = (p: IconProps) => <Stroke {...p} paths={["M18 6 6 18", "m6 6 12 12"]} />;
export const IconDoc = (p: IconProps) => (
  <Stroke {...p} paths={["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5"]} />
);
export const IconHourglass = (p: IconProps) => (
  <Stroke
    {...p}
    paths={[
      "M5 22h14",
      "M5 2h14",
      "M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22",
      "M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2",
    ]}
  />
);
export const IconChat = (p: IconProps) => <Stroke {...p} paths={["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"]} />;

/** Звезда рядом с оценкой (макет 1372, #F59E0B). */
export function IconStar({ size = 12, color = "#F59E0B" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: color }} aria-hidden className="shrink-0">
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
    </svg>
  );
}

/* ─── круглый бэйдж-иконка 24 (AttendanceScreen LastDayBadge) ─────────────── */

export function ToneBadge({ tone, kind }: { tone: StatusKey; kind: "check" | "x" | "doc" }) {
  const st = status[tone];
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: 24, height: 24, borderRadius: 12, background: `rgba(${st.rgb},0.15)` }}
    >
      {kind === "check" ? (
        <IconCheck size={12} color={st.text} strokeWidth={3} />
      ) : kind === "x" ? (
        <IconCross size={11} color={st.text} strokeWidth={2.8} />
      ) : (
        <IconDoc size={11} color={st.text} strokeWidth={2} />
      )}
    </span>
  );
}

/* ─── прогресс-полоса (ui/charts/ProgressBar) ─────────────────────────────── */

/** Незаполненный трек полосы/кольца прогресса. Своего токена у него нет —
 *  под него заведена пара --p-progress-track в parent-theme.css по правилу
 *  «база ink → белая, альфа сохраняется». */
const TRACK = "var(--p-progress-track, rgba(23,18,67,0.09))";

export function ProgressBar({
  pct,
  height = 5.5,
  fill,
}: {
  /** 0..100 */
  pct: number;
  height?: number;
  /** CSS-фон заливки; по умолчанию — accent-градиент. */
  fill?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span
      className="block w-full overflow-hidden"
      style={{ height, borderRadius: height, background: TRACK }}
    >
      <span
        className="block h-full"
        style={{ width: `${clamped}%`, borderRadius: height, background: fill ?? accentGrad }}
      />
    </span>
  );
}

/* ─── кольцо прогресса 42×42 (HomeworksScreen ProgressRing42) ─────────────── */

export function ProgressRing({ pct, family }: { pct: number; family: StatusKey }) {
  const st = status[family];
  const C = 100.53; // 2πr при r=16 — dasharray макета «100.5 100.5»
  const len = (Math.max(0, Math.min(100, pct)) / 100) * C;
  const track = pct === 0 && family === "red" ? `rgba(${st.rgb},0.2)` : TRACK;
  return (
    <svg width={42} height={42} viewBox="0 0 44 44" aria-hidden className="shrink-0">
      {/* stroke/fill — style-свойствами: в них попадают var()-токены (TRACK,
          status[*].text), а в презентационных атрибутах SVG var() не работает. */}
      <circle cx={22} cy={22} r={16} fill="none" style={{ stroke: track }} strokeWidth={4.5} />
      {pct > 0 && (
        <circle
          cx={22}
          cy={22}
          r={16}
          fill="none"
          stroke={`rgb(${st.rgb})`}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={`${len} ${C}`}
          transform="rotate(-90 22 22)"
        />
      )}
      <text
        x={22}
        y={26}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={800}
        style={{ fill: st.text }}
      >
        {`${pct}%`}
      </text>
    </svg>
  );
}

/** Круглый бэйдж 42 с иконкой/прочерком (HomeworksScreen HourglassBadge/DashBadge). */
export function RoundBadge42({ family, glyph }: { family: StatusKey; glyph: ReactNode }) {
  const st = status[family];
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        background: `rgba(${st.rgb},0.11)`,
        border: `1px solid rgba(${st.rgb},0.28)`,
        fontSize: 13,
        fontWeight: 800,
        color: st.text,
      }}
    >
      {glyph}
    </span>
  );
}

/* ─── акцентная CTA-карточка (AccentCard) ────────────────────────────────── */

export const ACCENT_INSET = "inset 0 1.5px 0 rgba(255,255,255,0.35)";

/** Caps-подпись внутри акцентной карточки (белая, 9.5/800). */
export function AccentCaps({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: 0.57,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </span>
  );
}

/** Caps-подпись внутри стеклянной карточки (ink3, 9/800). */
export function GlassCaps({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.54,
        textTransform: "uppercase",
        color: ink3,
      }}
    >
      {children}
    </span>
  );
}
