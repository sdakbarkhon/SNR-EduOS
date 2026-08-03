"use client";

/**
 * П10 «Успехи» — ВЕБ-порт экрана родительского приложения.
 *
 * Вёрстка 1:1 — apps/mobile-parent/src/screens/tabs/ProgressScreen.tsx с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go), который
 * сам перенесён дословно из макета «SNR EduOS v2 Light.dc.html», строки 273–374:
 *   274–279  шапка RootHeader (заголовок 17/600, лого, колокольчик, аватар);
 *   281      ChildSwitcherCard compact;
 *   282–289  AccentCard «Средний балл» + 2 AccentInset («Прогресс за неделю»
 *            со Sparkline 56×20 и «Посещаемость» с полосой 4px);
 *   290      SegmentPills («Оценки / Динамика» — см. ниже про «Навыки»);
 *   294–304  период-popover (170px) + дельта «Выше на 0.2, чем в июне ↗»;
 *   305–312  grid плиток предметов 3×2 (SubjectTile 34 r11 + оценка + звезда);
 *   313–319  GlassCard со строками ProgressBar по предметам;
 *   320–325  «Сильные стороны / Зоны роста» с chip-ами;
 *   326–331  SectionHeader «Последние отзывы» + карточка отзыва учителя;
 *   332–336  AccentCard EduOS Assistant;
 *   360–370  вкладка «Динамика»: Sparkline + помесячные строки + заметка.
 *
 * ДАННЫЕ: экран больше НЕ читает фикстуры ../v2/data (там был чужой ребёнок и
 * выдуманные числа). Он чистая презентация — весь view-model собирает
 * серверный page.tsx из lib/parent-queries (Supabase, всегда со studentId
 * выбранного ребёнка). Фильтр по периоду и производные средние считаются здесь
 * из переданного списка реальных оценок, чтобы переключение периода не гоняло
 * сервер.
 *
 * ВКЛАДКА «НАВЫКИ» УДАЛЕНА: под неё нет ни таблицы, ни core-запроса (см.
 * комментарий в packages/core/src/queries/index.ts — «Навыки (#16) — целиком
 * mock в самом экране»), а радар из фикстуры — ровно то, что просили убрать.
 * Вернуть вкладку = сначала завести схему оценки навыков.
 *
 * НАВИГАЦИЯ: плитки/строки предметов, «Все предметы», «Отзывы», посещаемость
 * и профиль ребёнка — кликабельные (next/link, prefetch по умолчанию).
 *
 * Только светлая тема.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "../v2/GlassCard";
import { RootHeader } from "../v2/RootHeader";
import {
  DIVIDER,
  ONLINE_GREEN,
  PILL_ACTIVE_SHADOW,
  PILL_INACTIVE_BG,
  PILL_INACTIVE_TEXT,
  SECTION_CAP,
} from "../_ui/screen-tokens";
import {
  accent,
  accentGrad,
  chip,
  fontDisplay,
  glassBorder,
  ink1,
  ink2,
  ink3,
  shColor,
  status,
  subjectGrad,
  subjects,
  type StatusKey,
  type SubjectKey,
} from "../v2/tokens";

/* ─── Контракт данных (заполняется серверным page.tsx) ────────────────────── */

export type Gradient = [string, string];

export interface ProgressSubject {
  /** UUID предмета для /parent/subject/[id]; null — предмет не нашёлся в справочнике. */
  id: string | null;
  name: string;
  key: SubjectKey;
  glyph: string;
}

export interface ProgressGrade {
  /** Название предмета — связь с ProgressSubject.name. */
  subject: string;
  /** Оценка, нормированная к пятибалльной (StudentGradeItem.grade5). */
  grade5: number;
  /** Месяц выставления, YYYY-MM по Ташкенту. */
  month: string;
}

export interface ProgressPeriod {
  /** "all" либо YYYY-MM. */
  id: string;
  /** Именительный падеж для кнопки/попапа: «Июль 2026». */
  label: string;
  /** Предложный падеж для фразы «…чем в июне»: «июне». */
  prepLabel: string;
}

export interface ProgressReview {
  id: string;
  teacherName: string;
  teacherInitials: string;
  teacherGradient: Gradient;
  subjectName: string;
  subjectId: string | null;
  timeLabel: string;
  comment: string;
}

export interface ProgressMonthPoint {
  monthKey: string;
  label: string;
  avg: number;
}

export interface ProgressViewData {
  parent: { initials: string };
  bellCount: number;
  /** null — у родителя нет привязанного ребёнка (пустое состояние). */
  child: {
    fullName: string;
    initial: string;
    className: string;
    gradient: Gradient;
    statusLabel: string | null;
  } | null;
  /** true — child===null потому что запрос к БД реально упал (см.
   *  lib/parent-context.ts hadError), а не потому что ребёнок правда не
   *  привязан. Тот же приём, что в home/HomeView.tsx. */
  childLoadError?: boolean;
  subjects: ProgressSubject[];
  grades: ProgressGrade[];
  periods: ProgressPeriod[];
  defaultPeriod: string;
  attendance: { pct: number; present: number; total: number };
  weekActivity: { thisWeek: number; lastWeek: number; deltaPct: number | null };
  reviews: ProgressReview[];
  dynamics: ProgressMonthPoint[];
}

/* ─── Маршруты ────────────────────────────────────────────────────────────── */

const R = {
  notifications: "/parent/notifications",
  profile: "/parent/profile",
  child: "/parent/child",
  day: "/parent/day",
  attendance: "/parent/attendance",
  subjects: "/parent/subjects",
  reviews: "/parent/reviews",
} as const;

const subjectHref = (id: string | null) => (id ? `/parent/subject/${id}` : R.subjects);

/* ─────────────────────────────────────────────────────────────────────────────
 * Локальные константы, которых нет в v2/tokens.ts: в мобилке это приватные
 * константы соответствующих ui-компонентов (значения светлой темы, дословно).
 *
 * ТЁМНАЯ ТЕМА. Здесь лежала СВОЯ палитра из тринадцати литералов, и половина
 * экрана в тёмной теме оставалась светлой (плитки предметов, кнопка периода,
 * поповер, неактивные пилюли), а вторая половина — тёмной на тёмном
 * (разделители, caps-заголовок, текст пилюли, трек полосы). Теперь:
 *   * разделители / заголовок секции / неактивные пилюли / тень активной /
 *     онлайн-точка берутся из общих производных `_ui/screen-tokens.ts`
 *     (DIVIDER, SECTION_CAP, PILL_*, ONLINE_GREEN) — вторых копий не держим;
 *   * ссылка «Профиль ребёнка ›» — status.violet.text: в светлой это тот же
 *     #6D28D9, что был литералом, в тёмной — светло-сиреневый;
 *   * трём поверхностям, для которых токена нет вовсе (заливка плитки
 *     предмета, кнопка периода, поповер периода), заведены свои пары --p-* в
 *     apps/web/app/parent/parent-theme.css; трек полосы взят из готовой
 *     --p-progress-track.
 *
 * Оставшиеся ниже белые ACCENT_INSET_* лежат ПОВЕРХ непрозрачной цветной
 * карточки, а янтарная звезда — сигнальная заливка: и то, и другое одинаково
 * в обеих темах и не темизируется.
 * ────────────────────────────────────────────────────────────────────────── */

/** AccentCard: внутренний блик inset 0 1.5 0 W35 (макет строка 242). */
const ACCENT_INSET_SHADOW = "inset 0 1.5px 0 rgba(255,255,255,0.35)";
/** AccentInset: стекло внутри непрозрачной градиентной карточки (строка 2741). */
const ACCENT_INSET_BG = "rgba(255,255,255,0.2)";
const ACCENT_INSET_BORDER = "rgba(255,255,255,0.35)";
/** ProgressBar: трек полосы. Своей переменной не заводим — в parent-theme.css
 *  уже есть --p-progress-track ровно с этим светлым значением (общий трек
 *  полос/колец учебных экранов). */
const TRACK = "var(--p-progress-track, rgba(23,18,67,0.09))";
/** Плитки предметов: полупрозрачная заливка (макет строка 306). */
const TILE_BG = "var(--p-tile-bg, rgba(255,255,255,0.4))";
/** Кнопка периода (макет строка 294). */
const PERIOD_BG = "var(--p-period-bg, rgba(255,255,255,0.6))";
/** Popover периода (макет строка 298): 160° W94→W82, blur 24, border W90. */
const POPOVER_BG =
  "var(--p-popover-bg, linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.82)))";
const POPOVER_BORDER = "var(--p-popover-border, rgba(255,255,255,0.9))";
const POPOVER_SHADOW = "var(--p-popover-shadow, 0 18px 40px rgba(64,54,150,0.28))";
/** Звезда рядом с оценкой предмета (макет строка 306). */
const STAR_AMBER = "#F59E0B";

/**
 * Тексты — ru, дословно из packages/core/src/i18n/ru.ts (parentApp.*), теми же
 * ключами, что зовёт RN-экран. Веб-порт делаем только для русского.
 */
const T = {
  navGrades: "Успехи", // nav.grades
  class: "класс", // grades.class
  average: "Средний балл", // grades.average
  attendance: "Посещаемость", // scr.attendance
  tabGrades: "Оценки", // grades.tabGrades
  tabDyn: "Динамика", // grades.tabDyn
  subjectsSection: "Предметы", // grades.subjects
  allSubjects: "Все предметы", // scr.allSubjects
  lastReviews: "Последние отзывы", // grades.lastReviews
  viewAll: "Смотреть все", // common.viewAll
  dynAvg: "Динамика среднего балла", // grades.dynAvg
  childProfile: "Профиль ребёнка", // scr.childProfile
  /** Не из словаря: в RN-экране эти строки — литералы (строки 610, 650, 876, 894). */
  weekProgress: "Прогресс за неделю",
  attendanceRatioPrefix: "присутствий",
  strengths: "Сильные стороны",
  growthAreas: "Зоны роста",
  periodAll: "Всё время",
  /** Пустые состояния. */
  noChild: "К аккаунту не привязан ни один ребёнок",
  noChildHint: "Обратитесь в администрацию школы — она свяжет профиль ученика с вашим аккаунтом.",
  /** Отличается от noChild тем же способом, что в home/HomeView.tsx —
   *  см. комментарий там. */
  loadError: "Не удалось загрузить данные",
  loadErrorHint: "Проверьте соединение и обновите страницу. Если это повторится — напишите в поддержку школы.",
  noGrades: "Оценок пока нет",
  noGradesHint: "Как только учитель выставит первую оценку, она появится здесь",
  noGradesPeriod: "За выбранный период оценок нет",
  noReviews: "Отзывов учителей пока нет",
  noReviewsHint: "Здесь появятся комментарии, которые учителя оставляют к оценкам",
  noDynamics: "Для графика нужно минимум два месяца с оценками",
} as const;

/** Глиф предмета — дословно SUBJECT_GLYPH из ProgressScreen.tsx. */
const SUBJECT_GLYPH: Record<SubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** CSS-градиент под углом макета (в RN тот же угол шёл через gradPoints()). */
const lg = (angle: number, from: string, to: string) => `linear-gradient(${angle}deg, ${from}, ${to})`;

/** numberOfLines={3} мобилки (текст отзыва учителя). */
const CLAMP_3: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** «4.9» — как в макете (точка, один знак). */
const gradeLabel = (v: number) => v.toFixed(1);

/* ─── Иконки: inline-пути 24×24, дословно из RN (НЕ lucide) ──────────────── */

/** Путь звезды из макета (строки 284, 306) — StarRating / StarGlyph. */
const STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z";
/** «Искра» EduOS Assistant (макет строка 332). */
const SPARK_PATH = "M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z";
/** Иконка «лайк» в карточке отзыва (макет строка 330). */
const THUMB_PATH = "M7 22V11m0 0h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-3l1 4a2 2 0 1 1-4 0v-1H7Z";

/* Во всех глифах ниже цвет идёт через `style`, а не presentation-атрибутом
   fill=/stroke=: любой из них может получить токен (var(--p-*)), а var() в
   SVG-атрибутах браузер не разрешает — глиф стал бы бесцветным в обеих темах.
   Геометрия (strokeWidth, linecap) остаётся атрибутами. */

function StarGlyph({ size = 12, color = STAR_AMBER }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: color }} className="shrink-0" aria-hidden>
      <path d={STAR_PATH} />
    </svg>
  );
}

function ChevronRight({
  size = 9,
  color = "#FFFFFF",
  strokeWidth = 2.6,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path
        d="m9 18 6-6-6-6"
        style={{ stroke: color }}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Цвет — через `style`, а не presentation-атрибутом `stroke=`: сюда приходят
 * токены (ink1/ink2), то есть var(--p-*), а var() в SVG-атрибутах браузер не
 * разрешает — шеврон стал бы бесцветным в обеих темах. Геометрия остаётся
 * атрибутами.
 */
function ChevronDown({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        style={{ stroke: color }}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** «Искра» 18px белым stroke 1.9 (иконка EduOS Assistant). */
function SparkGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1.9}
      className="shrink-0"
      aria-hidden
    >
      <path d={SPARK_PATH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Атомы (перенос ui-компонентов мобилки) ──────────────────────────────── */

/**
 * Avatar — инициалы на градиенте 135° + кольца (av(), макет строка 3832):
 * box-shadow 0 0 0 2px #fff.
 */
function Avatar({ initials, gradient, size }: { initials: string; gradient: Gradient; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.3),
        fontWeight: 800,
        background: lg(135, gradient[0], gradient[1]),
        boxShadow: "0 0 0 2px #FFFFFF",
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
  className = "",
  style,
  contentStyle,
  children,
}: {
  gradient: Gradient;
  angle?: number;
  shadowRgb?: string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: r,
        overflow: "hidden",
        background: lg(angle, gradient[0], gradient[1]),
        boxShadow: shadowRgb ? `${shColor(shadowRgb)}, ${ACCENT_INSET_SHADOW}` : ACCENT_INSET_SHADOW,
        ...style,
      }}
    >
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

/**
 * AccentInset — «стеклянная вставка» внутри градиентной карточки (макет
 * строка 2741): rgba(255,255,255,.2) + blur(8) + border W35. `href`
 * превращает её в next/link (в мобилке это был Pressable).
 */
function AccentInset({
  radius: r = 12,
  href,
  className = "",
  style,
  children,
}: {
  radius?: number;
  href?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const surface: CSSProperties = {
    borderRadius: r,
    border: `1px solid ${ACCENT_INSET_BORDER}`,
    background: ACCENT_INSET_BG,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    ...style,
  };
  if (href) {
    return (
      <Link href={href} className={`text-left ${className}`} style={surface}>
        {children}
      </Link>
    );
  }
  return (
    <div className={className} style={surface}>
      {children}
    </div>
  );
}

/** Uppercase caps-лейбл 9/800, letter-spacing .08em, полупрозрачно-белый. */
function AccentCapsLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.72, // .08em при 9px
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {children}
    </span>
  );
}

/** Caps-лейбл 10/800 внутри стеклянных карточек (цвет задаётся вызовом). */
function CapsLabel({ children, color }: { children: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.8, // .08em при 10px
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </span>
  );
}

/** SectionHeader (макет строка 2772): caps 10.5/800 + правая ссылка 11.5/800. */
function SectionHeader({ title, linkLabel, linkHref }: { title: string; linkLabel?: string; linkHref?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.84, // .08em при 10.5px
          textTransform: "uppercase",
          color: SECTION_CAP,
        }}
      >
        {title}
      </span>
      {linkLabel && linkHref ? (
        <Link href={linkHref} style={{ fontSize: 11.5, fontWeight: 800, color: status.violet.text }}>
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

/** StarRating — 5 звёзд 14px, gap 2 (макет строка 284). */
function StarRating({
  count,
  total = 5,
  size = 14,
  color = "#FFFFFF",
  mutedColor = "rgba(255,255,255,0.35)",
  gap = 2,
}: {
  count: number;
  total?: number;
  size?: number;
  color?: string;
  mutedColor?: string;
  gap?: number;
}) {
  return (
    <span className="flex" style={{ gap }}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden>
          <path d={STAR_PATH} style={{ fill: i < count ? color : mutedColor }} />
        </svg>
      ))}
    </span>
  );
}

/**
 * SubjectTile — белый глиф 14/800 на градиенте предмета 135° + цветная тень
 * sh-color по тёмному стопу градиента (макет §s1, строки 2677–2687).
 */
function SubjectTile({
  subjectKey,
  size = 40,
  radius: r = 13,
  glyph,
}: {
  subjectKey: SubjectKey;
  size?: number;
  radius?: number;
  glyph?: string;
}) {
  const dark = subjects[subjectKey].grad[1];
  const rgb = `${parseInt(dark.slice(1, 3), 16)},${parseInt(dark.slice(3, 5), 16)},${parseInt(dark.slice(5, 7), 16)}`;
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: subjectGrad(subjectKey),
        boxShadow: shColor(rgb),
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {glyph}
    </span>
  );
}

/**
 * ProgressBar — линейная полоса (макет §s5): трек r=height/2, заливка
 * градиентом 90° (слева направо), обёртка row gap 7.
 */
function ProgressBar({
  pct,
  height = 5.5,
  fillGradient,
  trackColor = TRACK,
}: {
  pct: number;
  height?: number;
  fillGradient: Gradient;
  trackColor?: string;
}) {
  const ratio = Math.max(0, Math.min(1, pct));
  const r = height / 2;
  return (
    <span className="flex items-center" style={{ gap: 7 }}>
      <span className="relative block flex-1 overflow-hidden" style={{ height, borderRadius: r, background: trackColor }}>
        <span
          className="absolute bottom-0 left-0 top-0 block"
          style={{ width: `${ratio * 100}%`, borderRadius: r, background: lg(90, fillGradient[0], fillGradient[1]) }}
        />
      </span>
    </span>
  );
}

/**
 * Sparkline — параметрическая ломаная (charts/Sparkline.tsx): ось X равномерно,
 * ось Y нормирована по [min,max] с инверсией, padding = strokeWidth.
 */
function Sparkline({
  values,
  width,
  height,
  strokeColor,
  strokeWidth = 2.2,
  endDot = false,
  endDotRadius,
  fluid = false,
}: {
  values: number[];
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth?: number;
  endDot?: boolean;
  endDotRadius?: number;
  /** true — svg тянется по ширине контейнера, но не шире `width` (viewBox тот же). */
  fluid?: boolean;
}) {
  const n = values.length;
  if (n < 2) return <span className="block" style={{ width, height }} />;

  const padX = strokeWidth;
  const padY = strokeWidth;
  const usableW = Math.max(0, width - 2 * padX);
  const usableH = Math.max(0, height - 2 * padY);

  let minV = values[0]!;
  let maxV = values[0]!;
  for (let i = 1; i < n; i++) {
    const v = values[i]!;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const range = maxV - minV;

  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = padX + (usableW * i) / (n - 1);
    const t = range === 0 ? 0.5 : (values[i]! - minV) / range;
    const y = padY + (1 - t) * usableH;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const last = pts[pts.length - 1]!.split(",");
  const lastX = parseFloat(last[0]!);
  const lastY = parseFloat(last[1]!);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="shrink-0"
      style={fluid ? { width: "100%", maxWidth: width } : undefined}
      aria-hidden
    >
      {/* Цвет линии и точки — через style: на вкладке «Динамика» сюда приходит
          токен accent = var(--p-accent, …), а var() в SVG-атрибутах stroke=/fill=
          не разрешается — график остался бы бесцветным в обеих темах. */}
      <polyline
        points={pts.join(" ")}
        fill="none"
        style={{ stroke: strokeColor }}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot ? (
        <circle
          cx={lastX}
          cy={lastY}
          r={endDotRadius ?? strokeWidth * 1.6}
          style={{ fill: strokeColor }}
        />
      ) : null}
    </svg>
  );
}

/** Chip-«pill»: маленький бордерный chip с текстом (сильные / зоны роста). */
function ToneChip({ label, tone }: { label: string; tone: StatusKey }) {
  const st = status[tone];
  const c = chip(st.rgb);
  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{
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

/**
 * SegmentPills (gt-вариант, макет строки 290, 3835): flex 1 на пилюлю,
 * паддинг 9×0, r999, 11.5. Активная — accent-градиент 135° + тень
 * 0 8 18 rgba(124,58,237,.35); неактивная — стекло 160° W60→W40 без рамки.
 */
function SegmentPills({
  items,
  activeIndex,
  onChange,
}: {
  items: readonly string[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex" style={{ gap: 7 }}>
      {items.map((label, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(i)}
            className="flex flex-1 items-center justify-center"
            style={{
              paddingTop: 9,
              paddingBottom: 9,
              borderRadius: 999,
              background: active ? accentGrad : PILL_INACTIVE_BG,
              boxShadow: active ? PILL_ACTIVE_SHADOW : undefined,
              fontSize: 11.5,
              fontWeight: active ? 800 : 700,
              color: active ? "#FFFFFF" : PILL_INACTIVE_TEXT,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Пустое состояние внутри стеклянной карточки. */
function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 4, padding: "22px 16px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>{title}</span>
      {hint ? <span style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>{hint}</span> : null}
    </div>
  );
}

/** Карточка «EduOS Assistant» (макет строки 332–336). */
function AssistantCard({ note }: { note: string }) {
  return (
    <AccentCard
      gradient={["#8b5cf6", "#6366f1"]}
      shadowRgb="139,92,246"
      radius={20}
      contentStyle={{ padding: 14, display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          border: `1px solid ${ACCENT_INSET_BORDER}`,
          background: ACCENT_INSET_BG,
        }}
      >
        <SparkGlyph size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>EduOS Assistant</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{note}</span>
      </span>
    </AccentCard>
  );
}

/* ─── Производные (считаются из реальных оценок) ──────────────────────────── */

interface SubjectStat {
  subject: ProgressSubject;
  avg: number;
  count: number;
  /** Разница со средним предыдущего месяца; null — сравнивать не с чем. */
  delta: number | null;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** «оценка / оценки / оценок» — для подписи «N оценок за 7 дней». */
function pluralGrades(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "оценка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "оценки";
  return "оценок";
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export function ProgressView({ data }: { data: ProgressViewData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0); // 0 — Оценки, 1 — Динамика
  const [period, setPeriod] = useState<string>(data.defaultPeriod);
  const [periodOpen, setPeriodOpen] = useState(false);

  const { child, childLoadError, grades, subjects: subjectList, dynamics } = data;

  useEffect(() => {
    router.prefetch(R.notifications);
    router.prefetch(R.profile);
  }, [router]);

  const subjectByName = useMemo(
    () => new Map(subjectList.map((s) => [s.name, s])),
    [subjectList],
  );

  /** Средний балл за всё время — как в макете (карточка не зависит от периода). */
  const overallAverage = useMemo(() => averageOf(grades.map((g) => g.grade5)), [grades]);

  /** Предыдущий месяц относительно выбранного периода (для дельт). */
  const prevMonth = useMemo(() => {
    if (period === "all") return null;
    const idx = data.periods.findIndex((p) => p.id === period);
    const next = idx >= 0 ? data.periods[idx + 1] : undefined;
    return next && next.id !== "all" ? next.id : null;
  }, [period, data.periods]);

  const periodGrades = useMemo(
    () => (period === "all" ? grades : grades.filter((g) => g.month === period)),
    [grades, period],
  );

  const subjectStats = useMemo<SubjectStat[]>(() => {
    const byName = new Map<string, number[]>();
    for (const g of periodGrades) {
      const list = byName.get(g.subject);
      if (list) list.push(g.grade5);
      else byName.set(g.subject, [g.grade5]);
    }
    const prevByName = new Map<string, number[]>();
    if (prevMonth) {
      for (const g of grades) {
        if (g.month !== prevMonth) continue;
        const list = prevByName.get(g.subject);
        if (list) list.push(g.grade5);
        else prevByName.set(g.subject, [g.grade5]);
      }
    }
    return Array.from(byName.entries())
      .map(([name, values]) => {
        const avg = averageOf(values) ?? 0;
        const prevAvg = averageOf(prevByName.get(name) ?? []);
        return {
          subject:
            subjectByName.get(name) ?? ({ id: null, name, key: "prog", glyph: SUBJECT_GLYPH.prog } as ProgressSubject),
          avg,
          count: values.length,
          delta: prevAvg == null ? null : avg - prevAvg,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [periodGrades, grades, prevMonth, subjectByName]);

  /** Сильные стороны / зоны роста — от среднего ЗА ПЕРИОД, без выдуманных ярлыков. */
  const periodAverage = useMemo(() => averageOf(periodGrades.map((g) => g.grade5)), [periodGrades]);
  const strengths = useMemo(
    () =>
      periodAverage == null
        ? []
        : subjectStats.filter((s) => s.avg >= periodAverage).slice(0, 3).map((s) => s.subject.name),
    [subjectStats, periodAverage],
  );
  const growthAreas = useMemo(
    () =>
      periodAverage == null
        ? []
        : subjectStats.filter((s) => s.avg < periodAverage).slice(-3).map((s) => s.subject.name),
    [subjectStats, periodAverage],
  );

  /** Дельта периода к предыдущему месяцу — подпись справа от кнопки периода. */
  const periodDeltaNote = useMemo(() => {
    if (!prevMonth || periodAverage == null) return null;
    const prevAvg = averageOf(grades.filter((g) => g.month === prevMonth).map((g) => g.grade5));
    if (prevAvg == null) return null;
    const diff = periodAverage - prevAvg;
    const prep = data.periods.find((p) => p.id === prevMonth)?.prepLabel ?? "";
    if (Math.abs(diff) < 0.05) return { text: `Столько же, что и в ${prep}`, up: true };
    return {
      text: `${diff > 0 ? "Выше" : "Ниже"} на ${Math.abs(diff).toFixed(1)}, чем в ${prep} ${diff > 0 ? "↗" : "↘"}`,
      up: diff > 0,
    };
  }, [prevMonth, periodAverage, grades, data.periods]);

  const dynamicsValues = useMemo(() => dynamics.map((d) => d.avg), [dynamics]);

  /** Текст ассистента — только из реальных чисел. */
  const assistantNote = useMemo(() => {
    if (overallAverage == null) return T.noGradesHint;
    const best = subjectStats[0];
    const worst = subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : undefined;
    const parts = [`Средний балл — ${gradeLabel(overallAverage)}.`];
    if (best) parts.push(`Лучше всего идёт «${best.subject.name}» (${gradeLabel(best.avg)}).`);
    if (worst && best && worst.subject.name !== best.subject.name) {
      parts.push(`Больше внимания стоит уделить предмету «${worst.subject.name}» (${gradeLabel(worst.avg)}).`);
    }
    return parts.join(" ");
  }, [overallAverage, subjectStats]);

  const weekLabel =
    data.weekActivity.deltaPct != null
      ? `${data.weekActivity.deltaPct > 0 ? "+" : ""}${data.weekActivity.deltaPct}%`
      : data.weekActivity.thisWeek > 0
        ? String(data.weekActivity.thisWeek)
        : "—";

  const review = data.reviews[0];

  return (
    <>
      {/* Шапка (274–279): заголовок «Успехи» 17/600, колокольчик с бейджем,
          аватар родителя. Общий компонент каркаса v2 — своей копии не заводим. */}
      <RootHeader
        title={T.navGrades}
        titleSize={17}
        showLogo
        bellBadge={data.bellCount}
        initials={data.parent.initials}
        onBell={() => router.push(R.notifications)}
        onAvatar={() => router.push(R.profile)}
      />

      <div
        className="mx-auto flex w-full max-w-[430px] flex-col"
        style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8, gap: 12 }}
      >
        {!child ? (
          <GlassCard radius={22}>
            <EmptyBlock
              title={childLoadError ? T.loadError : T.noChild}
              hint={childLoadError ? T.loadErrorHint : T.noChildHint}
            />
          </GlassCard>
        ) : (
          <>
            {/* ChildSwitcherCard compact (281): r18, паддинг 10×12, аватар 44.
                Внутри две разные цели, поэтому карточка — контейнер. */}
            <GlassCard radius={18}>
              <div className="flex items-center" style={{ padding: "10px 12px", gap: 10 }}>
                <Link href={R.child} className="flex min-w-0 flex-1 items-center" style={{ gap: 10 }}>
                  <span className="block shrink-0" style={{ margin: 2 }}>
                    <Avatar initials={child.initial} gradient={child.gradient} size={44} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 800, color: ink1 }}>
                      {child.fullName}
                    </span>
                    <span className="flex items-center" style={{ gap: 4 }}>
                      <span className="truncate" style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>
                        {/* className из parent-context уже содержит слово
                            «класс» («10-А класс») — без проверки выводилось
                            «10-А класс класс». */}
                        {child.className
                          ? (/класс/i.test(child.className) ? child.className : `${child.className} ${T.class}`)
                          : "—"}
                      </span>
                      <ChevronDown size={10} color={ink2} strokeWidth={2.4} />
                    </span>
                  </span>
                </Link>
                <span className="flex shrink-0 flex-col items-end" style={{ gap: 4 }}>
                  {child.statusLabel ? (
                    <Link
                      href={R.day}
                      className="inline-flex items-center"
                      style={{
                        gap: 4,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: chip(status.green.rgb).background,
                        border: `1px solid ${chip(status.green.rgb).borderColor}`,
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: 3, background: `rgb(${status.green.rgb})` }} />
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: status.green.text }}>
                        {child.statusLabel}
                      </span>
                    </Link>
                  ) : null}
                  <Link href={R.child} style={{ fontSize: 10.5, fontWeight: 800, color: status.violet.text }}>
                    {`${T.childProfile} ›`}
                  </Link>
                </span>
              </div>
            </GlassCard>

            {/* AccentCard «Средний балл» (282–289). */}
            <AccentCard
              gradient={["#f97316", "#ec4899"]}
              shadowRgb="249,115,22"
              radius={22}
              contentStyle={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="flex items-start">
                <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 6 }}>
                  <AccentCapsLabel>{T.average}</AccentCapsLabel>
                  <div className="flex items-end" style={{ gap: 6 }}>
                    <span style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 34, color: "#FFFFFF" }}>
                      {overallAverage != null ? gradeLabel(overallAverage) : "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                      /5
                    </span>
                  </div>
                  <StarRating count={overallAverage != null ? Math.round(overallAverage) : 0} size={14} />
                </div>
                <span
                  className="shrink-0"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.2)",
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "#FFFFFF",
                  }}
                >
                  {`${grades.length} ${pluralGrades(grades.length)}`}
                </span>
              </div>

              <div className="flex" style={{ gap: 10 }}>
                <AccentInset
                  radius={14}
                  className="flex flex-1 flex-col"
                  style={{ padding: 12, gap: 6, display: "flex", flexDirection: "column" }}
                >
                  <AccentCapsLabel>{T.weekProgress}</AccentCapsLabel>
                  <span className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>{weekLabel}</span>
                    <Sparkline
                      values={dynamicsValues}
                      width={56}
                      height={20}
                      strokeColor="#FFFFFF"
                      strokeWidth={2.2}
                    />
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                    {`${data.weekActivity.thisWeek} ${pluralGrades(data.weekActivity.thisWeek)} за 7 дней`}
                  </span>
                </AccentInset>

                <AccentInset
                  radius={14}
                  href={R.attendance}
                  className="flex-1"
                  style={{ padding: 12, gap: 6, display: "flex", flexDirection: "column" }}
                >
                  <span className="flex items-center justify-between">
                    <AccentCapsLabel>{T.attendance}</AccentCapsLabel>
                    <ChevronRight />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>
                    {`${data.attendance.pct}%`}
                  </span>
                  <span className="block" style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.3)" }}>
                    <span
                      className="block"
                      style={{ height: 4, borderRadius: 2, width: `${data.attendance.pct}%`, background: "#FFFFFF" }}
                    />
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                    {`${T.attendanceRatioPrefix} ${data.attendance.present}/${data.attendance.total}`}
                  </span>
                </AccentInset>
              </div>
            </AccentCard>

            {/* SegmentPills (290). Вкладки «Навыки» нет — под неё нет данных. */}
            <SegmentPills items={[T.tabGrades, T.tabDyn]} activeIndex={activeTab} onChange={setActiveTab} />

            {/* ─── Ветка «Оценки» ─────────────────────────────────────────── */}
            {activeTab === 0 &&
              (grades.length === 0 ? (
                <GlassCard radius={22}>
                  <EmptyBlock title={T.noGrades} hint={T.noGradesHint} />
                </GlassCard>
              ) : (
                <>
                  {/* Период + delta (294–304). */}
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPeriodOpen((v) => !v)}
                        className="flex items-center"
                        style={{
                          padding: "7px 12px",
                          borderRadius: 999,
                          border: `1px solid ${glassBorder}`,
                          background: PERIOD_BG,
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>
                          {data.periods.find((p) => p.id === period)?.label ?? T.periodAll}
                        </span>
                        <ChevronDown size={10} color={ink1} strokeWidth={2.4} />
                      </button>
                      {periodOpen ? (
                        <div
                          className="absolute left-0 flex flex-col"
                          style={{
                            top: "110%",
                            zIndex: 25,
                            width: 170,
                            borderRadius: 16,
                            border: `1px solid ${POPOVER_BORDER}`,
                            background: POPOVER_BG,
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                            boxShadow: POPOVER_SHADOW,
                            paddingTop: 4,
                            paddingBottom: 4,
                          }}
                        >
                          {data.periods.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setPeriod(p.id);
                                setPeriodOpen(false);
                              }}
                              className="text-left"
                              style={{
                                padding: "9px 14px",
                                fontSize: 12,
                                fontWeight: p.id === period ? 800 : 700,
                                color: p.id === period ? accent : ink1,
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-1 justify-end">
                      {periodDeltaNote ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: periodDeltaNote.up ? status.green.text : status.red.text,
                          }}
                        >
                          {periodDeltaNote.text}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: ink3 }}>
                          {`${periodGrades.length} ${pluralGrades(periodGrades.length)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {subjectStats.length === 0 ? (
                    <GlassCard radius={22}>
                      <EmptyBlock title={T.noGradesPeriod} />
                    </GlassCard>
                  ) : (
                    <>
                      {/* Subjects grid (305–312). */}
                      <SectionHeader
                        title={T.subjectsSection}
                        linkLabel={`${T.allSubjects} ›`}
                        linkHref={R.subjects}
                      />
                      <div className="flex flex-wrap" style={{ gap: 8 }}>
                        {subjectStats.map((s) => (
                          <Link
                            key={s.subject.name}
                            href={subjectHref(s.subject.id)}
                            className="flex flex-col items-center"
                            style={{
                              flex: "1 1 31%",
                              gap: 6,
                              padding: "12px 6px",
                              borderRadius: 16,
                              border: `1px solid ${glassBorder}`,
                              background: TILE_BG,
                            }}
                          >
                            <SubjectTile subjectKey={s.subject.key} size={34} radius={11} glyph={s.subject.glyph} />
                            <span className="flex items-center" style={{ gap: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>{gradeLabel(s.avg)}</span>
                              <StarGlyph size={11} />
                            </span>
                            <span
                              className="w-full truncate text-center"
                              style={{ fontSize: 8.5, fontWeight: 700, color: ink2 }}
                            >
                              {s.subject.name}
                            </span>
                          </Link>
                        ))}
                      </div>

                      {/* Строки ProgressBar по предметам (313–319). */}
                      <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                        {subjectStats.map((s) => {
                          const g = subjects[s.subject.key].grad;
                          const deltaLabel =
                            s.delta == null
                              ? `${s.count} ${pluralGrades(s.count)}`
                              : `${s.delta >= 0 ? "↑" : "↓"} ${Math.abs(s.delta).toFixed(1)}`;
                          return (
                            <Link
                              key={s.subject.name}
                              href={subjectHref(s.subject.id)}
                              className="flex items-center"
                              style={{ gap: 10 }}
                            >
                              <SubjectTile subjectKey={s.subject.key} size={28} radius={9} glyph={s.subject.glyph} />
                              <span
                                className="truncate text-left"
                                style={{ width: 96, flexShrink: 0, fontSize: 11, fontWeight: 800, color: ink1 }}
                              >
                                {s.subject.name}
                              </span>
                              <span className="min-w-0 flex-1">
                                <ProgressBar pct={s.avg / 5} height={5.5} fillGradient={[g[0], g[1]]} />
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>{gradeLabel(s.avg)}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: s.delta == null ? ink3 : s.delta >= 0 ? status.green.text : status.red.text,
                                  minWidth: 46,
                                  textAlign: "right",
                                }}
                              >
                                {deltaLabel}
                              </span>
                            </Link>
                          );
                        })}
                      </GlassCard>

                      {/* «Сильные / зоны роста» (320–325). */}
                      {strengths.length > 0 || growthAreas.length > 0 ? (
                        <GlassCard
                          radius={22}
                          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
                        >
                          <CapsLabel color={status.green.text}>{T.strengths}</CapsLabel>
                          <div className="flex flex-wrap" style={{ gap: 6 }}>
                            {strengths.map((s) => (
                              <ToneChip key={s} label={s} tone="green" />
                            ))}
                          </div>
                          <div style={{ height: 1, background: DIVIDER }} />
                          <CapsLabel color={status.red.text}>{T.growthAreas}</CapsLabel>
                          <div className="flex flex-wrap" style={{ gap: 6 }}>
                            {growthAreas.length > 0 ? (
                              growthAreas.map((s) => <ToneChip key={s} label={s} tone="red" />)
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: ink3 }}>
                                Отстающих предметов нет
                              </span>
                            )}
                          </div>
                        </GlassCard>
                      ) : null}
                    </>
                  )}

                  {/* Отзыв учителя (326–331). */}
                  <SectionHeader title={T.lastReviews} linkLabel={`${T.viewAll} ›`} linkHref={R.reviews} />
                  {review ? (
                    <GlassCard radius={22} style={{ padding: 0 }}>
                      <Link
                        href={R.reviews}
                        className="flex"
                        style={{ padding: 14, flexDirection: "row", gap: 10 }}
                      >
                        <span className="relative block shrink-0" style={{ width: 38, height: 38 }}>
                          <Avatar initials={review.teacherInitials} gradient={review.teacherGradient} size={38} />
                          <span
                            className="absolute block"
                            style={{
                              right: -1,
                              bottom: -1,
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              background: ONLINE_GREEN,
                              // Белая обводка точки — часть сигнального
                              // маркера макета, одна в обеих темах.
                              border: "2px solid #FFFFFF",
                            }}
                          />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
                          <span className="flex items-center justify-between">
                            <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                              {[review.teacherName, review.subjectName].filter(Boolean).join(" · ")}
                            </span>
                            <span className="shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>
                              {review.timeLabel}
                            </span>
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: "16.5px", color: ink2, ...CLAMP_3 }}>
                            {review.comment}
                          </span>
                        </span>
                        <span
                          className="flex shrink-0 items-center justify-center"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: `rgba(${status.green.rgb},0.14)`,
                            border: `1px solid rgba(${status.green.rgb},0.35)`,
                          }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
                            {/* status.green.text — это var(--p-status-green-text, …):
                                в атрибуте stroke= var() не работает, поэтому style. */}
                            <path
                              d={THUMB_PATH}
                              style={{ stroke: status.green.text }}
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </Link>
                    </GlassCard>
                  ) : (
                    <GlassCard radius={22}>
                      <EmptyBlock title={T.noReviews} hint={T.noReviewsHint} />
                    </GlassCard>
                  )}

                  {/* Assistant CTA (332–336). */}
                  <AssistantCard note={assistantNote} />
                </>
              ))}

            {/* ─── Ветка «Динамика» ───────────────────────────────────────── */}
            {activeTab === 1 &&
              (dynamics.length < 2 ? (
                <GlassCard radius={22}>
                  <EmptyBlock title={T.noDynamics} hint={grades.length === 0 ? T.noGradesHint : undefined} />
                </GlassCard>
              ) : (
                <>
                  <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <CapsLabel color={ink3}>{T.dynAvg}</CapsLabel>
                    <Sparkline
                      values={dynamicsValues}
                      width={320}
                      height={90}
                      strokeColor={accent}
                      strokeWidth={3}
                      endDot
                      endDotRadius={4.5}
                      fluid
                    />
                    <div className="flex justify-between">
                      {dynamics.map((m) => (
                        <span key={m.monthKey} style={{ fontSize: 10, fontWeight: 700, color: ink3 }}>
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard radius={22} style={{ padding: 14 }}>
                    {dynamics
                      .slice()
                      .reverse()
                      .map((m, i, arr) => {
                        const prev = arr[i + 1];
                        const diff = prev ? m.avg - prev.avg : null;
                        return (
                          <div
                            key={m.monthKey}
                            className="flex items-center"
                            style={{
                              paddingTop: 10,
                              paddingBottom: 10,
                              borderTop: i === 0 ? undefined : `1px solid ${DIVIDER}`,
                            }}
                          >
                            <span
                              className="flex-1"
                              style={{ fontSize: 12, fontWeight: i === 0 ? 800 : 700, color: ink1 }}
                            >
                              {m.label}
                            </span>
                            <span
                              style={{ fontSize: 12, fontWeight: i === 0 ? 800 : 700, color: ink1, marginRight: 12 }}
                            >
                              {gradeLabel(m.avg)}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: diff == null ? ink3 : diff >= 0 ? status.green.text : status.red.text,
                              }}
                            >
                              {diff == null ? "—" : `${diff >= 0 ? "↑" : "↓"} ${Math.abs(diff).toFixed(1)}`}
                            </span>
                          </div>
                        );
                      })}
                  </GlassCard>

                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: ink2,
                      textAlign: "center",
                      paddingLeft: 12,
                      paddingRight: 12,
                    }}
                  >
                    {assistantNote}
                  </p>
                </>
              ))}
          </>
        )}
      </div>
    </>
  );
}
