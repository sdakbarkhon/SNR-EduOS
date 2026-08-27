"use client";

/**
 * П5 «Главная» (Dashboard) — ВЕБ-порт экрана родительского приложения.
 *
 * Вёрстка 1:1 — apps/mobile-parent/src/screens/tabs/HomeScreen.tsx с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go), который
 * сам перенесён дословно из макета «SNR EduOS v2 Light.dc.html», строки 219–271:
 *   227      приветствие;
 *   228–241  ChildSwitcherCard large + MetricsSplitRow (5 колонок);
 *   242–245  AccentCard «Следующий урок»;
 *   246–249  ряд «К оплате / Питание»;
 *   250–254  AccentCard «EduOS Assistant» с 2 CTA;
 *   255–263  QuickActionsGrid 3×2;
 *   264      SectionHeader ленты;
 *   265–269  GlassCard с 3 ListRow «Сегодня».
 *
 * ДАННЫЕ: экран больше НЕ читает фикстуры ../v2/data. Он чистая презентация —
 * весь view-model собирает серверный page.tsx из lib/parent-queries (Supabase,
 * всегда со studentId выбранного ребёнка) и передаёт пропсом `data`. Числа не
 * пересчитываются здесь и не выдумываются; мок остался только там, где нет
 * бэкенда вовсе (кошелёк / «К оплате» / «Питание» — см. page.tsx).
 *
 * НАВИГАЦИЯ: карточки кликабельные (next/link, prefetch по умолчанию).
 * Шапка (RootHeader) принимает колбэки, а не ссылки, поэтому колокольчик и
 * аватар ведут через router.push с ручным router.prefetch на маунте.
 *
 * UI-компоненты мобилки (MetricsSplitRow, AccentCard, AccentInset, StatusChip,
 * ListRow, SectionHeader, QuickActionTile/Grid, Avatar) перенесены сюда
 * локально с их точными радиусами/паддингами/цветами; общее стекло и токены
 * берутся из ../v2/GlassCard и ../v2/tokens — вторых копий не заводим.
 *
 * Только светлая тема.
 */
import { useEffect, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useDates } from "../_ui/dates";
import { GlassCard } from "../v2/GlassCard";
import { RootHeader } from "../v2/RootHeader";
import { CHEVRON, DIVIDER, SECTION_CAP } from "../_ui/screen-tokens";
import {
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

/* ─── Контракт данных (заполняется серверным page.tsx) ────────────────────── */

export type Gradient = [string, string];

/** Срок задания: что показать в чипе. Сама подпись («Срок 3 августа»)
 *  собирается здесь, в клиенте, потому что зависит от языка. */
export type HomeDue =
  | { kind: "none" }
  | { kind: "overdue" }
  | { kind: "today" }
  | { kind: "day"; dateKey: string };

export type HomeBadge =
  | { kind: "grade"; value: number }
  /** Готовая подпись, не зависящая от даты («Сдано»). */
  | { kind: "chip"; label: string; tone: StatusKey }
  /** Срок задания: подпись собирается на языке экрана. */
  | { kind: "due"; due: HomeDue; tone: StatusKey };

export interface HomeFeedRow {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Плитка 36×36: либо текстовый глиф предмета («√x»), либо иконка «питание». */
  icon: { gradient: Gradient; glyph: string | null };
  badge: HomeBadge;
}

export interface HomeViewData {
  parent: { firstName: string; initials: string };
  bellCount: number;
  /** null — у родителя нет привязанного ребёнка (пустое состояние). */
  child: { fullName: string; initial: string; className: string; gradient: Gradient } | null;
  /** true — child===null потому что запрос к БД реально упал (см.
   *  lib/parent-context.ts hadError), а не потому что ребёнок правда не
   *  привязан. Разные тексты пустого состояния, см. T.loadError. */
  childLoadError?: boolean;
  greeting: { title: string; subtitle: string };
  statusChip: { label: string; tone: StatusKey } | null;
  metrics: {
    /** ISO момента отметки или null — время подписывается на языке экрана. */
    atSchoolSince: string | null;
    lessonsTotal: string;
    attended: string;
    homework: string;
    walletLabel: string;
  };
  nextLesson: {
    subjectName: string;
    /** Ключ дня и ISO начала — подпись «завтра · 10:20» собирает клиент. */
    dateKey: string;
    startsAt: string;
    /** Хвост подписи после дня и времени: кабинет, учитель. */
    metaTail: string[];
    glyph: string;
    gradient: Gradient;
  } | null;
  /** Мок: платёжного бэкенда нет (см. page.tsx). */
  /** Что показывать в плитке «К оплате»: числа, «долгов нет» или отказ.
   *  Фразы живут здесь, потому что словарь есть только у клиента. */
  dueState: "ok" | "none" | "failed";
  due: { amountLabel: string; subtitle: string };
  /** Мок: сервиса питания нет (см. page.tsx). */
  meals: { statusLabel: string; untilLabel: string };
  assistantText: string;
  feed: HomeFeedRow[];
  /** «Сегодня» школы, YYYY-MM-DD — опора для «завтра» и сроков заданий. */
  today: string;
}

/* ─── Маршруты (создаются соседними экранами родителя) ────────────────────── */

const R = {
  notifications: "/parent/notifications",
  day: "/parent/day",
  schedule: "/parent/schedule",
  payments: "/parent/payments",
  meals: "/parent/meals",
  homework: "/parent/homework",
  services: "/parent/services",
  child: "/parent/child",
  profile: "/parent/profile",
  progress: "/parent/progress",
  messages: "/parent/messages",
  /* 12.08.2026 — экран разбора помощника. Карточка ниже показывает короткую
     сводку из чисел; за подробным разбором ведёт первая кнопка. */
  assistant: "/parent/assistant",
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Локальные константы, которых нет в v2/tokens.ts: в мобилке это приватные
 * константы соответствующих ui-компонентов (значения светлой темы, дословно).
 *
 * ТЁМНАЯ ТЕМА. Раньше здесь лежали ещё пять тёмно-чернильных литералов
 * (разделитель ListRow, разделители MetricsSplitRow, caps-лейбл метрики,
 * заголовок секции и шеврон) — в тёмной теме они оставались тёмными на тёмном
 * стекле. Теперь всё это берётся из общих производных `_ui/screen-tokens.ts`:
 * DIVIDER / SECTION_CAP / CHEVRON. Разделители метрик были .08 против .07 у
 * DIVIDER — разница на глаз неразличима, второй токен ради неё не заводим.
 *
 * Оставшиеся ниже белые константы — блик, фон и рамка ПОВЕРХ непрозрачной
 * цветной плитки. Они белые в обеих темах (это WHITE, а не «цвет текста»),
 * поэтому не темизируются.
 * ────────────────────────────────────────────────────────────────────────── */

/** AccentCard: внутренний блик inset 0 1.5 0 W35 (макет строка 242). */
const ACCENT_INSET_SHADOW = "inset 0 1.5px 0 rgba(255,255,255,0.35)";
/** AccentInset: стекло внутри непрозрачной градиентной карточки (строка 2741). */
const ACCENT_INSET_BG = "rgba(255,255,255,0.2)";
const ACCENT_INSET_BORDER = "rgba(255,255,255,0.35)";
/** StatusChip variant="new" (макет строка 2715). */
const NEW_GRAD: Gradient = ["#8B5CF6", "#6366F1"];
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
  pay: "Оплатить", // home.pay
  hwShort: "Дом. задания", // home.hwShort
  services: "Все сервисы", // scr.services
  childProfile: "Профиль ребёнка", // scr.childProfile
  schedule: "Расписание", // scr.schedule
  /** Пустые состояния — своих ключей в словаре нет, литералы ru. */
  noChild: "К аккаунту не привязан ни один ребёнок",
  noChildHint: "Обратитесь в администрацию школы — она свяжет профиль ученика с вашим аккаунтом.",
  /** Отличается от noChild: сервер реально не смог прочитать данные (см.
   *  getParentContext().hadError), а не «ребёнка правда нет». Раньше оба
   *  случая показывали ОДИН И ТОТ ЖЕ текст noChild — сбой был неотличим от
   *  честного «не привязан» ни на скриншоте, ни для пользователя. */
  loadError: "Не удалось загрузить данные",
  loadErrorHint: "Проверьте соединение и обновите страницу. Если это повторится — напишите в поддержку школы.",
  noNextLesson: "Ближайших уроков нет",
  noNextLessonHint: "Как только появится расписание, урок покажется здесь",
  emptyFeed: "Сегодня событий пока нет",
  emptyFeedHint: "Оценки, посещаемость и домашние задания появятся здесь в течение дня",
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

/**
 * Цвет обводки идёт через `style`, а НЕ через presentation-атрибут `stroke=`:
 * сюда приходят токены (CHEVRON, status[*].text), а это уже не цвета, а
 * var(--p-*), и в SVG-атрибутах браузер var() не разрешает — глиф остался бы
 * бесцветным в обеих темах. Геометрия (strokeWidth, linecap) — по-прежнему
 * атрибуты.
 */
function ChevronRight({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
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
  gradient: Gradient;
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
 * + верхний блик inset 0 1.5 0 W35. `href` превращает её в next/link —
 * в мобилке это был Pressable с навигацией.
 */
function AccentCard({
  gradient,
  angle = 135,
  shadowRgb,
  radius: r = 18,
  href,
  className = "",
  style,
  contentStyle,
  children,
}: {
  gradient: Gradient;
  angle?: number;
  shadowRgb?: string;
  radius?: number;
  href?: string;
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

  if (href) {
    return (
      <Link
        href={href}
        className={`block w-full text-left transition-transform active:scale-[0.99] ${className}`}
        style={surface}
      >
        {inner}
      </Link>
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

/** ListRow (макет §s7 строка 2771 + строки 266–268): padding 10 0, gap 11. */
function ListRow({
  href,
  left,
  title,
  subtitle,
  right,
  divider = false,
}: {
  href: string;
  left: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  divider?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center text-left"
      style={{
        gap: 11,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
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
    </Link>
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
        borderTop: topDivider ? `1px solid ${DIVIDER}` : undefined,
      }}
    >
      {cells.map((cell, i) => (
        <div key={cell.label} className="flex min-w-0" style={{ gap: 6, flex: `${cell.flex ?? 1} 1 0%` }}>
          {i > 0 ? <div style={{ width: 1, background: DIVIDER }} /> : null}
          <div className="flex min-w-0 flex-1 flex-col items-center" style={{ gap: 1 }}>
            <span
              className="w-full truncate text-center"
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: 0.4, // .05em при 8px
                textTransform: "uppercase",
                color: SECTION_CAP,
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
  href,
  gradient,
  shadowRgb,
  iconPaths,
}: {
  label: string;
  href: string;
  gradient: Gradient;
  shadowRgb: string;
  iconPaths: readonly string[];
}) {
  return (
    <Link
      href={href}
      className="flex h-full w-full flex-col items-center justify-center transition-transform active:scale-[0.97]"
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
    </Link>
  );
}

/** Плитка 46×46 grad-glass с глифом-строкой («√x») — макет строка 244. */
function AccentGlyphTile({ gradient, glyph, size = 46 }: { gradient: Gradient; glyph: string; size?: number }) {
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
  const st = value >= 4 ? status.green : value >= 3 ? status.orange : status.red;
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
function FeedIconTile({ gradient, glyph }: { gradient: Gradient; glyph: string | null }) {
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
      {glyph ?? <WhiteGlyph paths={ICONS.check} size={17} />}
    </span>
  );
}

/** CTA-glass кнопка акцентной карточки ассистента: 50/50, minHeight 36. */
function AssistantCta({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
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
    </Link>
  );
}

/** Пустое состояние внутри стеклянной карточки (не «в разработке» — просто нет данных). */
function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 4, padding: "22px 16px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>{title}</span>
      {hint ? <span style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>{hint}</span> : null}
    </div>
  );
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export function HomeView({ data }: { data: HomeViewData }) {
  const router = useRouter();
  const dt = useDates();
  const { locale } = useLocale();
  const dict = getDictionary(locale);
  const { parent, child, childLoadError } = data;

  /** Подпись чипа срока. Слова берутся из уже существующих ключей словаря
   *  (`parentUi.dueDate`, `status.overdue`, `parentMobile.hwDetailNoDeadline`),
   *  дата — из `dt`; своих русских литералов здесь не остаётся. */
  const dueLabel = (due: HomeDue): string => {
    switch (due.kind) {
      case "overdue":
        return dict.status.overdue;
      case "today":
        return dict.parentUi.dueDate.replace("{date}", dt.words.today.toLowerCase());
      case "day":
        return dict.parentUi.dueDate.replace(
          "{date}",
          dt.relativeDay(due.dateKey, data.today) ?? dt.dayMonth(due.dateKey),
        );
      default:
        return dict.parentMobile.hwDetailNoDeadline;
    }
  };

  // RootHeader принимает колбэки, а не href — prefetch делаем руками, чтобы
  // переход был таким же мгновенным, как по next/link.
  useEffect(() => {
    router.prefetch(R.notifications);
    router.prefetch(R.profile);
  }, [router]);

  // 5 колонок метрики-сплит (макет 230–240).
  const metricCells: MetricCell[] = [
    { label: T.atSchoolSince, value: data.metrics.atSchoolSince ? dt.time(data.metrics.atSchoolSince) : "—" },
    { label: T.lessons, value: data.metrics.lessonsTotal },
    { label: T.attended, value: data.metrics.attended, valueColor: status.green.text },
    { label: T.hw, value: data.metrics.homework, valueColor: status.orange.text },
    { label: T.wallet, value: data.metrics.walletLabel, flex: 1.4 },
  ];

  // Быстрые действия (макет 256–263). Иконки из ICONS + inline paths.
  const QUICKS: { label: string; href: string; gradient: Gradient; iconPaths: readonly string[]; shadowRgb: string }[] = [
    { label: T.pay, href: R.payments, gradient: ["#fb923c", "#ef4444"], iconPaths: ICONS.card, shadowRgb: "251,146,60" },
    { label: T.hwShort, href: R.homework, gradient: ["#60a5fa", "#2563eb"], iconPaths: ICONS.check, shadowRgb: "96,165,250" },
    { label: T.services, href: R.services, gradient: ["#a78bfa", "#7c3aed"], iconPaths: ICONS.grid, shadowRgb: "167,139,250" },
    { label: T.meals, href: R.meals, gradient: ["#f472b6", "#db2777"], iconPaths: ICONS.food, shadowRgb: "244,114,182" },
    { label: T.childProfile, href: R.child, gradient: ["#34d399", "#059669"], iconPaths: ICONS.user, shadowRgb: "52,211,153" },
    { label: T.schedule, href: R.schedule, gradient: ["#22d3ee", "#0891b2"], iconPaths: ICONS.cal, shadowRgb: "34,211,238" },
  ];

  return (
    <>
      {/* Шапка (220–225): лого + «SNR EduOS» 14/600, колокольчик с бейджем,
          аватар родителя. Общий компонент каркаса v2 — своей копии не заводим. */}
      <RootHeader
        title="SNR EduOS"
        titleSize={14}
        showLogo
        bellBadge={data.bellCount}
        initials={parent.initials}
        onBell={() => router.push(R.notifications)}
        onAvatar={() => router.push(R.profile)}
      />

      <div
        className="mx-auto flex w-full max-w-[430px] flex-col"
        style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8, gap: 12 }}
      >
        {/* Приветствие (227) — по имени РОДИТЕЛЯ. */}
        <div className="flex flex-col" style={{ gap: 4 }}>
          <h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 20, color: ink1 }}>{data.greeting.title}</h1>
          <p style={{ fontSize: 12, fontWeight: 600, color: ink2 }}>{data.greeting.subtitle}</p>
        </div>

        {child ? (
          <>
            {/* ChildSwitcherCard large + MetricsSplitRow (228–241).
                Внутри две разные цели, поэтому карточка — контейнер, а
                кликабельны её части (иначе получилась бы ссылка в ссылке). */}
            <GlassCard radius={22}>
              <div className="flex flex-col" style={{ padding: "12px 14px", gap: 10 }}>
                <div className="flex items-center" style={{ gap: 11 }}>
                  <Link href={R.child} className="flex min-w-0 flex-1 items-center" style={{ gap: 11 }}>
                    {/* Кольца аватара выступают наружу — компенсируем зазором. */}
                    <span className="block shrink-0" style={{ margin: 2 }}>
                      <Avatar initials={child.initial} gradient={child.gradient} size={50} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 800, color: ink1 }}>
                        {child.fullName}
                      </span>
                      <span className="flex items-center" style={{ gap: 4 }}>
                        <span className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink2 }}>
                          {/* className из parent-context — это имя группы, и оно
                              обычно УЖЕ содержит слово «класс» («10-А класс»).
                              Без этой проверки выводилось «10-А класс класс». */}
                          {child.className
                            ? (/класс/i.test(child.className) ? child.className : `${child.className} ${T.class}`)
                            : "—"}
                        </span>
                      </span>
                    </span>
                  </Link>

                  {/* Статус-чип «В школе» → «Статус дня». */}
                  {data.statusChip ? (
                    <Link
                      href={R.day}
                      className="inline-flex shrink-0 items-center"
                      style={{
                        gap: 5,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: chip(status[data.statusChip.tone].rgb).background,
                        border: `1px solid ${chip(status[data.statusChip.tone].rgb).borderColor}`,
                        boxShadow: `0 4px 10px rgba(${status[data.statusChip.tone].rgb},0.18)`,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: `rgb(${status[data.statusChip.tone].rgb})`,
                        }}
                      />
                      <span style={{ fontSize: 10, fontWeight: 800, color: status[data.statusChip.tone].text }}>
                        {data.statusChip.label}
                      </span>
                      <ChevronRight size={10} color={status[data.statusChip.tone].text} strokeWidth={2.6} />
                    </Link>
                  ) : null}
                  <ChevronRight size={15} color={CHEVRON} strokeWidth={2.2} />
                </div>
                <MetricsSplitRow cells={metricCells} topDivider />
              </div>
            </GlassCard>

            {/* AccentCard «Следующий урок» (242–245) → расписание. */}
            {data.nextLesson ? (
              <AccentCard
                gradient={data.nextLesson.gradient}
                angle={135}
                shadowRgb="99,102,241"
                radius={20}
                href={R.schedule}
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
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#FFFFFF" }}>
                    {data.nextLesson.subjectName}
                  </span>
                  {/* «завтра · 10:20 · каб. 101 · Учитель» — день и время
                      подписываются здесь, на языке экрана. */}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                    {[
                      dt.relativeDay(data.nextLesson.dateKey, data.today),
                      dt.time(data.nextLesson.startsAt),
                      ...data.nextLesson.metaTail,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <AccentGlyphTile gradient={data.nextLesson.gradient} glyph={data.nextLesson.glyph} />
              </AccentCard>
            ) : (
              <GlassCard radius={20}>
                <EmptyBlock title={T.noNextLesson} hint={T.noNextLessonHint} />
              </GlassCard>
            )}

            {/* Ряд «К оплате / Питание» (246–249). Оба значения — мок (нет бэкенда). */}
            <div className="flex" style={{ gap: 10 }}>
              <AccentCard
                gradient={["#fb7185", "#e11d48"]}
                shadowRgb="244,63,94"
                radius={18}
                href={R.payments}
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
                <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>
                  {data.dueState === "ok" ? data.due.amountLabel
                    : data.dueState === "none" ? dict.parentApp.pay2.noDebt
                    : "—"}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  {data.dueState === "ok" ? data.due.subtitle
                    : data.dueState === "failed" ? dict.parentApp.pay2.loadFailed
                    : ""}
                </span>
              </AccentCard>
              <AccentCard
                gradient={["#34d399", "#059669"]}
                shadowRgb="52,211,153"
                radius={18}
                href={R.meals}
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
                <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>{data.meals.statusLabel}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  {data.meals.untilLabel}
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
                {data.assistantText}
              </p>
              <div className="flex items-stretch" style={{ gap: 8 }}>
                <AssistantCta label={dict.parentApp.common.more} href={R.assistant} />
                <AssistantCta label={T.viewProgress} href={R.progress} />
              </div>
            </AccentCard>

            {/* Быстрые действия (255–263). */}
            <SectionHeader title={T.quickActions} />
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
              {QUICKS.map((q) => (
                <QuickActionTile
                  key={q.label}
                  label={q.label}
                  href={q.href}
                  gradient={q.gradient}
                  shadowRgb={q.shadowRgb}
                  iconPaths={q.iconPaths}
                />
              ))}
            </div>

            {/* Лента «Сегодня» (264–269). */}
            <SectionHeader title={dt.words.today} linkLabel={`${T.viewAll} ›`} linkHref={R.day} />
            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {data.feed.length === 0 ? (
                <EmptyBlock title={T.emptyFeed} hint={T.emptyFeedHint} />
              ) : (
                data.feed.map((row, idx) => (
                  <ListRow
                    key={row.id}
                    href={row.href}
                    left={<FeedIconTile gradient={row.icon.gradient} glyph={row.icon.glyph} />}
                    title={row.title}
                    subtitle={row.subtitle}
                    right={
                      row.badge.kind === "grade" ? (
                        <GradeBadge value={row.badge.value} />
                      ) : (
                        <StatusChip
                          label={row.badge.kind === "due" ? dueLabel(row.badge.due) : row.badge.label}
                          family={row.badge.tone}
                        />
                      )
                    }
                    divider={idx > 0}
                  />
                ))
              )}
            </GlassCard>
          </>
        ) : (
          <GlassCard radius={22}>
            <EmptyBlock
              title={childLoadError ? T.loadError : T.noChild}
              hint={childLoadError ? T.loadErrorHint : T.noChildHint}
            />
          </GlassCard>
        )}
      </div>
    </>
  );
}
