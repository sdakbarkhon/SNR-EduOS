"use client";

/**
 * Экран П17 «Оплаты» — веб-перенос 1:1 из мобильного
 * apps/mobile-parent/src/screens/tabs/PaymentsScreen.tsx (ветка
 * `feat/mobile-parent-redesign`), который сам перенесён дословно из
 * утверждённого макета «SNR EduOS v2 Light.dc.html» (строки 376–411).
 *
 * Композиция сверху вниз (как в RN):
 *  1. RootHeader без лого — заголовок «Оплаты», bell (badge 3), аватар.
 *  2. AccentCard баланса — трёхстопный градиент ec4899→f97316→4f86f6; левая
 *     колонка (ОБЩИЙ БАЛАНС, число, «Доступно для расходов»), справа
 *     wallet-иконка 42×42 на glass-квадрате; внизу два AccentInset sub-tile:
 *     «К ОПЛАТЕ» / «ПЕРЕПЛАТА».
 *  3. Section «К оплате сейчас» + chip «2 счёта» (orange) + «Смотреть все ›».
 *  4. GlassCard с двумя ListRow счетов (BILLS.in_main_list).
 *  5. PrimaryButton «Оплатить всё — {sum}» — ПОГАШЕНА, см. ниже.
 *  6. QuickActionsGrid 4 колонки: Пополнить / История оплат / Счета и чеки /
 *     Способы оплаты.
 *  7. AccentCard «Кошелёк {gen}».
 *
 * 27.08.2026 — ЭКРАН ОБЕЩАЛ ТО, ЧЕГО НЕТ.
 *
 * Убрана строка «Автоплатёж · 1-го числа · Uzcard ····8341» с рабочим
 * переключателем. Автоплатежа в утверждённой модели нет вовсе: счёт
 * выставляется 1 числа и гасится с баланса ребёнка, привязанных карт и
 * автосписания не предусмотрено. Карты «····8341» тоже не существует —
 * приложение не хранит ни одной. Переключатель к тому же ничего не сохранял.
 * Убрано целиком, а не спрятано за условием.
 *
 * «Оплатить всё» больше не выглядит рабочей кнопкой: платить нечем, пока нет
 * провайдера. Она приглушена, помечена «Скоро» и не нажимается, а объяснение
 * стоит под ней постоянно, а не раскрывается по щелчку — раскрыть его никто
 * не догадается, а кнопка тем временем выглядит боевой.
 *
 * Сверху добавлена та же плашка «данных нет, это пример», что давно стоит в
 * мобильном экране: суммы на этом экране — из заготовки, а не из базы, и об
 * этом надо говорить прямо. Два экрана обязаны говорить одно и то же.
 *
 * 27.08.2026, ЗАХОД 4 ПО ПЛАТЕЖАМ — ЭКРАН ПЕРЕВЕДЁН НА НАСТОЯЩИЕ ДАННЫЕ.
 *
 * Баланс, счета, долг и переплата приходят пропсами со страницы, а она берёт
 * их из `students.balance` и `tuition_invoices` (миграции 227/229). Раньше
 * тут стояли заготовки: «ОБЩИЙ БАЛАНС 1 250 000», два выдуманных счёта и долг
 * 4 950 000 — числа, которых нет ни в одной таблице. Плашка «данных нет, это
 * пример» ушла отсюда вместе с ними.
 *
 * Что осталось заготовкой и почему: карточка КОШЕЛЬКА на питание внизу. Под
 * школьный кошелёк в схеме нет ни одной таблицы — ни баланса, ни операций.
 * Поэтому карточка помечена отдельной строкой прямо под собой, а её экраны
 * держат свои плашки.
 *
 * Данные ребёнка и шапка — по-прежнему через ../v2/data
 * (getSelectedChildContext, getUnreadNotificationsCount, getParent).
 *
 * Платформенные отличия от RN (осознанные):
 *  * RN-компоненты UI-кита (AccentCard/AccentInset/ListRow/
 *    PrimaryButton/QuickActionTile/RootHeader) в вебе ещё не выделены в
 *    общий слой — они воспроизведены локально в этом файле с теми же
 *    размерами/радиусами/тенями (см. src/ui/* на ветке мобилки);
 *  * иконки — инлайновый <svg> с ДОСЛОВНЫМИ path'ами ICONS макета
 *    (navigation/routes.ts), а не lucide: пути известны точно, замена
 *    ближайшей иконкой ухудшила бы совпадение;
 *  * навигация: четыре плитки быстрых действий и «Смотреть все» ведут на
 *    подроуты /parent/payments/{top-up,history,invoices,methods} — веб-порты
 *    RN-экранов dtop/d20/d21/d33. Кликабельным здесь обязано быть ВСЁ, что
 *    выглядит кликабельным: bell → /parent/notifications, аватар →
 *    /parent/profile, строки счетов (у них шеврон) → /parent/payments/invoices,
 *    карточка кошелька (тоже с шевроном) → /parent/payments/top-up. Экраны
 *    деталей счёта и кошелька (d19/d22) в веб не портированы, поэтому шеврон
 *    ведёт на ближайший реальный экран той же сущности, а не в никуда;
 *  * «Оплатить всё» упирается в отсутствующего платёжного провайдера, поэтому
 *    показана неактивной с меткой «Скоро» — тот же приём, что в PayMethodsView;
 *  * только светлая тема (токены ../v2/tokens.ts).
 */

import { type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { CHEVRON, DIVIDER, SECTION_CAP } from "../_ui/screen-tokens";
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
} from "../v2/tokens";
import { getParent, getSelectedChildContext, getUnreadNotificationsCount } from "../v2/data";
import { useDates } from "../_ui/dates";
import type { ChildInvoice } from "@/lib/parent-queries";
import {
  SOON_PAYMENTS,
  givenNameOf,
  rowNote,
  walletTitleOf,
  whoLabel,
} from "../_demo/demo-data";
import { SoonNote } from "./parts";

/* ===== Тексты (ru, дословно из словаря мобилки packages/core/src/i18n/ru.ts,
 *       ветка feat/mobile-parent-redesign: parentApp.nav / .pay / .scr / .common) ===== */

const T = {
  navPayments: "Оплаты",
  balanceTotalCap: "ОБЩИЙ БАЛАНС",
  sum: "сум",
  balanceAvailable: "Доступно для расходов",
  balanceDueCap: "К ОПЛАТЕ",
  balanceOverpaidCap: "ПЕРЕПЛАТА",
  dueNow: "К оплате сейчас",
  billsChip: "{n} счёта",
  viewAll: "Смотреть все",
  billDueBy: "до {date}",
  payAllBtn: "Оплатить всё — {sum}",
  topupBtn: "Пополнить",
  payHistory: "История оплат",
  billsReceipts: "Счета",
  payMethods: "Способы оплаты",
  // walletTitle («Кошелёк {gen}») здесь больше нет: заголовок кошелька строит
  // общий walletTitleOf() из mock-data — им же пользуется /parent/payments/top-up,
  // иначе два экрана называли бы один кошелёк по-разному.
  walletSub: "На питание и покупки в школе",
} as const;

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/* ===== Форматирование сумм — дословная копия
 *       apps/mobile-parent/src/utils/format.ts (разделитель — NBSP U+00A0). ===== */

const NBSP = " ";

function formatMoney(n: number, opts: { withCurrency?: boolean; currency?: string } = {}): string {
  const abs = Math.abs(Math.round(n));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const signed = n < 0 ? "-" + grouped : grouped;
  return opts.withCurrency ? signed + NBSP + (opts.currency ?? "сум") : signed;
}

/* ===== SVG-глифы: path'ы ICONS макета (navigation/routes.ts, дословно) ===== */

const ICON = {
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  wallet: ["M20 12V8H6a2 2 0 0 1 0-4h12v4", "M4 6v12a2 2 0 0 0 2 2h14v-6", "M18 12a2 2 0 0 0 0 4h4v-4Z"],
  card: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
  plus: ["M12 5v14", "M5 12h14"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
} as const;

/** Иконка-глиф (белая) — RN WhiteGlyph: stroke #fff, strokeWidth 1.8. */
function WhiteGlyph({ paths, size = 20 }: { paths: readonly string[]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Шеврон › ListRow: 14px, stroke CHEVRON, strokeWidth 2.2.
 *
 *  Цвет задаётся через `style`, а не presentation-атрибутом `stroke=`: сюда
 *  приходит токен CHEVRON, то есть var(--p-chevron, …), а var() в SVG-атрибутах
 *  браузер не разрешает — шеврон остался бы бесцветным в обеих темах.
 *  Геометрия (strokeWidth, linecap) остаётся атрибутами. */
function Chevron({ color, size = 14, width = 2.2 }: { color: string; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="m9 18 6-6-6-6"
        style={{ stroke: color }}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ===== Локальные копии компонентов UI-кита мобилки ===== */

/** AccentCard: непрозрачный градиент 135°, цветная тень shColor, inset-блик W35. */
function AccentCard({
  gradient,
  angle = 135,
  shadowRgb,
  radius: r = 18,
  contentClassName,
  contentStyle,
  children,
}: {
  gradient: string[];
  angle?: number;
  shadowRgb?: string;
  radius?: number;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div style={{ borderRadius: r, boxShadow: shadowRgb ? shColor(shadowRgb) : undefined }}>
      <div
        className={`relative overflow-hidden ${contentClassName ?? ""}`}
        style={{
          borderRadius: r,
          background: `linear-gradient(${angle}deg, ${gradient.join(", ")})`,
          ...contentStyle,
        }}
      >
        {/* Внутренний блик inset W35 → верхняя hairline-полоска (строка 242 макета). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
        />
        {children}
      </div>
    </div>
  );
}

/** AccentInset: стеклянная вставка внутри акцентной карточки (W20 + blur 8 + border W35). */
function AccentInset({
  radius: r = 12,
  className,
  style,
  children,
}: {
  radius?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: r,
        border: "1px solid rgba(255,255,255,0.35)",
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** ListRow: строка 52–60px — title 12.5/800 ink1, sub 10.5/600 ink2, шеврон 14.
 *
 *  `href` превращает строку в ссылку. Шеврон без href рисовать нельзя: он
 *  обещает переход, и строка-заглушка с ним читается как сломанная кнопка. */
function ListRow({
  left,
  title,
  subtitle,
  right,
  href,
  chevron = false,
  divider = false,
  verticalPadding = 10,
  gap = 11,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  href?: string;
  chevron?: boolean;
  divider?: boolean;
  verticalPadding?: number;
  gap?: number;
}) {
  const style: CSSProperties = {
    gap,
    paddingTop: verticalPadding,
    paddingBottom: verticalPadding,
    borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
  };
  const inner = (
    <>
      {left}
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
          {title}
        </p>
        {subtitle ? (
          <p className="truncate" style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {right}
      {chevron ? <Chevron color={CHEVRON} /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center" style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex items-center" style={style}>
      {inner}
    </div>
  );
}

/** PrimaryButton: accent-градиент, r16, padding 15, gap 8, текст 14/800, тень 0 14 32.
 *
 *  27.08.2026 добавлен неактивный вид (inactive): та же форма, но приглушённая,
 *  без тени, без нажатия и с меткой «Скоро». Это не <button> вовсе — нажимать
 *  нечего, пока нет платёжного провайдера, и «кнопка, которая ничего не
 *  делает» здесь и была болезнью экрана. Тот же приём, что на экране способов
 *  оплаты (PayMethodsView). */
function PrimaryButton({
  label,
  icon,
  inactive,
  soonLabel,
}: {
  label: string;
  icon?: ReactNode;
  inactive?: boolean;
  soonLabel?: string;
}) {
  const Tag = inactive ? "div" : "button";
  return (
    <Tag
      {...(inactive ? {} : { type: "button" as const })}
      aria-disabled={inactive ? true : undefined}
      className={
        "relative flex w-full items-center justify-center overflow-hidden" +
        (inactive ? "" : " transition-transform active:scale-[0.99]")
      }
      style={{
        gap: 8,
        padding: 15,
        borderRadius: 16,
        background: accentGrad,
        boxShadow: inactive ? undefined : "0 14px 32px rgba(124,58,237,0.4)",
        opacity: inactive ? 0.55 : 1,
      }}
    >
      {icon}
      <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>{label}</span>
      {inactive && soonLabel ? (
        <span
          style={{
            padding: "3px 9px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.22)",
            fontSize: 9.5,
            fontWeight: 800,
            color: "#FFFFFF",
          }}
        >
          {soonLabel}
        </span>
      ) : null}
      {/* inset-блик W35 → верхняя hairline-полоска (макет строка 397). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
      />
    </Tag>
  );
}

/** QuickActionTile size="sm" (грид 4 колонки, П17): r16, pad 10×4, gap 5, плитка 34 r11, подпись 9/700.
 *
 *  В мобилке плитка — Pressable с navigate(dtop/d20/d21/d33). В вебе это
 *  обычная ссылка на соответствующий подроут /parent/payments/*: экран может
 *  быть открыт по прямому URL, и Link даёт и предзагрузку, и рабочее
 *  «открыть в новой вкладке». Раньше здесь был <button> без обработчика —
 *  четыре кнопки не вели никуда. */
function QuickActionTile({
  label,
  href,
  icon,
  gradient,
  shadowRgb,
}: {
  label: string;
  href: string;
  icon: ReactNode;
  gradient: [string, string];
  shadowRgb?: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden transition-transform active:scale-[0.97]"
      style={{
        gap: 5,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 4,
        paddingRight: 4,
        borderRadius: 16,
        background: glass1.background,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${glassBorder}`,
        boxShadow: `0 10px 22px rgba(99,86,214,0.12), ${glassInset}`,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          boxShadow: shadowRgb ? `0 7px 16px rgba(${shadowRgb},0.3)` : undefined,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 9, fontWeight: 700, color: ink1, textAlign: "center", lineHeight: 1.25 }}>
        {label}
      </span>
    </Link>
  );
}

/** Плитка-иконка счёта — 38×38 (или size) r13, градиент 135°, белый глиф (size − 20). */
function BillIconTile({
  gradient,
  paths,
  size = 38,
  radius: r = 13,
}: {
  gradient: [string, string];
  paths: readonly string[];
  size?: number;
  radius?: number;
}) {
  const glyph = size - 20;
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** Шапка корневого экрана (RootHeader без лого): заголовок 17 Unbounded, bell 38 + badge, аватар 38.
 *
 *  bell и аватар — ССЫЛКИ, а не декорации: на /parent/home и /parent/progress
 *  та же шапка ведёт на уведомления и профиль, и молчащая копия здесь читалась
 *  бы как поломка. */
function RootHeader({
  title,
  bellCount,
  bellHref,
  avatar,
  avatarHref,
}: {
  title: string;
  bellCount?: number;
  bellHref: string;
  avatar: { initials: string; gradient: [string, string] };
  avatarHref: string;
}) {
  return (
    <header
      className="flex items-center"
      style={{ gap: 10, paddingTop: 46, paddingLeft: 18, paddingRight: 18, paddingBottom: 8 }}
    >
      <h1 style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, color: ink1 }}>{title}</h1>
      <div className="flex-1" />
      <div className="relative">
        {/* Круглая стеклянная кнопка 38 (glass-1 160°, blur 18, border W78). */}
        <Link
          href={bellHref}
          aria-label="Уведомления"
          className="flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: glass1.background,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: `1px solid ${glassBorder}`,
          }}
        >
          {/* Цвет глифа — через style: ink1 это var(--p-ink1, …), а var() в
              SVG-атрибуте stroke= браузер не разрешит и колокольчик станет
              бесцветным в обеих темах. */}
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            style={{ stroke: ink1 }}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {ICON.bell.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
        </Link>
        {bellCount ? (
          // CountBadge preset 'alert': 17 r9, top −3 right −3 (макет строка 223).
          // pointer-events-none: бейдж лежит поверх ссылки-колокольчика и не
          // должен съедать клик по её углу.
          <span
            className="pointer-events-none absolute flex items-center justify-center"
            style={{
              top: -3,
              right: -3,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              paddingInline: 4,
              background: "linear-gradient(135deg, #F43F5E, #EF4444)",
              boxShadow: "0 4px 10px rgba(244,63,94,0.4)",
              fontSize: 9.5,
              fontWeight: 800,
              color: "#FFFFFF",
            }}
          >
            {bellCount}
          </span>
        ) : null}
      </div>
      {/* Avatar 38, variant ring (белое кольцо 2px), инициалы 12/800. */}
      <Link
        href={avatarHref}
        aria-label="Профиль"
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          background: `linear-gradient(135deg, ${avatar.gradient[0]}, ${avatar.gradient[1]})`,
          boxShadow: "0 0 0 2px #FFFFFF",
          fontSize: 12,
          fontWeight: 800,
          color: "#FFFFFF",
        }}
      >
        {avatar.initials}
      </Link>
    </header>
  );
}

/* ===== Экран ===== */

/** Caps-подписи акцентной карточки: 9/800, letter-spacing 5%, W85. */
const capsLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.05 * 9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.85)",
};

export function PaymentsView({
  childName,
  childClassName,
  summary,
  invoices,
}: {
  /** Реальный ребёнок с сервера (см. page.tsx). */
  childName: string | null;
  childClassName: string | null;
  /** Баланс и долг — из базы. `failed` значит «прочитать не удалось», и это
   *  НЕ то же самое, что «ноль»: экран обязан сказать разное. */
  summary: { balance: number; dueTotal: number; dueCount: number; overpayment: number; failed: boolean };
  /** Открытые счета ребёнка, новые сверху. */
  invoices: ChildInvoice[];
}) {
  // Кошелёк на питание — единственное, что здесь осталось заготовкой:
  // таблицы под него в схеме нет вовсе.
  const { wallet_balance } = getSelectedChildContext();
  // Имя и заголовок кошелька — через общие хелперы mock-data: их же зовут
  // /parent/payments/top-up и /parent/payments/history. Раньше здесь имя
  // резалось «последним словом», а там — «вторым», и на ФИО из трёх слов
  // соседние экраны называли ребёнка по-разному.
  const givenName = givenNameOf(childName);
  const walletTitle = walletTitleOf(childName);
  // «Шерзод · 10-А» — префикс подписей строк счетов.
  const who = whoLabel(childName, childClassName);
  const parent = getParent();
  const unread = getUnreadNotificationsCount();
  const dueBills = invoices.filter((i) => i.status === "open");
  const dueTotal = summary.dueTotal;
  const dueCount = summary.dueCount;

  // Плашка «данных нет» и метка «Скоро» — из словаря: экран показывают
  // родителям на трёх языках, а остальные подписи здесь исторически русские
  // литералы (это отдельная задача, её здесь не решаем).
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dates = useDates();
  const p2 = d.parentApp.pay2;

  /** «Июль 2026» из первого числа месяца, YYYY-MM-DD. */
  const monthLabel = (periodMonth: string) => {
    const [y, m] = periodMonth.split("-");
    return dates.monthYear(Number(y), Number(m));
  };

  const orangeChip = chip(status.orange.rgb);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <RootHeader
        title={T.navPayments}
        bellCount={unread}
        bellHref="/parent/notifications"
        avatar={{ initials: parent.initials, gradient: parent.avatar_gradient }}
        avatarHref="/parent/profile"
      />

      <div
        className="flex flex-col"
        style={{ gap: 12, paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8 }}
      >
        {/* 1. Отказ чтения. Пустой экран и «не смогли прочитать» — разные
            вещи, и молчать про второе нельзя: человек решит, что долгов нет. */}
        {summary.failed && <SoonNote text={p2.loadFailed} />}

        {/* 2. Карточка баланса (три-стоп-градиент, макет 383–386). */}
        <AccentCard
          gradient={["#ec4899", "#f97316", "#4f86f6"]}
          angle={135}
          shadowRgb="236,72,153"
          radius={22}
          contentClassName="flex flex-col"
          contentStyle={{ padding: 16, gap: 12 }}
        >
          <div className="flex items-start" style={{ gap: 12 }}>
            <div className="min-w-0 flex-1">
              <span style={capsLabel}>{T.balanceTotalCap}</span>
              <div className="flex items-end" style={{ gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 600, color: "#fff" }}>
                  {formatMoney(summary.balance)}
                </span>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}
                >
                  {T.sum}
                </span>
              </div>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                {T.balanceAvailable}
              </p>
            </div>
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
            >
              <WhiteGlyph paths={ICON.wallet} size={22} />
            </span>
          </div>

          <div className="flex" style={{ gap: 8 }}>
            <AccentInset radius={12} className="flex flex-1 flex-col" style={{ padding: 10, gap: 3 }}>
              <span style={capsLabel}>{T.balanceDueCap}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {dueCount === 0 ? p2.noDebt : formatMoney(dueTotal, { withCurrency: true, currency: T.sum })}
              </span>
            </AccentInset>
            <AccentInset radius={12} className="flex flex-1 flex-col" style={{ padding: 10, gap: 3 }}>
              <span style={capsLabel}>{T.balanceOverpaidCap}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {formatMoney(summary.overpayment, { withCurrency: true, currency: T.sum })}
              </span>
            </AccentInset>
          </div>
        </AccentCard>

        {/* 3. Section «К оплате сейчас» + чип «N счёта» + «Смотреть все ›». */}
        <div className="flex items-center justify-between" style={{ gap: 8, marginTop: 6 }}>
          <div className="flex flex-1 items-center" style={{ gap: 8 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: 0.84,
                textTransform: "uppercase",
                color: SECTION_CAP,
              }}
            >
              {T.dueNow}
            </span>
            {/* Долгов нет — чипа нет. «0 счёта» это и неправда по смыслу, и
                просто безграмотно. */}
            {dueCount > 0 && (
              <span
                className="shrink-0"
                style={{
                  paddingTop: 3,
                  paddingBottom: 3,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderRadius: 999,
                  background: orangeChip.background,
                  border: `1px solid ${orangeChip.borderColor}`,
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: status.orange.text,
                }}
              >
                {fillTemplate(T.billsChip, { n: String(dueCount) })}
              </span>
            )}
          </div>
          {/* «Смотреть все» — тот же экран, что и плитка «Счета и чеки»
              (в мобилке это был d21). Раньше кнопка тоже вела в никуда. */}
          <Link
            href="/parent/payments/invoices"
            className="shrink-0"
            style={{ fontSize: 11.5, fontWeight: 800, color: status.violet.text }}
          >
            {T.viewAll} ›
          </Link>
        </div>

        {/* 4. Счета «К оплате сейчас» — настоящие. Пусто значит пусто: так и
            пишем словами, «0 сум» человек читает как поломку. */}
        <GlassCard style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 14, paddingRight: 14 }}>
          {dueBills.length === 0 ? (
            <div className="flex flex-col" style={{ gap: 4, paddingTop: 14, paddingBottom: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                {summary.failed ? p2.loadFailed : p2.billsEmpty}
              </span>
              {!summary.failed && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
                  {p2.invoicesEmptyHint}
                </span>
              )}
            </div>
          ) : (
            dueBills.map((bill, i) => (
              <ListRow
                key={bill.id}
                left={<BillIconTile gradient={["#a78bfa", "#7c3aed"]} paths={ICON.doc} />}
                title={`${p2.tuitionInvoice} · ${monthLabel(bill.period_month)}`}
                subtitle={
                  bill.amount_source === "admin_adjusted"
                    ? rowNote(who, p2.adjustedByAdmin)
                    : who
                }
                right={
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                    {formatMoney(bill.amount)}
                  </span>
                }
                // Шеврон обещает переход — значит переход есть: «Счета и чеки»,
                // где этот же счёт лежит в списке.
                href="/parent/payments/invoices"
                chevron
                divider={i > 0}
                gap={11}
                verticalPadding={10}
              />
            ))
          )}
        </GlassCard>

        {/* 5. Главная CTA — ПОГАШЕНА. 27.08.2026: раньше это была боевая
            фиолетовая кнопка, а объяснение появлялось только по щелчку.
            Платить нечем, пока нет провайдера, поэтому кнопка приглушена,
            помечена «Скоро», не нажимается, а объяснение стоит под ней
            всегда. Строка автоплатежа, стоявшая выше, снесена целиком:
            автоплатежа в модели нет, карты «····8341» не существует, а
            переключатель ничего не сохранял. */}
        {dueCount > 0 && (
          <div>
            <PrimaryButton
              label={fillTemplate(T.payAllBtn, {
                sum: formatMoney(dueTotal, { withCurrency: true, currency: T.sum }),
              })}
              icon={<WhiteGlyph paths={ICON.card} size={16} />}
              inactive
              soonLabel={d.status.soon}
            />
            <SoonNote text={SOON_PAYMENTS} />
          </div>
        )}

        {/* 6. Быстрые действия — 4 колонки (gap 8). */}
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 4 }}
        >
          <QuickActionTile
            label={T.topupBtn}
            href="/parent/payments/top-up"
            gradient={["#34d399", "#059669"]}
            shadowRgb="52,211,153"
            icon={<WhiteGlyph paths={ICON.plus} size={15} />}
          />
          <QuickActionTile
            label={T.payHistory}
            href="/parent/payments/history"
            gradient={["#60a5fa", "#2563eb"]}
            shadowRgb="96,165,250"
            icon={<WhiteGlyph paths={ICON.clock} size={15} />}
          />
          <QuickActionTile
            label={T.billsReceipts}
            href="/parent/payments/invoices"
            gradient={["#fbbf24", "#f97316"]}
            shadowRgb="251,191,36"
            icon={<WhiteGlyph paths={ICON.doc} size={15} />}
          />
          <QuickActionTile
            label={T.payMethods}
            href="/parent/payments/methods"
            gradient={["#a78bfa", "#7c3aed"]}
            shadowRgb="167,139,250"
            icon={<WhiteGlyph paths={ICON.card} size={15} />}
          />
        </div>

        {/* 7. Кошелёк ребёнка. 12.08.2026 — экран деталей кошелька появился,
            поэтому карточка ведёт на него, а не сразу на пополнение: оттуда
            доступны и пополнение, и все операции. (27.08.2026 — «перевод» и
            «лимиты» из этого перечня убраны вместе с самими экранами.) */}
        <AccentCard
          gradient={["#7c3aed", "#a855f7"]}
          angle={135}
          shadowRgb="124,58,237"
          radius={20}
          contentStyle={{ padding: 14 }}
        >
          <Link href="/parent/payments/wallet" className="flex items-center" style={{ gap: 12 }}>
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "rgba(255,255,255,0.9)",
                fontSize: 15,
                fontWeight: 800,
                color: "#7c3aed",
              }}
            >
              {(givenName[0] ?? "—").toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
              <span className="truncate" style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                {walletTitle}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                {T.walletSub}
              </span>
            </div>
            <span className="shrink-0" style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
              {formatMoney(wallet_balance, { withCurrency: true, currency: T.sum })}
            </span>
            <Chevron color="rgba(255,255,255,0.85)" width={2.4} />
          </Link>
        </AccentCard>
        {/* Единственная заготовка, оставшаяся на этом экране. Молчать про неё
            нельзя: всё остальное вокруг стало настоящим, и человек примет за
            настоящее и её. */}
        <p style={{ fontSize: 10.5, fontWeight: 600, color: ink2, paddingLeft: 2 }}>
          {p2.walletIsExample}
        </p>
      </div>
    </div>
  );
}
