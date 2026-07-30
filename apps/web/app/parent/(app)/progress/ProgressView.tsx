"use client";

/**
 * П10 «Успехи» — ВЕБ-порт экрана родительского приложения.
 *
 * Источник 1:1 — apps/mobile-parent/src/screens/tabs/ProgressScreen.tsx с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go), который
 * сам перенесён дословно из макета «SNR EduOS v2 Light.dc.html», строки 273–374:
 *   274–279  шапка RootHeader (заголовок 17/600, лого, колокольчик, аватар);
 *   281      ChildSwitcherCard compact + «Сменить ребёнка ›»;
 *   282–289  AccentCard «Средний балл» + 2 AccentInset («Прогресс за неделю»
 *            со Sparkline 56×20 и «Посещаемость» с полосой 4px);
 *   290      SegmentPills 3 таба «Оценки / Навыки / Динамика»;
 *   294–304  период-popover (170px) + дельта «Выше на 0.2, чем в июне ↗»;
 *   305–312  grid плиток предметов 3×2 (SubjectTile 34 r11 + оценка + звезда);
 *   313–319  GlassCard со строками ProgressBar по предметам;
 *   320–325  «Сильные стороны / Зоны роста» с chip-ами;
 *   326–331  SectionHeader «Последние отзывы» + карточка отзыва учителя;
 *   332–336  AccentCard EduOS Assistant;
 *   342–348  вкладка «Навыки»: SectionHeader + 4 плитки навыков (24×24 + %
 *            + ProgressBar 3.5px);
 *   349–353  GlassCard «Профиль навыков» с Radar 224 (6 осей с подписями);
 *   354      AccentCard EduOS Assistant (текст вкладки «Навыки»);
 *   360–364  вкладка «Динамика»: Sparkline 320×90 с endDot + 6 месяцев;
 *   365–369  GlassCard из 3 строк «месяц / средний балл / дельта»;
 *   370      итоговая заметка по центру;
 *   + шторка выбора ребёнка (2632–2644).
 *
 * Данные — ТОЛЬКО через аксессоры ../v2/data (точная копия data-слоя мобилки):
 * getGradesSummary, getSubjectStats, getSkillsTab, getGradePeriods,
 * getGradesAssistantNotes, getTeacherReviews, getAssistantTexts, getSubject,
 * getChildren, getSelectedChildContext, getParent, getUnreadNotificationsCount.
 * Ничего не пересчитывается и не выдумывается.
 *
 * Ветка isRealFlow мобилки (Supabase: getStudentGrades / getChildTeacherReviews)
 * на вебе НЕ переносится — ровно как на «Главной» (см. home/page.tsx): БД к
 * экранам v2 подключается отдельным шагом, после приёмки переноса вёрстки.
 * Поэтому здесь живёт демо-ветка мобилки, байт-в-байт.
 *
 * UI-компоненты мобилки (AccentCard/AccentInset, ChildSwitcherCard compact,
 * SegmentPills, SectionHeader, StarRating, SubjectTile, Popover, ProgressBar,
 * Radar, Sparkline, Avatar, BottomSheetFrame + ChildPickerSheetContent)
 * перенесены сюда локально с их точными радиусами/паддингами/цветами; общее
 * стекло и токены берутся из ../v2/GlassCard и ../v2/tokens — вторых копий
 * не заводим.
 *
 * Только светлая тема.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { GlassCard } from "../v2/GlassCard";
import { RootHeader } from "../v2/RootHeader";
import {
  accent,
  accentGrad,
  chip,
  fontDisplay,
  glassBorder,
  glassInset,
  ink1,
  ink2,
  ink3,
  shColor,
  status,
  subjectGrad,
  subjects,
  type StatusKey,
} from "../v2/tokens";
import {
  DEFAULT_CHILD_INDEX,
  getAssistantTexts,
  getChildren,
  getGradePeriods,
  getGradesAssistantNotes,
  getGradesSummary,
  getParent,
  getSelectedChildContext,
  getSkillsTab,
  getSubject,
  getSubjectStats,
  getTeacherReviews,
  getUnreadNotificationsCount,
} from "../v2/data";
import type { BaseSubjectKey, SubjectStatRow } from "../v2/data";

/* ─────────────────────────────────────────────────────────────────────────────
 * Локальные константы, которых нет в v2/tokens.ts: в мобилке это приватные
 * константы соответствующих ui-компонентов (значения светлой темы, дословно).
 * ────────────────────────────────────────────────────────────────────────── */

/** SectionHeader: заголовок 10.5/800 rgba(26,19,74,.5) (макет строка 2772). */
const SECTION_TITLE = "rgba(26,19,74,0.5)";
/** ChildSwitcherCard: «Сменить ребёнка ›» #6d28d9 (макет строка 281). */
const LINK = "#6D28D9";
/** AccentCard: внутренний блик inset 0 1.5 0 W35 (макет строка 242). */
const ACCENT_INSET_SHADOW = "inset 0 1.5px 0 rgba(255,255,255,0.35)";
/** AccentInset: стекло внутри непрозрачной градиентной карточки (строка 2741). */
const ACCENT_INSET_BG = "rgba(255,255,255,0.2)";
const ACCENT_INSET_BORDER = "rgba(255,255,255,0.35)";
/** Разделитель строк «Динамики» (borderTop, макет строки 366–368). */
const ROW_DIVIDER = "rgba(23,18,67,0.07)";
/** Разделитель «Сильные стороны / Зоны роста» (макет строка 323). */
const CARD_DIVIDER = "rgba(23,18,67,0.08)";
/** ProgressBar: трек светлой темы. */
const TRACK = "rgba(23,18,67,0.09)";
/** Плитки предметов/навыков: полупрозрачная заливка (макет строки 306, 343). */
const TILE_BG = "rgba(255,255,255,0.4)";
/** Кнопка периода (макет строка 294). */
const PERIOD_BG = "rgba(255,255,255,0.6)";
/** Popover периода (макет строка 298): 160° W94→W82, blur 24, border W90. */
const POPOVER_BG = "linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.82))";
const POPOVER_BORDER = "rgba(255,255,255,0.9)";
const POPOVER_SHADOW = "0 18px 40px rgba(64,54,150,0.28)";
/** SegmentPills gt (макет строки 290, 3835): активная — accent-градиент с тенью,
 *  неактивная — 160° W60→W40 БЕЗ рамки (осознанная правка мобилки, пост-заход 8). */
const PILL_INACTIVE_BG = "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(255,255,255,0.4))";
const PILL_INACTIVE_TEXT = "rgba(26,19,74,0.66)";
const PILL_ACTIVE_SHADOW = "0 8px 18px rgba(124,58,237,0.35)";
/** Radar: сетка/спицы светлой темы (charts/Radar.tsx). */
const RADAR_OUTER_GRID = "rgba(23,18,67,0.14)";
const RADAR_INNER_GRID = "rgba(23,18,67,0.09)";
const RADAR_SPOKE = "rgba(23,18,67,0.08)";
/** Онлайн-точка на аватаре учителя (макет строка 327). */
const ONLINE_DOT = "#22C55E";
/** Звезда рядом с оценкой предмета (макет строка 306). */
const STAR_AMBER = "#F59E0B";
/** Шторка (BottomSheetFrame, макет 4227–4228). */
const SHEET_OVERLAY = "rgba(23,18,67,0.35)";
const SHEET_BG = "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76))";
const SHEET_BORDER = "rgba(255,255,255,0.9)";
const SHEET_SHADOW = "0 -16px 50px rgba(64,54,150,0.3)";
const SHEET_GRIP = "rgba(23,18,67,0.2)";
/** ChildPickerSheetContent: фон невыбранной галочки (макет строка 4381). */
const CHECK_OFF_BG = "rgba(23,18,67,0.08)";

/**
 * Тексты — ru, дословно из packages/core/src/i18n/ru.ts (parentApp.*), теми же
 * ключами, что зовёт RN-экран. Веб-порт делаем только для русского.
 */
const T = {
  navGrades: "Успехи", // nav.grades
  class: "класс", // grades.class
  switchChild: "Сменить ребёнка", // prof.switchChild
  average: "Средний балл", // grades.average
  attendance: "Посещаемость", // scr.attendance
  tabGrades: "Оценки", // grades.tabGrades
  tabSkills: "Навыки", // grades.tabSkills
  tabDyn: "Динамика", // grades.tabDyn
  subjectsSection: "Предметы", // grades.subjects
  allSubjects: "Все предметы", // scr.allSubjects
  lastReviews: "Последние отзывы", // grades.lastReviews
  viewAll: "Смотреть все", // common.viewAll
  more: "Подробнее", // common.more
  skillsProgress: "Навыки и прогресс", // skills.progress
  skillsProfile: "Профиль навыков", // skills.profile
  dynAvg: "Динамика среднего балла", // grades.dynAvg
  chooseChild: "Выберите ребёнка", // auth.chooseChild
  axisLogic: "Логика", // skills.axisLogic
  axisCommunication: "Комм.", // skills.axisCommunication
  axisDiscipline: "Дисц.", // skills.axisDiscipline
  axisCreativity: "Креатив", // skills.axisCreativity
  axisIndependence: "Самост.", // skills.axisIndependence
  axisTeamwork: "Команда", // skills.axisTeamwork
  /** Не из словаря: в RN-экране эти строки — литералы (строки 610, 650, 876, 894). */
  weekProgress: "Прогресс за неделю",
  attendanceRatioPrefix: "присутствий",
  strengths: "Сильные стороны",
  growthAreas: "Зоны роста",
  /** Подписи месяцев вкладки «Динамика» (литерал RN, строка 1255). */
  dynMonths: ["фев", "мар", "апр", "май", "июн", "июл"],
} as const;

/**
 * Глиф предмета (макет: prog «< >», math «√x», eng «Aa», rus «Aa», robo — SVG) —
 * дословно SUBJECT_GLYPH из ProgressScreen.tsx.
 */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
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

/* ─── Иконки: inline-пути 24×24, дословно из RN (НЕ lucide) ──────────────── */

/** Путь звезды из макета (строки 284, 306) — StarRating / StarGlyph. */
const STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z";
/** «Искра» EduOS Assistant (макет строка 332). */
const SPARK_PATH = "M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z";
/** Иконка «лайк» в карточке отзыва (макет строка 330). */
const THUMB_PATH = "M7 22V11m0 0h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-3l1 4a2 2 0 1 1-4 0v-1H7Z";

function StarGlyph({ size = 12, color = STAR_AMBER }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className="shrink-0" aria-hidden>
      <path d={STAR_PATH} />
    </svg>
  );
}

function ChevronRight({ size = 9, color = "#FFFFFF", strokeWidth = 2.6 }: { size?: number; color?: string; strokeWidth?: number }) {
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
 * box-shadow 0 0 0 2px #fff + 0 0 0 4.5px ring.
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

/**
 * AccentInset — «стеклянная вставка» внутри градиентной карточки (макет
 * строка 2741): rgba(255,255,255,.2) + blur(8) + border W35.
 */
function AccentInset({
  radius: r = 12,
  pressable = false,
  className = "",
  style,
  children,
}: {
  radius?: number;
  pressable?: boolean;
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
  if (pressable) {
    return (
      <button type="button" className={`block text-left ${className}`} style={surface}>
        {children}
      </button>
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
          <path d={STAR_PATH} fill={i < count ? color : mutedColor} />
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
  subjectId,
  size = 40,
  radius: r = 13,
  glyph,
}: {
  subjectId: BaseSubjectKey;
  size?: number;
  radius?: number;
  glyph?: string;
}) {
  const dark = subjects[subjectId].grad[1];
  const rgb = `${parseInt(dark.slice(1, 3), 16)},${parseInt(dark.slice(3, 5), 16)},${parseInt(dark.slice(5, 7), 16)}`;
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: subjectGrad(subjectId),
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
  fillGradient: readonly [string, string];
  trackColor?: string;
}) {
  const ratio = Math.max(0, Math.min(1, pct));
  const r = height / 2;
  return (
    <span className="flex items-center" style={{ gap: 7 }}>
      <span
        className="relative block flex-1 overflow-hidden"
        style={{ height, borderRadius: r, background: trackColor }}
      >
        <span
          className="absolute bottom-0 left-0 top-0 block"
          style={{
            width: `${ratio * 100}%`,
            borderRadius: r,
            background: lg(90, fillGradient[0], fillGradient[1]),
          }}
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
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot ? <circle cx={lastX} cy={lastY} r={endDotRadius ?? strokeWidth * 1.6} fill={strokeColor} /> : null}
    </svg>
  );
}

/**
 * Radar — шестиугольный радар на 6 осях (charts/Radar.tsx): центр (60,54),
 * R = 44, оси по часовой от «верха» с шагом 60°; с подписями viewBox
 * «-14 0 148 108» (иначе текст обрезается), высота = size·108/148.
 */
const RADAR_CX = 60;
const RADAR_CY = 54;
const RADAR_R = 44;
/** Позиции подписей вокруг гексагона — как на #16 (макет строка 663). */
const RADAR_LABEL_POS: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
  { x: 60, y: 7, anchor: "middle" },
  { x: 102, y: 30, anchor: "start" },
  { x: 102, y: 82, anchor: "start" },
  { x: 60, y: 106, anchor: "middle" },
  { x: 18, y: 82, anchor: "end" },
  { x: 18, y: 30, anchor: "end" },
];

function radarAxisAngle(i: number): number {
  return -Math.PI / 2 + i * (Math.PI / 3);
}

function radarHexPoints(radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = radarAxisAngle(i);
    pts.push(`${(RADAR_CX + radius * Math.cos(a)).toFixed(2)},${(RADAR_CY + radius * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function Radar({
  values,
  max = 5,
  size = 200,
  fillColor,
  strokeColor,
  strokeWidth = 2,
  labels,
  labelFontSize = 7.5,
  gridRings = [1],
  showSpokes = false,
  showDots = false,
  dotRadius = 3,
}: {
  values: readonly number[];
  max?: number;
  size?: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth?: number;
  labels?: string[];
  labelFontSize?: number;
  gridRings?: number[];
  showSpokes?: boolean;
  showDots?: boolean;
  dotRadius?: number;
}) {
  const ringRatios = gridRings.slice().sort((a, b) => a - b);
  const outerRatio = ringRatios[ringRatios.length - 1] ?? 1;

  const outerVertices = Array.from({ length: 6 }, (_, i) => {
    const a = radarAxisAngle(i);
    return {
      x: RADAR_CX + RADAR_R * outerRatio * Math.cos(a),
      y: RADAR_CY + RADAR_R * outerRatio * Math.sin(a),
    };
  });
  const dataVertices = Array.from({ length: 6 }, (_, i) => {
    const raw = values[i] ?? 0;
    const ratio = Math.max(0, Math.min(1, max > 0 ? raw / max : 0));
    const a = radarAxisAngle(i);
    return { x: RADAR_CX + RADAR_R * ratio * Math.cos(a), y: RADAR_CY + RADAR_R * ratio * Math.sin(a) };
  });
  const dataPoints = dataVertices.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const hasLabels = Array.isArray(labels) && labels.length >= 6;
  const vbW = hasLabels ? 148 : 120;
  const viewBox = hasLabels ? "-14 0 148 108" : "0 0 120 108";
  const height = size * (108 / vbW);

  return (
    <svg width={size} height={height} viewBox={viewBox} aria-hidden>
      {ringRatios.map((ratio) => (
        <polygon
          key={ratio}
          points={radarHexPoints(RADAR_R * ratio)}
          fill="none"
          stroke={ratio === outerRatio ? RADAR_OUTER_GRID : RADAR_INNER_GRID}
          strokeWidth={ratio === outerRatio ? 1.5 : 1}
        />
      ))}
      {showSpokes
        ? outerVertices.map((v, i) => (
            <line key={i} x1={RADAR_CX} y1={RADAR_CY} x2={v.x} y2={v.y} stroke={RADAR_SPOKE} strokeWidth={1} />
          ))
        : null}
      <polygon points={dataPoints} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      {showDots
        ? dataVertices.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={dotRadius} fill={strokeColor} />)
        : null}
      {hasLabels
        ? RADAR_LABEL_POS.map((pos, i) => (
            <text
              key={i}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              fontSize={labelFontSize}
              fontWeight={700}
              fill={ink2}
            >
              {labels![i]}
            </text>
          ))
        : null}
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

/**
 * SubjectGridTile — плитка предмета в grid 3×2 (макет 306–312):
 * flexBasis 31%, паддинг 12×6, r16, border glass, bg W40.
 */
function SubjectGridTile({ stat, subjectName }: { stat: SubjectStatRow; subjectName: string }) {
  return (
    <button
      type="button"
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
      <SubjectTile subjectId={stat.subject_id} size={34} radius={11} glyph={SUBJECT_GLYPH[stat.subject_id]} />
      <span className="flex items-center" style={{ gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>{stat.grade_label}</span>
        <StarGlyph size={11} />
      </span>
      <span
        className="w-full truncate text-center"
        style={{ fontSize: 8.5, fontWeight: 700, color: ink2 }}
      >
        {subjectName}
      </span>
    </button>
  );
}

/** Карточка «EduOS Assistant» (макет строки 332–336 / 354). */
function AssistantCard({ note }: { note: string }) {
  return (
    <AccentCard
      gradient={["#8b5cf6", "#6366f1"]}
      shadowRgb="139,92,246"
      radius={20}
      pressable
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
      <ChevronRight />
    </AccentCard>
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

export function ProgressView() {
  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX]?.id ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 grades, 1 skills, 2 dyn

  const periods = getGradePeriods();
  const [period, setPeriod] = useState<string>(periods.default_period);
  const [periodOpen, setPeriodOpen] = useState(false);

  const parent = getParent();
  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const summary = getGradesSummary();
  const stats = getSubjectStats();
  const skills = getSkillsTab();
  const notes = getGradesAssistantNotes();
  const review = getTeacherReviews()[0]!;
  const bellCount = getUnreadNotificationsCount();

  /**
   * Радар «Профиль навыков»: 6 названий осей через словарь, число у каждой
   * подписи — ЕЁ реальный radar_values[i] (фикстура не меняется).
   */
  const skillsRadarLabels = useMemo(
    () =>
      [T.axisLogic, T.axisCommunication, T.axisDiscipline, T.axisCreativity, T.axisIndependence, T.axisTeamwork].map(
        (name, i) => `${name} ${skills.radar_values[i]}%`,
      ),
    [skills.radar_values],
  );

  /**
   * Sparkline данные для карточки «Средний балл» — точки макета строка 286
   * «2,19 14,16 26,17 38,10 50,12 62,4»: значения = 24 − y (viewBox 64×24),
   * так шаг «выше — больше» сохраняется.
   */
  const weekSparklineValues = useMemo(
    () =>
      summary.sparkline_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 24 - y;
      }),
    [summary.sparkline_points],
  );

  /** То же для вкладки «Динамика» (строка 362, viewBox 320×90). */
  const dynSparklineValues = useMemo(
    () =>
      summary.dynamics_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 90 - y;
      }),
    [summary.dynamics_points],
  );

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

  return (
    <>
      {/* Шапка (274–279): заголовок «Успехи» 17/600, колокольчик с бейджем,
          аватар родителя. Общий компонент каркаса v2 — своей копии не заводим. */}
      <RootHeader title={T.navGrades} titleSize={17} showLogo bellBadge={bellCount} initials={parent.initials} />

      <div
        className="mx-auto flex w-full max-w-[430px] flex-col"
        style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8, gap: 12 }}
      >
        {/* ChildSwitcherCard compact (281): r18, паддинг 10×12, аватар 44. */}
        <GlassCard radius={18} onClick={() => setSheetOpen(true)}>
          <div className="flex items-center" style={{ padding: "10px 12px", gap: 10 }}>
            {/* Кольца аватара выступают наружу — компенсируем зазором. */}
            <span className="block shrink-0" style={{ margin: child.avatar_ring ? 4.5 : 2 }}>
              <Avatar
                initials={child.first_name.slice(0, 1)}
                gradient={child.avatar_gradient}
                ringColor={child.avatar_ring}
                size={44}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 800, color: ink1 }}>
                {child.full_name}
              </span>
              <span className="flex items-center" style={{ gap: 4 }}>
                <span className="truncate" style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>
                  {`${child.class_name} ${T.class}`}
                </span>
                <ChevronDown size={10} color={ink2} strokeWidth={2.4} />
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end" style={{ gap: 4 }}>
              {child.status_chip ? (
                <span
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
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: status.green.text }}>{child.status_chip}</span>
                </span>
              ) : null}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: LINK }}>{`${T.switchChild} ›`}</span>
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
                  {summary.average_label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.85)",
                    marginBottom: 6,
                  }}
                >
                  {`/${summary.average_max_label}`}
                </span>
              </div>
              <StarRating count={summary.stars_filled} size={14} />
            </div>
            {summary.average_chip ? (
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
                {summary.average_chip}
              </span>
            ) : null}
          </div>

          <div className="flex" style={{ gap: 10 }}>
            <AccentInset
              radius={14}
              className="flex flex-1 flex-col"
              style={{ padding: 12, gap: 6, display: "flex", flexDirection: "column" }}
            >
              <AccentCapsLabel>{T.weekProgress}</AccentCapsLabel>
              <span className="flex items-center" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>{summary.week_progress_label}</span>
                <Sparkline values={weekSparklineValues} width={56} height={20} strokeColor="#FFFFFF" strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                {summary.week_progress_note}
              </span>
            </AccentInset>

            <AccentInset
              radius={14}
              pressable
              className="flex-1"
              style={{ padding: 12, gap: 6, display: "flex", flexDirection: "column" }}
            >
              <span className="flex items-center justify-between">
                <AccentCapsLabel>{T.attendance}</AccentCapsLabel>
                <ChevronRight />
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>{`${summary.attendance_pct}%`}</span>
              <span className="block" style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.3)" }}>
                <span
                  className="block"
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${summary.attendance_pct}%`,
                    background: "#FFFFFF",
                  }}
                />
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                {`${T.attendanceRatioPrefix} ${summary.attendance_ratio_label}`}
              </span>
            </AccentInset>
          </div>
        </AccentCard>

        {/* SegmentPills 3 таба (290). */}
        <SegmentPills
          items={[T.tabGrades, T.tabSkills, T.tabDyn]}
          activeIndex={activeTab}
          onChange={setActiveTab}
        />

        {/* ─── Ветка «Оценки» ─────────────────────────────────────────────── */}
        {activeTab === 0 && (
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
                  <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>{period}</span>
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
                    {periods.periods.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPeriod(p);
                          setPeriodOpen(false);
                        }}
                        className="text-left"
                        style={{
                          padding: "9px 14px",
                          fontSize: 12,
                          fontWeight: p === period ? 800 : 700,
                          color: p === period ? accent : ink1,
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-1 justify-end">
                <span style={{ fontSize: 11, fontWeight: 800, color: status.green.text }}>
                  {`${summary.vs_prev_month_note} ↗`}
                </span>
              </div>
            </div>

            {/* Subjects grid (305–312). */}
            <SectionHeader title={T.subjectsSection} linkLabel={`${T.allSubjects} ›`} />
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {stats.map((s) => (
                <SubjectGridTile key={s.subject_id} stat={s} subjectName={getSubject(s.subject_id).name} />
              ))}
            </div>

            {/* Строки ProgressBar по предметам (313–319). */}
            <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {stats.map((s) => {
                const subject = getSubject(s.subject_id);
                const isDown = !s.is_up;
                return (
                  <button key={s.subject_id} type="button" className="flex items-center" style={{ gap: 10 }}>
                    <SubjectTile subjectId={s.subject_id} size={28} radius={9} glyph={SUBJECT_GLYPH[s.subject_id]} />
                    <span
                      className="truncate text-left"
                      style={{ width: 96, flexShrink: 0, fontSize: 11, fontWeight: 800, color: ink1 }}
                    >
                      {subject.name}
                    </span>
                    <span className="min-w-0 flex-1">
                      <ProgressBar pct={s.pct / 100} height={5.5} fillGradient={subject.gradient} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>{s.grade_label}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: isDown ? status.red.text : status.green.text,
                        minWidth: 32,
                        textAlign: "right",
                      }}
                    >
                      {s.delta_label}
                    </span>
                  </button>
                );
              })}
            </GlassCard>

            {/* «Сильные / зоны роста» (320–325). */}
            <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <CapsLabel color={status.green.text}>{T.strengths}</CapsLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {summary.strengths.map((s) => (
                  <ToneChip key={s} label={s} tone="green" />
                ))}
              </div>
              <div style={{ height: 1, background: CARD_DIVIDER }} />
              <CapsLabel color={status.red.text}>{T.growthAreas}</CapsLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {summary.growth_areas.map((s) => (
                  <ToneChip key={s} label={s} tone="red" />
                ))}
              </div>
            </GlassCard>

            {/* Отзыв учителя (326–331). */}
            <SectionHeader title={T.lastReviews} linkLabel={`${T.viewAll} ›`} />
            <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "row", gap: 10 }}>
              <span className="relative block shrink-0" style={{ width: 38, height: 38 }}>
                <span
                  className="flex items-center justify-center text-white"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    background: lg(135, "#8b5cf6", "#6366f1"),
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ГЮ
                </span>
                <span
                  className="absolute block"
                  style={{
                    right: -1,
                    bottom: -1,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: ONLINE_DOT,
                    border: "2px solid #FFFFFF",
                  }}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
                <span className="flex items-center justify-between">
                  <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                    {`${review.teacher_name} · ${getSubject(review.subject_id).name}`}
                  </span>
                  <span className="shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>
                    {review.time_label}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, lineHeight: "16.5px", color: ink2, ...CLAMP_3 }}>
                  {getAssistantTexts(childId).review}
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
                  <path
                    d={THUMB_PATH}
                    stroke={status.green.text}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </GlassCard>

            {/* Assistant CTA (332–336). */}
            <AssistantCard note={notes.grades} />
          </>
        )}

        {/* ─── Ветка «Навыки» ─────────────────────────────────────────────── */}
        {activeTab === 1 && (
          <>
            <SectionHeader title={T.skillsProgress} linkLabel={`${T.more} ›`} />
            {/* 4 плитки навыков одной строкой (343–348). */}
            <div className="flex flex-nowrap" style={{ gap: 6 }}>
              {skills.tiles.map((t) => (
                <div
                  key={t.name}
                  className="flex min-w-0 flex-1 flex-col"
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    border: `1px solid ${glassBorder}`,
                    background: TILE_BG,
                    gap: 6,
                  }}
                >
                  <span className="flex items-center" style={{ gap: 6 }}>
                    <span
                      className="block shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        background: lg(135, t.gradient[0], t.gradient[1]),
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>{`${t.pct}%`}</span>
                  </span>
                  <span className="block truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink2 }}>
                    {t.name}
                  </span>
                  <ProgressBar pct={t.pct / 100} height={3.5} fillGradient={t.gradient} />
                </div>
              ))}
            </div>

            {/* Профиль навыков — Radar (349–353). */}
            <GlassCard
              radius={22}
              style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}
            >
              <div className="w-full">
                <CapsLabel color={ink3}>{T.skillsProfile}</CapsLabel>
              </div>
              <Radar
                values={skills.radar_values}
                max={100}
                size={224}
                fillColor={`rgba(${status.violet.rgb},0.28)`}
                strokeColor={accent}
                labels={skillsRadarLabels}
                labelFontSize={7.5}
                gridRings={[0.33, 0.66, 1]}
                showSpokes
                showDots
              />
            </GlassCard>

            <AssistantCard note={notes.skills} />
          </>
        )}

        {/* ─── Ветка «Динамика» ───────────────────────────────────────────── */}
        {activeTab === 2 && (
          <>
            <GlassCard radius={22} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <CapsLabel color={ink3}>{T.dynAvg}</CapsLabel>
              <Sparkline
                values={dynSparklineValues}
                width={320}
                height={90}
                strokeColor={accent}
                strokeWidth={3}
                endDot
                endDotRadius={4.5}
                fluid
              />
              <div className="flex justify-between">
                {T.dynMonths.map((m) => (
                  <span key={m} style={{ fontSize: 10, fontWeight: 700, color: ink3 }}>
                    {m}
                  </span>
                ))}
              </div>
            </GlassCard>

            <GlassCard radius={22} style={{ padding: 14 }}>
              {summary.dynamics_months.map((m, i) => {
                const isCurrent = i === summary.dynamics_months.length - 1;
                return (
                  <div
                    key={m.month_label}
                    className="flex items-center"
                    style={{
                      paddingTop: 10,
                      paddingBottom: 10,
                      borderTop: i === 0 ? undefined : `1px solid ${ROW_DIVIDER}`,
                    }}
                  >
                    <span className="flex-1" style={{ fontSize: 12, fontWeight: isCurrent ? 800 : 700, color: ink1 }}>
                      {m.month_label}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: isCurrent ? 800 : 700, color: ink1, marginRight: 12 }}
                    >
                      {m.avg_label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: status.green.text }}>{m.delta_label}</span>
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
              {summary.dynamics_note}
            </p>
          </>
        )}

        {/* Шторка выбора ребёнка (2632–2644). */}
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
