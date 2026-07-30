"use client";

/**
 * Экран П17 «Оплаты» — веб-перенос 1:1 из мобильного
 * apps/mobile-parent/src/screens/tabs/PaymentsScreen.tsx (ветка
 * `feat/mobile-parent-redesign`), который сам перенесён дословно из
 * утверждённого макета «SNR EduOS v2 Light.dc.html» (строки 376–411).
 *
 * Композиция сверху вниз (как в RN):
 *  1. RootHeader без лого — заголовок «Оплаты», bell (badge 3), аватар «ДК».
 *  2. AccentCard баланса — трёхстопный градиент ec4899→f97316→4f86f6; левая
 *     колонка (ОБЩИЙ БАЛАНС, число, «Доступно для расходов»), справа
 *     wallet-иконка 42×42 на glass-квадрате; внизу два AccentInset sub-tile:
 *     «К ОПЛАТЕ» / «ПЕРЕПЛАТА».
 *  3. Section «К оплате сейчас» + chip «2 счёта» (orange) + «Смотреть все ›».
 *  4. GlassCard с двумя ListRow счетов (BILLS.in_main_list).
 *  5. GlassCard-строка «Автоплатёж» с Toggle (локальный state; initial из
 *     PAYMENTS_OVERVIEW.autopay_enabled).
 *  6. PrimaryButton «Оплатить всё — {sum}».
 *  7. QuickActionsGrid 4 колонки: Пополнить / История оплат / Счета и чеки /
 *     Способы оплаты.
 *  8. AccentCard «Кошелёк {gen}».
 *
 * Данные — ТОЛЬКО через аксессоры ../v2/data (точная копия data-слоя мобилки):
 * getPaymentsOverview, getDueBills, getDueTotal, getDueBillsCount,
 * getSelectedChildContext, getUnreadNotificationsCount, getParent.
 *
 * Платформенные отличия от RN (осознанные):
 *  * RN-компоненты UI-кита (AccentCard/AccentInset/ListRow/Toggle/
 *    PrimaryButton/QuickActionTile/RootHeader) в вебе ещё не выделены в
 *    общий слой — они воспроизведены локально в этом файле с теми же
 *    размерами/радиусами/тенями (см. src/ui/* на ветке мобилки);
 *  * иконки — инлайновый <svg> с ДОСЛОВНЫМИ path'ами ICONS макета
 *    (navigation/routes.ts), а не lucide: пути известны точно, замена
 *    ближайшей иконкой ухудшила бы совпадение;
 *  * навигация (d8/d18/d19/d20/d21/d22/d33/dtop/dhub) в вебе отсутствует —
 *    экраны-назначения не портированы, поэтому кнопки без обработчиков;
 *  * только светлая тема (токены ../v2/tokens.ts).
 */

import { useState, type CSSProperties, type ReactNode } from "react";
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
  shColor,
  status,
} from "../v2/tokens";
import {
  getDueBills,
  getDueBillsCount,
  getDueTotal,
  getParent,
  getPaymentsOverview,
  getSelectedChildContext,
  getUnreadNotificationsCount,
} from "../v2/data";

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
  autopay: "Автоплатёж",
  payAllBtn: "Оплатить всё — {sum}",
  topupBtn: "Пополнить",
  payHistory: "История оплат",
  billsReceipts: "Счета и чеки",
  payMethods: "Способы оплаты",
  walletTitle: "Кошелёк {gen}",
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
  /** Автоплатёж — round-arrow (задан прямо в RN-экране, не из ICONS). */
  autopay: ["M21 12a9 9 0 1 1-3-6.7", "M21 4v5h-5"],
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

/** Шеврон › ListRow: 14px, stroke rgba(26,19,74,.4), strokeWidth 2.2. */
function Chevron({ color, size = 14, width = 2.2 }: { color: string; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="m9 18 6-6-6-6" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
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

/** ListRow: строка 52–60px — title 12.5/800 ink1, sub 10.5/600 ink2, шеврон 14. */
function ListRow({
  left,
  title,
  subtitle,
  right,
  chevron = false,
  divider = false,
  verticalPadding = 10,
  gap = 11,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chevron?: boolean;
  divider?: boolean;
  verticalPadding?: number;
  gap?: number;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        gap,
        paddingTop: verticalPadding,
        paddingBottom: verticalPadding,
        borderTop: divider ? "1px solid rgba(23,18,67,0.07)" : undefined,
      }}
    >
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
      {chevron ? <Chevron color="rgba(26,19,74,0.4)" /> : null}
    </div>
  );
}

/** Toggle 44×26 r13: off-трек rgba(23,18,67,.14), on — accent-градиент, кноб 20 (ход 18). */
function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={T.autopay}
      onClick={() => onValueChange(!value)}
      className="relative shrink-0"
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: "rgba(23,18,67,0.14)",
        boxShadow: value ? "0 4px 10px rgba(124,58,237,0.35)" : undefined,
      }}
    >
      {/* on-состояние: accent-градиент, плавное появление (transition .22s). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: 13,
          background: accentGrad,
          opacity: value ? 1 : 0,
          transition: "opacity 0.22s ease",
        }}
      />
      <span
        aria-hidden
        className="absolute"
        style={{
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: "#FFFFFF",
          transform: value ? "translateX(18px)" : "translateX(0px)",
          transition: "transform 0.22s ease",
        }}
      />
    </button>
  );
}

/** PrimaryButton: accent-градиент, r16, padding 15, gap 8, текст 14/800, тень 0 14 32. */
function PrimaryButton({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className="relative flex w-full items-center justify-center overflow-hidden transition-transform active:scale-[0.99]"
      style={{
        gap: 8,
        padding: 15,
        borderRadius: 16,
        background: accentGrad,
        boxShadow: "0 14px 32px rgba(124,58,237,0.4)",
      }}
    >
      {icon}
      <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>{label}</span>
      {/* inset-блик W35 → верхняя hairline-полоска (макет строка 397). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
      />
    </button>
  );
}

/** QuickActionTile size="sm" (грид 4 колонки, П17): r16, pad 10×4, gap 5, плитка 34 r11, подпись 9/700. */
function QuickActionTile({
  label,
  icon,
  gradient,
  shadowRgb,
}: {
  label: string;
  icon: ReactNode;
  gradient: [string, string];
  shadowRgb?: string;
}) {
  return (
    <button
      type="button"
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
    </button>
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

/** Шапка корневого экрана (RootHeader без лого): заголовок 17 Unbounded, bell 38 + badge, аватар 38. */
function RootHeader({
  title,
  bellCount,
  avatar,
}: {
  title: string;
  bellCount?: number;
  avatar: { initials: string; gradient: [string, string] };
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
        <button
          type="button"
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
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke={ink1}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {ICON.bell.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
        </button>
        {bellCount ? (
          // CountBadge preset 'alert': 17 r9, top −3 right −3 (макет строка 223).
          <span
            className="absolute flex items-center justify-center"
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
      <span
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
      </span>
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

export function PaymentsView() {
  // Активный ребёнок — из DEFAULT_CHILD_INDEX фикстур (как в мобилке): Малика.
  const { child, wallet_balance } = getSelectedChildContext();
  const parent = getParent();
  const overview = getPaymentsOverview();
  const dueBills = getDueBills();
  const dueTotal = getDueTotal();
  const dueCount = getDueBillsCount();
  const unread = getUnreadNotificationsCount();

  const [autopay, setAutopay] = useState<boolean>(overview.autopay_enabled);

  const orangeChip = chip(status.orange.rgb);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <RootHeader
        title={T.navPayments}
        bellCount={unread}
        avatar={{ initials: parent.initials, gradient: parent.avatar_gradient }}
      />

      <div
        className="flex flex-col"
        style={{ gap: 12, paddingLeft: 18, paddingRight: 18, paddingTop: 4, paddingBottom: 8 }}
      >
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
                  {formatMoney(overview.total_balance)}
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
                {formatMoney(dueTotal, { withCurrency: true, currency: T.sum })}
              </span>
            </AccentInset>
            <AccentInset radius={12} className="flex flex-1 flex-col" style={{ padding: 10, gap: 3 }}>
              <span style={capsLabel}>{T.balanceOverpaidCap}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {formatMoney(overview.overpayment, { withCurrency: true, currency: T.sum })}
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
                color: "rgba(26,19,74,0.5)",
              }}
            >
              {T.dueNow}
            </span>
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
          </div>
          <button
            type="button"
            className="shrink-0"
            style={{ fontSize: 11.5, fontWeight: 800, color: status.violet.text }}
          >
            {T.viewAll} ›
          </button>
        </div>

        {/* 4. Счета «К оплате сейчас». */}
        <GlassCard style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 14, paddingRight: 14 }}>
          {dueBills.map((bill, i) => (
            <ListRow
              key={bill.id}
              left={<BillIconTile gradient={bill.gradient} paths={bill.icon_paths} />}
              title={bill.title}
              subtitle={bill.note}
              right={
                <div className="flex flex-col items-end" style={{ gap: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                    {formatMoney(bill.amount)}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: status.orange.text }}>
                    {fillTemplate(T.billDueBy, { date: bill.due_date_label })}
                  </span>
                </div>
              }
              chevron
              divider={i > 0}
              gap={11}
              verticalPadding={10}
            />
          ))}
        </GlassCard>

        {/* 5. Автоплатёж (Toggle). */}
        <GlassCard style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 14, paddingRight: 14 }}>
          <ListRow
            left={
              <BillIconTile gradient={["#34d399", "#059669"]} paths={ICON.autopay} size={36} radius={12} />
            }
            title={T.autopay}
            subtitle={overview.autopay_note}
            right={<Toggle value={autopay} onValueChange={setAutopay} />}
            gap={11}
            verticalPadding={10}
          />
        </GlassCard>

        {/* 6. Главная CTA. */}
        <PrimaryButton
          label={fillTemplate(T.payAllBtn, {
            sum: formatMoney(dueTotal, { withCurrency: true, currency: T.sum }),
          })}
          icon={<WhiteGlyph paths={ICON.card} size={16} />}
        />

        {/* 7. Быстрые действия — 4 колонки (gap 8). */}
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 4 }}
        >
          <QuickActionTile
            label={T.topupBtn}
            gradient={["#34d399", "#059669"]}
            shadowRgb="52,211,153"
            icon={<WhiteGlyph paths={ICON.plus} size={15} />}
          />
          <QuickActionTile
            label={T.payHistory}
            gradient={["#60a5fa", "#2563eb"]}
            shadowRgb="96,165,250"
            icon={<WhiteGlyph paths={ICON.clock} size={15} />}
          />
          <QuickActionTile
            label={T.billsReceipts}
            gradient={["#fbbf24", "#f97316"]}
            shadowRgb="251,191,36"
            icon={<WhiteGlyph paths={ICON.doc} size={15} />}
          />
          <QuickActionTile
            label={T.payMethods}
            gradient={["#a78bfa", "#7c3aed"]}
            shadowRgb="167,139,250"
            icon={<WhiteGlyph paths={ICON.card} size={15} />}
          />
        </div>

        {/* 8. Кошелёк ребёнка. */}
        <AccentCard
          gradient={["#7c3aed", "#a855f7"]}
          angle={135}
          shadowRgb="124,58,237"
          radius={20}
          contentStyle={{ padding: 14 }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
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
              {child.first_name.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                {fillTemplate(T.walletTitle, { gen: child.first_name_gen })}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                {T.walletSub}
              </span>
            </div>
            <span className="shrink-0" style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
              {formatMoney(wallet_balance, { withCurrency: true, currency: T.sum })}
            </span>
            <Chevron color="rgba(255,255,255,0.85)" width={2.4} />
          </div>
        </AccentCard>
      </div>
    </div>
  );
}
