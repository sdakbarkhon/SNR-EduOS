"use client";

/**
 * П5 «Главная» (Dashboard) — ВЕБ-порт экрана родительского приложения.
 *
 * Источник 1:1 — apps/mobile-parent/src/screens/tabs/HomeScreen.tsx с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go), который
 * сам перенесён дословно из макета «SNR EduOS v2 Light.dc.html», строки 219–271:
 *   227      приветствие;
 *   228–241  ChildSwitcherCard large + MetricsSplitRow (5 колонок);
 *   242–245  AccentCard «Следующий урок»;
 *   246–249  ряд «К оплате / Питание»;
 *   250–254  AccentCard «EduOS Assistant» с 2 CTA;
 *   255–263  QuickActionsGrid 3×2;
 *   264      SectionHeader ленты;
 *   265–269  GlassCard с 3 ListRow «Сегодня»;
 *   + шторка выбора ребёнка (2632–2644).
 *
 * Данные — ТОЛЬКО через аксессоры ../v2/data (точная копия data-слоя мобилки):
 * getChildren, getDashboard, getParent, getSelectedChildContext. Числа и тексты
 * не пересчитываются и не выдумываются. Ветка isRealFlow мобилки (Supabase)
 * на вебе не переносится — БД к этому экрану не подключена.
 *
 * UI-компоненты мобилки (ChildSwitcherCard, MetricsSplitRow, AccentCard,
 * AccentInset, StatusChip, ListRow, SectionHeader, QuickActionTile/Grid,
 * Avatar, BottomSheetFrame, ChildPickerSheetContent) перенесены сюда локально
 * с их точными радиусами/паддингами/цветами; общее стекло и токены берутся из
 * ../v2/GlassCard и ../v2/tokens — вторых копий не заводим.
 *
 * Только светлая тема.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { GlassCard } from "../v2/GlassCard";
import { RootHeader } from "../v2/RootHeader";
import {
  accentGrad,
  chip,
  fontDisplay,
  glass1,
  glassBorder,
  glassInset,
  ink1,
  ink2,
  shColor,
  status,
  type StatusKey,
} from "../v2/tokens";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getDashboard,
  getParent,
  getSelectedChildContext,
  getUnreadNotificationsCount,
} from "../v2/data";

/* ─────────────────────────────────────────────────────────────────────────────
 * Локальные константы, которых нет в v2/tokens.ts: в мобилке это приватные
 * константы соответствующих ui-компонентов (значения светлой темы, дословно).
 * ────────────────────────────────────────────────────────────────────────── */

/** ListRow: разделитель border-top 1px (макет строка 267). */
const ROW_DIVIDER = "rgba(23,18,67,0.07)";
/** MetricsSplitRow: вертикальные разделители и верхний border-top. */
const METRIC_SEPARATOR = "rgba(23,18,67,0.08)";
/** MetricsSplitRow: caps-лейбл 8/800 (макет строки 230–239). */
const METRIC_LABEL = "rgba(26,19,74,0.5)";
/** SectionHeader: заголовок 10.5/800 (макет строка 2772). */
const SECTION_TITLE = "rgba(26,19,74,0.5)";
/** Хвостовой шеврон карточки ребёнка / строк списка. */
const CHEVRON = "rgba(26,19,74,0.4)";
/** AccentCard: внутренний блик inset 0 1.5 0 W35 (макет строка 242). */
const ACCENT_INSET_SHADOW = "inset 0 1.5px 0 rgba(255,255,255,0.35)";
/** AccentInset: стекло внутри непрозрачной градиентной карточки (строка 2741). */
const ACCENT_INSET_BG = "rgba(255,255,255,0.2)";
const ACCENT_INSET_BORDER = "rgba(255,255,255,0.35)";
/** Шторка (BottomSheetFrame, макет 4227–4228). */
const SHEET_OVERLAY = "rgba(23,18,67,0.35)";
const SHEET_BG = "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76))";
const SHEET_BORDER = "rgba(255,255,255,0.9)";
const SHEET_SHADOW = "0 -16px 50px rgba(64,54,150,0.3)";
const SHEET_GRIP = "rgba(23,18,67,0.2)";
/** ChildPickerSheetContent: фон невыбранной галочки (макет строка 4381). */
const CHECK_OFF_BG = "rgba(23,18,67,0.08)";
/** StatusChip variant="new" (макет строка 2715). */
const NEW_GRAD: readonly [string, string] = ["#8B5CF6", "#6366F1"];
const NEW_BORDER = "rgba(255,255,255,0.4)";
const NEW_SHADOW = "0 5px 12px rgba(124,58,237,0.35)";

/**
 * Тексты — ru, дословно из packages/core/src/i18n/ru.ts (parentApp.*), теми же
 * ключами, что зовёт RN-экран. Веб-порт делаем только для русского.
 */
const T = {
  class: "класс", // grades.class
  nextLesson: "Следующий урок", // home.nextLesson
  due: "К оплате", // status.due
  meals: "Питание", // svc.meals
  quickActions: "Быстрые действия", // home.quickActions
  todaySection: "Сегодня", // home.todaySection
  viewAll: "Смотреть все", // common.viewAll
  viewProgress: "Посмотреть прогресс", // home.viewProgress
  msgTeacher: "Написать учителю", // home.msgTeacher
  atSchoolSince: "В школе с", // home.atSchoolSince
  lessons: "Уроков", // home.lessons
  attended: "Посещено", // home.attended
  hw: "ДЗ", // home.hw
  wallet: "Кошелёк", // home.wallet
  sum: "сум", // pay.sum
  pay: "Оплатить", // home.pay
  hwShort: "Дом. задания", // home.hwShort
  services: "Все сервисы", // scr.services
  childProfile: "Профиль ребёнка", // scr.childProfile
  schedule: "Расписание", // scr.schedule
  chooseChild: "Выберите ребёнка", // auth.chooseChild
} as const;

/**
 * SVG-пути 24×24 — дословно из apps/mobile-parent/src/navigation/routes.ts
 * (ICONS, макет строки 3060–3080). Это НЕ иконочный шрифт: и мобилка, и макет
 * рисуют ровно эти пути, поэтому lucide-react здесь не подключаем — иначе
 * геометрия глифов разъедется с тем, что у заказчика в Expo Go.
 */
const ICONS = {
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  cal: [
    "M8 2v4",
    "M16 2v4",
    "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
    "M3 10h18",
  ],
  check: ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"],
  food: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
  spark: ["M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"],
  card: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
} as const;

/** CSS-градиент под углом макета (в RN тот же угол шёл через gradPoints()). */
const lg = (angle: number, from: string, to: string) => `linear-gradient(${angle}deg, ${from}, ${to})`;

/** numberOfLines={2} мобилки. */
const CLAMP_2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/**
 * formatMoney — дословно apps/mobile-parent/src/lib/format.ts: разряды по 3
 * цифры, разделитель — неразрывный пробел U+00A0 (макет: «185 000»).
 * Валюта не приклеивается (берётся из словаря на месте вызова).
 */
const NBSP = " ";
function formatMoney(value: number): string {
  const n = Math.round(Math.abs(value));
  const s = String(n);
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    groups.unshift(s.slice(Math.max(0, i - 3), i));
  }
  const joined = groups.join(NBSP);
  return value < 0 ? `-${joined}` : joined;
}

/* ─── Атомы (перенос ui-компонентов мобилки) ──────────────────────────────── */

/** Иконка-глиф из inline SVG-paths, белым, stroke 1.9 (WhiteGlyph мобилки). */
function WhiteGlyph({ paths, size = 17 }: { paths: readonly string[]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function ChevronRight({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path d="m9 18 6-6-6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Галочка 12px stroke 3 белым (шторка выбора ребёнка, макет строка 4381). */
function CheckGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path d="M20 6 9 17l-5-5" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Avatar — инициалы на градиенте 135° + кольца (av(), макет строка 3832):
 * box-shadow 0 0 0 2px #fff + 0 0 0 4.5px ring. В вебе это ИСХОДНАЯ форма
 * макета (в RN кольца пришлось рисовать вложенными View).
 */
function Avatar({
  initials,
  gradient,
  ringColor,
  size,
}: {
  initials: string;
  gradient: readonly [string, string];
  ringColor?: string;
  size: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.3),
        fontWeight: 800,
        background: lg(135, gradient[0], gradient[1]),
        boxShadow: ringColor ? `0 0 0 2px #FFFFFF, 0 0 0 4.5px ${ringColor}` : "0 0 0 2px #FFFFFF",
      }}
    >
      {initials}
    </span>
  );
}

/**
 * AccentCard — непрозрачная акцентная градиентная карточка (макет §s4,
 * строки 2729–2741): градиент 135°, цветная тень в тоне градиента (shColor)
 * + верхний блик inset 0 1.5 0 W35.
 */
function AccentCard({
  gradient,
  angle = 135,
  shadowRgb,
  radius: r = 18,
  pressable = false,
  className = "",
  style,
  contentStyle,
  children,
}: {
  gradient: readonly [string, string];
  angle?: number;
  shadowRgb?: string;
  radius?: number;
  pressable?: boolean;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  children?: ReactNode;
}) {
  const surface: CSSProperties = {
    borderRadius: r,
    overflow: "hidden",
    background: lg(angle, gradient[0], gradient[1]),
    boxShadow: shadowRgb ? `${shColor(shadowRgb)}, ${ACCENT_INSET_SHADOW}` : ACCENT_INSET_SHADOW,
    ...style,
  };
  const inner = <div style={contentStyle}>{children}</div>;

  if (pressable) {
    return (
      <button type="button" className={`block w-full text-left ${className}`} style={surface}>
        {inner}
      </button>
    );
  }
  return (
    <div className={className} style={surface}>
      {inner}
    </div>
  );
}

/** StatusChip (макет §s3, строки 2702–2721): r999, 5×10, текст 10.5/800. */
function StatusChip({ label, family = "gray" }: { label: string; family?: StatusKey }) {
  const st = status[family];
  const c = chip(st.rgb);
  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{
        gap: 5,
        padding: "5px 10px",
        borderRadius: 999,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
        fontSize: 10.5,
        fontWeight: 800,
        color: st.text,
      }}
    >
      {label}
    </span>
  );
}

/** StatusChip variant='new' — единственный заливной чип (макет строка 2715). */
function NewChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center text-white"
      style={{
        gap: 5,
        padding: "5px 10px",
        borderRadius: 999,
        background: lg(135, NEW_GRAD[0], NEW_GRAD[1]),
        border: `1px solid ${NEW_BORDER}`,
        boxShadow: NEW_SHADOW,
        fontSize: 10.5,
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

/** SectionHeader (макет строка 2772): caps 10.5/800 + правая ссылка 11.5/800. */
function SectionHeader({ title, linkLabel }: { title: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.84, // .08em при 10.5px
          textTransform: "uppercase",
          color: SECTION_TITLE,
        }}
      >
        {title}
      </span>
      {linkLabel ? (
        <button type="button" style={{ fontSize: 11.5, fontWeight: 800, color: status.violet.text }}>
          {linkLabel}
        </button>
      ) : null}
    </div>
  );
}

/** ListRow (макет §s7 строка 2771 + строки 266–268): padding 10 0, gap 11. */
function ListRow({
  left,
  title,
  subtitle,
  right,
  divider = false,
}: {
  left: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  divider?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center text-left"
      style={{
        gap: 11,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: divider ? `1px solid ${ROW_DIVIDER}` : undefined,
      }}
    >
      {left}
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate" style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {right}
    </button>
  );
}

interface MetricCell {
  label: string;
  value: string;
  valueColor?: string;
  flex?: number;
}

/** MetricsSplitRow (макет строки 230–239): ряд gap 6, caps 8/800, значение 12/800. */
function MetricsSplitRow({ cells, topDivider = false }: { cells: MetricCell[]; topDivider?: boolean }) {
  return (
    <div
      className="flex"
      style={{
        gap: 6,
        paddingTop: topDivider ? 10 : undefined,
        borderTop: topDivider ? `1px solid ${METRIC_SEPARATOR}` : undefined,
      }}
    >
      {cells.map((cell, i) => (
        <div key={cell.label} className="flex min-w-0" style={{ gap: 6, flex: `${cell.flex ?? 1} 1 0%` }}>
          {i > 0 ? <div style={{ width: 1, background: METRIC_SEPARATOR }} /> : null}
          <div className="flex min-w-0 flex-1 flex-col items-center" style={{ gap: 1 }}>
            <span
              className="w-full truncate text-center"
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: 0.4, // .05em при 8px
                textTransform: "uppercase",
                color: METRIC_LABEL,
              }}
            >
              {cell.label}
            </span>
            <span
              className="w-full truncate text-center"
              style={{ fontSize: 12, fontWeight: 800, color: cell.valueColor ?? ink1 }}
            >
              {cell.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * QuickActionTile (макет строки 249–253): тайл r18, паддинг 11×4, gap 6,
 * стекло glass-1 с blur(20) + тень 0 10 24 rgba(99,86,214,.13) + inset-блик;
 * плитка-иконка 38 r13 с градиентом 135° и тенью 0 7 16 rgba(цвет,.3).
 */
function QuickActionTile({
  label,
  gradient,
  shadowRgb,
  iconPaths,
}: {
  label: string;
  gradient: readonly [string, string];
  shadowRgb: string;
  iconPaths: readonly string[];
}) {
  return (
    <button
      type="button"
      className="flex h-full w-full flex-col items-center justify-center"
      style={{
        borderRadius: 18,
        border: `1px solid ${glassBorder}`,
        background: glass1.background,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: `0 10px 24px rgba(99,86,214,0.13), ${glassInset}`,
        gap: 6,
        padding: "11px 4px",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          background: lg(135, gradient[0], gradient[1]),
          boxShadow: `0 7px 16px rgba(${shadowRgb},0.3)`,
        }}
      >
        <WhiteGlyph paths={iconPaths} size={17} />
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: ink1, textAlign: "center", ...CLAMP_2 }}>{label}</span>
    </button>
  );
}

/** Плитка 46×46 grad-glass с глифом-строкой («√x») — макет строка 244. */
function AccentGlyphTile({ gradient, glyph, size = 46 }: { gradient: readonly [string, string]; glyph: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        border: `1px solid ${ACCENT_INSET_BORDER}`,
        background: lg(135, gradient[0], gradient[1]),
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      {glyph}
    </span>
  );
}

/** Chip-«5» 30×30 rounded-10 зелёный — макет строка 267 (feed #1, оценка). */
function GradeBadge({ value }: { value: number }) {
  const st = status.green;
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        background: `rgba(${st.rgb},0.14)`,
        border: `1px solid rgba(${st.rgb},0.35)`,
        fontSize: 13,
        fontWeight: 800,
        color: st.text,
      }}
    >
      {value}
    </span>
  );
}

/** Иконка feed-ряда 36×36 rounded-12 с градиентом и текстовым/SVG-глифом. */
function FeedIconTile({
  gradient,
  glyph,
  svgPaths,
}: {
  gradient: readonly [string, string];
  glyph?: string;
  svgPaths?: readonly string[];
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        background: lg(135, gradient[0], gradient[1]),
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {svgPaths ? <WhiteGlyph paths={svgPaths} size={17} /> : glyph}
    </span>
  );
}

/** CTA-glass кнопка акцентной карточки ассистента: 50/50, minHeight 36. */
function AssistantCta({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex flex-1 items-center justify-center text-center text-white"
      style={{
        minHeight: 36,
        borderRadius: 12,
        border: `1px solid ${ACCENT_INSET_BORDER}`,
        background: ACCENT_INSET_BG,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "8px 10px",
        fontSize: 11.5,
        fontWeight: 800,
      }}
    >
      <span style={CLAMP_2}>{label}</span>
    </button>
  );
}

/* ─── Шторка выбора ребёнка ───────────────────────────────────────────────── */

interface ChildPickerItem {
  id: string;
  initials: string;
  gradient: readonly [string, string];
  ringColor?: string;
  name: string;
  classLabel: string;
  statusLabel: string;
  statusTone: StatusKey;
}

/**
 * BottomSheetFrame + ChildPickerSheetContent (макет 2462–2645 / 2632–2644):
 * оверлей rgba(23,18,67,.35)+blur(4) с opacity .28s; панель left/right/bottom 8,
 * r30, 160° W92→W76, blur(26), border W90, тень 0 -16 50 + inset-блик,
 * translateY(115%) → 0 за .32s cubic-bezier(.2,.7,.3,1); грип 44×5 r3.
 */
function ChildPickerSheet({
  open,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: ChildPickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }}>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 block h-full w-full"
        style={{
          background: SHEET_OVERLAY,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: shown ? 1 : 0,
          transition: "opacity .28s cubic-bezier(.2,.7,.3,1)",
        }}
      />
      <div
        className="absolute mx-auto"
        style={{
          left: 8,
          right: 8,
          bottom: 8,
          maxWidth: 414,
          borderRadius: 30,
          border: `1px solid ${SHEET_BORDER}`,
          background: SHEET_BG,
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          boxShadow: `${SHEET_SHADOW}, ${glassInset}`,
          paddingBottom: 12,
          transform: shown ? "translateY(0)" : "translateY(115%)",
          transition: "transform .32s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        {/* Полоска-грип 44×5 (макет строка 2464). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex w-full justify-center"
          style={{ paddingTop: 10, paddingBottom: 4 }}
        >
          <span style={{ width: 44, height: 5, borderRadius: 3, background: SHEET_GRIP }} />
        </button>

        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: ink1,
            paddingTop: 2,
            paddingLeft: 20,
            paddingRight: 20,
            paddingBottom: 10,
          }}
        >
          {title}
        </p>

        {items.map((item) => {
          const selected = item.id === selectedId;
          const st = status[item.statusTone];
          const c = chip(st.rgb);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="flex w-full items-center text-left"
              style={{ gap: 12, padding: "11px 20px" }}
            >
              {/* Кольца аватара выступают наружу — компенсируем зазором, как в мобилке. */}
              <span className="block shrink-0" style={{ margin: item.ringColor ? 4.5 : 2 }}>
                <Avatar initials={item.initials} gradient={item.gradient} ringColor={item.ringColor} size={44} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 800, color: ink1 }}>
                  {item.name}
                </span>
                <span className="block truncate" style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>
                  {item.classLabel}
                </span>
              </span>
              <span
                className="shrink-0"
                style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  background: c.background,
                  border: `1px solid ${c.borderColor}`,
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: st.text,
                }}
              >
                {item.statusLabel}
              </span>
              {/* Галочка: выбран — accent-градиент с тенью, иначе плоский фон
                  (в макете белая галочка рендерится и у невыбранных). */}
              <span
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: selected ? accentGrad : CHECK_OFF_BG,
                  boxShadow: selected ? "0 4px 10px rgba(124,58,237,0.4)" : undefined,
                }}
              >
                <CheckGlyph />
              </span>
            </button>
          );
        })}
        <div style={{ height: 18 }} />
      </div>
    </div>
  );
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export function HomeView() {
  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX]?.id ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  const parent = getParent();
  const dashboard = getDashboard(childId);
  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  // В мобилке идентичность карточки берётся из реального Supabase-ребёнка для
  // phone-flow; на вебе БД к экрану не подключена — работает демо-ветка.
  const identityChild = child;
  const bellCount = getUnreadNotificationsCount();

  // Приветствие (макет строка 227): «Доброе утро, Дилноза!» + «Вот что
  // происходит у Малики сегодня».
  const greetingTitle = `${dashboard.greeting.title_prefix}${parent.first_name}!`;
  const greetingSub = dashboard.greeting.subtitle_template.replace("{gen}", child.first_name_gen);

  // 5 колонок метрики-сплит (макет 230–240). Валюта коротким — «185 000 сум».
  const metricCells: MetricCell[] = [
    { label: T.atSchoolSince, value: dashboard.child_status.at_school_since_label },
    { label: T.lessons, value: String(dashboard.child_status.lessons_total) },
    {
      label: T.attended,
      value: `${dashboard.child_status.lessons_attended}/${dashboard.child_status.lessons_total}`,
      valueColor: status.green.text,
    },
    {
      label: T.hw,
      value: String(dashboard.child_status.homework_count),
      valueColor: status.orange.text,
    },
    {
      label: T.wallet,
      value: `${formatMoney(dashboard.wallet_balance)} ${T.sum}`,
      flex: 1.4,
    },
  ];

  const nextLessonView = {
    subjectName: dashboard.next_lesson.subject_name,
    timeRoomTeacherLabel: dashboard.next_lesson.time_room_teacher_label,
    tileLabel: dashboard.next_lesson.tile_label,
  };

  const dueSum = `${formatMoney(dashboard.due_card.amount)} ${T.sum}`;
  const dueSubtitle = `${dashboard.due_card.bills_count} счёта · ${dashboard.due_card.until_label}`;

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${T.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  // Быстрые действия (макет 256–263). Иконки из ICONS + inline paths.
  const QUICKS: { label: string; gradient: readonly [string, string]; iconPaths: readonly string[]; shadowRgb: string }[] = [
    { label: T.pay, gradient: ["#fb923c", "#ef4444"], iconPaths: ICONS.card, shadowRgb: "251,146,60" },
    { label: T.hwShort, gradient: ["#60a5fa", "#2563eb"], iconPaths: ICONS.check, shadowRgb: "96,165,250" },
    { label: T.services, gradient: ["#a78bfa", "#7c3aed"], iconPaths: ICONS.grid, shadowRgb: "167,139,250" },
    { label: T.meals, gradient: ["#f472b6", "#db2777"], iconPaths: ICONS.food, shadowRgb: "244,114,182" },
    { label: T.childProfile, gradient: ["#34d399", "#059669"], iconPaths: ICONS.user, shadowRgb: "52,211,153" },
    { label: T.schedule, gradient: ["#22d3ee", "#0891b2"], iconPaths: ICONS.cal, shadowRgb: "34,211,238" },
  ];

  return (
    <>
      {/* Шапка (220–225): лого + «SNR EduOS» 14/600, колокольчик с бейджем,
          аватар родителя. Общий компонент каркаса v2 — своей копии не заводим. */}
      <RootHeader title="SNR EduOS" titleSize={14} showLogo bellBadge={bellCount} initials={parent.initials} />

      <div
        className="mx-auto flex w-full max-w-[430px] flex-col"
        style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8, gap: 12 }}
      >
        {/* Приветствие (227). */}
        <div className="flex flex-col" style={{ gap: 4 }}>
          <h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 20, color: ink1 }}>{greetingTitle}</h1>
          <p style={{ fontSize: 12, fontWeight: 600, color: ink2 }}>{greetingSub}</p>
        </div>

        {/* ChildSwitcherCard large + MetricsSplitRow (228–241). */}
        <GlassCard radius={22} onClick={() => setSheetOpen(true)}>
          <div className="flex flex-col" style={{ padding: "12px 14px", gap: 10 }}>
            <div className="flex items-center" style={{ gap: 11 }}>
              {/* Кольца аватара выступают наружу — компенсируем зазором. */}
              <span className="block shrink-0" style={{ margin: identityChild.avatar_ring ? 4.5 : 2 }}>
                <Avatar
                  initials={identityChild.first_name.slice(0, 1)}
                  gradient={identityChild.avatar_gradient}
                  ringColor={identityChild.avatar_ring}
                  size={50}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 800, color: ink1 }}>
                  {identityChild.full_name}
                </span>
                <span className="flex items-center" style={{ gap: 4 }}>
                  <span className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink2 }}>
                    {`${identityChild.class_name} ${T.class}`}
                  </span>
                  <ChevronDown size={11} color={ink2} strokeWidth={2.4} />
                </span>
              </span>
              {/* Статус-чип «В школе»: дот 6, шеврон 10, тень 0 4 10 rgba(16,185,129,.18). */}
              <span
                className="inline-flex shrink-0 items-center"
                style={{
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: chip(status.green.rgb).background,
                  border: `1px solid ${chip(status.green.rgb).borderColor}`,
                  boxShadow: `0 4px 10px rgba(${status.green.rgb},0.18)`,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: 3, background: `rgb(${status.green.rgb})` }}
                />
                <span style={{ fontSize: 10, fontWeight: 800, color: status.green.text }}>{child.status_chip}</span>
                <ChevronRight size={10} color={status.green.text} strokeWidth={2.6} />
              </span>
              <ChevronRight size={15} color={CHEVRON} strokeWidth={2.2} />
            </div>
            <MetricsSplitRow cells={metricCells} topDivider />
          </div>
        </GlassCard>

        {/* AccentCard «Следующий урок» (242–245). */}
        <AccentCard
          gradient={dashboard.next_lesson.gradient}
          angle={135}
          shadowRgb="99,102,241"
          radius={20}
          pressable
          contentStyle={{ padding: 14, display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.72, // .08em при 9px
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {T.nextLesson}
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: "#FFFFFF" }}>{nextLessonView.subjectName}</span>
            {nextLessonView.timeRoomTeacherLabel ? (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                {nextLessonView.timeRoomTeacherLabel}
              </span>
            ) : null}
          </span>
          <AccentGlyphTile gradient={dashboard.next_lesson.gradient} glyph={nextLessonView.tileLabel} />
        </AccentCard>

        {/* Ряд «К оплате / Питание» (246–249). */}
        <div className="flex" style={{ gap: 10 }}>
          <AccentCard
            gradient={dashboard.due_card.gradient}
            shadowRgb="244,63,94"
            radius={18}
            pressable
            className="flex-1"
            contentStyle={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {T.due}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>{dueSum}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{dueSubtitle}</span>
          </AccentCard>
          <AccentCard
            gradient={dashboard.meals_card.gradient}
            shadowRgb="52,211,153"
            radius={18}
            pressable
            className="flex-1"
            contentStyle={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {T.meals}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>{dashboard.meals_card.status_label}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
              {dashboard.meals_card.until_label}
            </span>
          </AccentCard>
        </div>

        {/* AccentCard «EduOS Assistant» + 2 CTA (250–254). */}
        <AccentCard
          gradient={["#8b5cf6", "#6366f1"]}
          shadowRgb="139,92,246"
          radius={20}
          contentStyle={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div className="flex items-center" style={{ gap: 10 }}>
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                border: `1px solid ${ACCENT_INSET_BORDER}`,
                background: ACCENT_INSET_BG,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <WhiteGlyph paths={ICONS.spark} size={18} />
            </span>
            <span className="min-w-0 flex-1" style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>
              EduOS Assistant
            </span>
            <NewChip label="NEW" />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, lineHeight: "18.6px", color: "rgba(255,255,255,0.95)" }}>
            {dashboard.assistant_text}
          </p>
          <div className="flex items-stretch" style={{ gap: 8 }}>
            <AssistantCta label={T.viewProgress} />
            <AssistantCta label={T.msgTeacher} />
          </div>
        </AccentCard>

        {/* Быстрые действия (255–263). */}
        <SectionHeader title={T.quickActions} />
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
          {QUICKS.map((q) => (
            <QuickActionTile
              key={q.label}
              label={q.label}
              gradient={q.gradient}
              shadowRgb={q.shadowRgb}
              iconPaths={q.iconPaths}
            />
          ))}
        </div>

        {/* Лента «Сегодня» (264–269). */}
        <SectionHeader title={T.todaySection} linkLabel={`${T.viewAll} ›`} />
        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {dashboard.feed.map((row, idx) => {
            // Иконка ряда — по маршруту go: d11 → math √x, d12 → eng Aa, dmeals → food.
            const icon =
              row.go === "d11" ? (
                <FeedIconTile gradient={["#facc15", "#ca8a04"]} glyph="√x" />
              ) : row.go === "d12" ? (
                <FeedIconTile gradient={["#f472b6", "#db2777"]} glyph="Aa" />
              ) : (
                <FeedIconTile gradient={["#34d399", "#0ea5e9"]} svgPaths={ICONS.food} />
              );
            const right =
              row.badge.kind === "grade" ? (
                <GradeBadge value={row.badge.value} />
              ) : (
                <StatusChip
                  label={row.badge.label}
                  family={
                    row.badge.label === "Успешно" ? "green" : row.badge.label.indexOf("Срок") === 0 ? "orange" : "gray"
                  }
                />
              );
            return (
              <ListRow
                key={row.title}
                left={icon}
                title={row.title}
                subtitle={row.subtitle}
                right={right}
                divider={idx > 0}
              />
            );
          })}
        </GlassCard>

        {/* Шторка выбора ребёнка. */}
        <ChildPickerSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={T.chooseChild}
          items={pickerItems}
          selectedId={childId}
          onSelect={(id) => {
            setChildId(id);
            setSheetOpen(false);
          }}
        />
      </div>
    </>
  );
}
