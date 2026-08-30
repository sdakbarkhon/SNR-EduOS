"use client";

/**
 * «Оплаты» У НАСТОЯЩЕГО РОДИТЕЛЯ. Заход 2 по оплатам, 30.08.2026.
 *
 * ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ВЕТКА ВНУТРИ PaymentsView — намеренно. Витрина
 * (PaymentsView.tsx) собрана дословно по макету, её показывают людям, и после
 * отката 28.08.2026 действует правило: демо-часть не трогаем. Развилка стоит
 * на уровне page.tsx, поэтому файл витрины в этом заходе не изменён НИ ОДНОЙ
 * СТРОКОЙ — это проверяется составом коммита, а не чтением кода.
 *
 * Цена такого решения — примитивы (AccentCard/AccentInset) объявлены здесь
 * заново. Это не новая болезнь: ровно так же они продублированы в HomeView и
 * ProgressView, общего слоя у них в вебе нет. Вынести их в один файл можно
 * будет, когда витрина перестанет меняться.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ ВИТРИНЫ ПО СУЩЕСТВУ:
 *  * баланс, долг и переплата — childPaymentsSummary() из настоящих таблиц;
 *  * «К оплате сейчас» — открытые счета из tuition_invoices;
 *  * строки автоплатежа НЕТ: сохранять его некуда, а тумблер обещает
 *    списание, которого не будет;
 *  * карточки кошелька НЕТ: таблицы школьного кошелька в схеме не
 *    существует ни одной — показывать там нечего;
 *  * кнопка оплаты не притворяется: открывает шторку и честно говорит, что
 *    касса не подключена, но показывает настоящий счёт и как его оплатить.
 *
 * СРОКА ОПЛАТЫ У СЧЕТА НЕТ. В `tuition_invoices` нет колонки с датой «до»:
 * есть месяц, сумма, статус и дата оплаты. Витрина пишет «до 5 августа» —
 * это выдумка макета. Здесь срок не показывается вовсе, пока школа не решит,
 * какой он и откуда берётся.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { formatSum } from "@/lib/course-price";
import type { ChildInvoice } from "@/lib/parent-queries";
import { RootHeader } from "../v2/RootHeader";
import { GlassCard } from "../v2/GlassCard";
import { ModalPortal, Z_MODAL, Z_MODAL_PANEL } from "../v2/ModalPortal";
import {
  CardRow,
  EmptyState,
  Glyph,
  ICON,
  IconTile,
  PrimaryButton,
  RowText,
  SECTION_CAP,
  StatusChip,
  WHITE,
} from "../_ui/screen-kit";
import { monthYearLabel } from "../_ui/format";
import { accentGrad, fontDisplay, ink1, ink2, shColor, status } from "../v2/tokens";

/* ===== Стекло шторки — те же токены, что у подтверждения выхода в
 *       ProfileView: второй набор под тот же элемент был бы расхождением. ===== */
const SHEET_BG =
  "var(--p-sheet-bg, linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76)))";
const SHEET_BORDER = "var(--p-sheet-border, rgba(255,255,255,0.9))";
const SHEET_SHADOW =
  "var(--p-sheet-shadow, 0 -16px 50px rgba(64,54,150,0.3), inset 0 1.5px 0 rgba(255,255,255,0.95))";
const SHEET_OVERLAY = "rgba(23,18,67,0.38)";
const CONTROL_SOFT = "var(--p-control-soft, rgba(23,18,67,0.06))";

/** Caps-подписи на акцентной карточке: 9/800, letter-spacing 5%, W85. */
const capsLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.05 * 9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.85)",
};

function AccentCard({
  gradient,
  radius: r = 22,
  shadowRgb,
  children,
  style,
}: {
  gradient: string[];
  radius?: number;
  shadowRgb?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ borderRadius: r, boxShadow: shadowRgb ? shColor(shadowRgb) : undefined }}>
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          borderRadius: r,
          background: `linear-gradient(135deg, ${gradient.join(", ")})`,
          ...style,
        }}
      >
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

function AccentInset({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.35)",
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 10,
        gap: 3,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Плитка быстрого действия — 4 в ряд, как на витрине. */
function QuickTile({
  label,
  href,
  paths,
  gradient,
}: {
  label: string;
  href: string;
  paths: readonly string[];
  gradient: readonly [string, string];
}) {
  return (
    <Link
      href={href}
      className="flex h-full w-full flex-col items-center justify-center transition-transform active:scale-[0.97]"
      style={{
        gap: 5,
        paddingBlock: 10,
        paddingInline: 4,
        borderRadius: 16,
        background: "var(--p-glass-1, rgba(255,255,255,0.72))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--p-glass-border, rgba(255,255,255,0.8))",
        boxShadow: "0 10px 22px rgba(99,86,214,0.12)",
      }}
    >
      <IconTile gradient={gradient} paths={paths} size={34} glyphSize={15} />
      <span style={{ fontSize: 9, fontWeight: 700, color: ink1, textAlign: "center", lineHeight: 1.25 }}>
        {label}
      </span>
    </Link>
  );
}

/** «1 счёт / 2 счёта / 5 счетов». В uz форма одна, в en — две. */
function dueCountLabel(
  n: number,
  locale: Locale,
  t: { dueOne: string; dueFew: string; dueMany: string },
): string {
  let tpl: string;
  if (locale === "ru") {
    const last = n % 10;
    const twoLast = n % 100;
    if (last === 1 && twoLast !== 11) tpl = t.dueOne;
    else if (last >= 2 && last <= 4 && (twoLast < 12 || twoLast > 14)) tpl = t.dueFew;
    else tpl = t.dueMany;
  } else {
    tpl = n === 1 ? t.dueOne : t.dueMany;
  }
  return tpl.replace("{n}", String(n));
}

/** «Август 2026» из period_month («2026-08-01»). */
function invoiceMonth(periodMonth: string, locale: Locale): string {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(5, 7));
  return monthYearLabel(year, month, locale);
}

export function RealPaymentsView({
  summary,
  invoices,
  parentInitials,
  bellCount,
  school,
}: {
  summary: { balance: number; dueTotal: number; dueCount: number; overpayment: number; failed: boolean };
  /** Только ОТКРЫТЫЕ счета — оплаченный долгом не является (см. page.tsx). */
  invoices: ChildInvoice[];
  parentInitials: string;
  bellCount: number;
  school: { name: string; phone: string | null; address: string | null } | null;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const t = d.paymentsWeb;

  // Шторка «как оплатить»: та же анимация, что у подтверждения выхода —
  // translateY(115%) → 0 за 320мс, оверлей 280мс.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetEntered, setSheetEntered] = useState(false);
  useEffect(() => {
    if (sheetOpen) {
      setSheetMounted(true);
      const raf = window.requestAnimationFrame(() => setSheetEntered(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setSheetEntered(false);
    const timer = window.setTimeout(() => setSheetMounted(false), 280);
    return () => window.clearTimeout(timer);
  }, [sheetOpen]);

  const money = (n: number) => `${formatSum(n)} ${d.pay.sum}`;
  const phoneDigits = school?.phone ? school.phone.replace(/[^\d+]/g, "") : null;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <RootHeader
        title={d.nav.payments}
        showLogo={false}
        titleSize={17}
        bellBadge={bellCount || undefined}
        initials={parentInitials}
        onBell={() => router.push("/parent/notifications")}
        onAvatar={() => router.push("/parent/profile")}
      />

      <div className="flex flex-col" style={{ gap: 12, paddingInline: 18, paddingTop: 4, paddingBottom: 8 }}>
        {summary.failed ? (
          // Сбой запроса и «счетов нет» — РАЗНЫЕ вещи, и признак failed заведён
          // в parent-queries именно ради этого: пустой список вместо ошибки был
          // бы правдоподобной ложью «счетов нет».
          <GlassCard style={{ paddingInline: 14 }}>
            <EmptyState title={t.loadFailedTitle} text={t.loadFailedText} paths={ICON.info} />
          </GlassCard>
        ) : (
          <>
            {/* Баланс. Ноль здесь значит ровно ноль денег, а не «не знаем». */}
            <AccentCard
              gradient={["#ec4899", "#f97316", "#4f86f6"]}
              shadowRgb="236,72,153"
              style={{ padding: 16, gap: 12 }}
            >
              <div className="flex items-start" style={{ gap: 12 }}>
                <div className="min-w-0 flex-1">
                  <span style={capsLabel}>{d.pay.balanceTotalCap}</span>
                  <div className="flex items-end" style={{ gap: 4, marginTop: 4 }}>
                    <span style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 600, color: WHITE }}>
                      {formatSum(summary.balance)}
                    </span>
                    <span
                      style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}
                    >
                      {d.pay.sum}
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    {d.pay.balanceAvailable}
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
                  <Glyph paths={ICON.wallet} size={22} color={WHITE} strokeWidth={1.9} />
                </span>
              </div>

              <div className="flex" style={{ gap: 8 }}>
                <AccentInset>
                  <span style={capsLabel}>{d.pay.balanceDueCap}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>{money(summary.dueTotal)}</span>
                </AccentInset>
                <AccentInset>
                  <span style={capsLabel}>{d.pay.balanceOverpaidCap}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>
                    {money(summary.overpayment)}
                  </span>
                </AccentInset>
              </div>
            </AccentCard>

            {invoices.length > 0 ? (
              <>
                <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 0.84,
                      textTransform: "uppercase",
                      color: SECTION_CAP,
                    }}
                  >
                    {d.pay.dueNow}
                  </span>
                  <StatusChip label={dueCountLabel(invoices.length, locale as Locale, t)} family="orange" />
                </div>

                <GlassCard style={{ paddingInline: 14, paddingBlock: 4 }}>
                  {invoices.map((inv, i) => (
                    <CardRow key={inv.id} divider={i > 0}>
                      <IconTile gradient={["#a78bfa", "#7c3aed"]} paths={ICON.card} size={38} />
                      <RowText title={t.tuition} subtitle={invoiceMonth(inv.period_month, locale as Locale)} />
                      <span className="flex shrink-0 flex-col items-end" style={{ gap: 3 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                          {formatSum(inv.amount)}
                        </span>
                        <StatusChip label={t.invoiceUnpaid} family="orange" fontSize={8.5} />
                      </span>
                    </CardRow>
                  ))}
                </GlassCard>

                <PrimaryButton
                  label={t.payBtn.replace("{sum}", money(summary.dueTotal))}
                  onClick={() => setSheetOpen(true)}
                />
              </>
            ) : (
              // Счетов нет вовсе. Не «0 сум» и не пустое место: школа могла
              // ещё не выставить счёт за месяц, и это нормальное состояние.
              <GlassCard style={{ paddingInline: 14 }}>
                <EmptyState title={t.noInvoicesTitle} text={t.noInvoicesText} paths={ICON.doc} />
              </GlassCard>
            )}

            {/* ДВЕ плитки, а не четыре (заход 7). «Пополнить» и «Способы
                оплаты» у настоящего родителя убраны совсем: пополнить из
                приложения нельзя, карт и привязок не существует до кассы.
                Вести туда плиткой значило бы обещать действие, которого нет.
                Подпись второй — «Счета», а не витринное «Счета и чеки»:
                чеков на настоящем экране нет. */}
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 4 }}>
              <QuickTile
                label={d.scr.payHistory}
                href="/parent/payments/history"
                paths={ICON.clock}
                gradient={["#60a5fa", "#2563eb"]}
              />
              <QuickTile
                label={t.invoicesTitle}
                href="/parent/payments/invoices"
                paths={ICON.doc}
                gradient={["#fbbf24", "#f97316"]}
              />
            </div>
          </>
        )}
      </div>

      {/* Шторка «онлайн-оплата не подключена». Через ModalPortal — иначе её
          нижний край уходит под плавающий таб-бар (та же причина, что у
          подтверждения выхода в ProfileView). */}
      {sheetMounted ? (
        <ModalPortal>
          <div className="fixed inset-0" style={{ zIndex: Z_MODAL }}>
            <button
              type="button"
              aria-label={t.sheetOk}
              onClick={() => setSheetOpen(false)}
              className="absolute inset-0 w-full transition-opacity"
              style={{
                background: SHEET_OVERLAY,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                opacity: sheetEntered ? 1 : 0,
                transitionDuration: "280ms",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 mx-auto flex max-w-[430px] items-end"
              style={{ zIndex: Z_MODAL_PANEL }}
            >
              <div
                className="pointer-events-auto w-full overflow-hidden"
                style={{
                  margin: 8,
                  borderRadius: 30,
                  background: SHEET_BG,
                  backdropFilter: "blur(26px)",
                  WebkitBackdropFilter: "blur(26px)",
                  border: `1px solid ${SHEET_BORDER}`,
                  boxShadow: SHEET_SHADOW,
                  transform: sheetEntered ? "translateY(0)" : "translateY(115%)",
                  transition: "transform 320ms cubic-bezier(0.2,0.7,0.3,1)",
                }}
              >
                <div
                  className="flex flex-col"
                  style={{ gap: 12, paddingTop: 22, paddingInline: 20, paddingBottom: 18 }}
                >
                  <div className="flex flex-col items-center" style={{ gap: 9 }}>
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        background: `rgba(${status.violet.rgb},0.12)`,
                        border: `1px solid rgba(${status.violet.rgb},0.35)`,
                      }}
                    >
                      <Glyph paths={ICON.card} size={23} color={status.violet.text} strokeWidth={2} />
                    </span>
                    <span
                      style={{
                        fontFamily: fontDisplay,
                        fontWeight: 600,
                        fontSize: 15,
                        color: ink1,
                        textAlign: "center",
                      }}
                    >
                      {t.sheetTitle}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: "17px",
                        color: ink2,
                        textAlign: "center",
                      }}
                    >
                      {t.sheetText}
                    </span>
                  </div>

                  {/* Настоящий счёт: месяц и сумма. Срока в базе нет — см. шапку файла. */}
                  {invoices.length > 0 ? (
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: 0.76,
                          textTransform: "uppercase",
                          color: SECTION_CAP,
                        }}
                      >
                        {t.sheetInvoiceCap}
                      </span>
                      <div
                        className="flex flex-col"
                        style={{ gap: 8, padding: 12, borderRadius: 16, background: CONTROL_SOFT }}
                      >
                        {invoices.map((inv) => (
                          <div key={inv.id} className="flex items-center" style={{ gap: 10 }}>
                            <span className="min-w-0 flex-1" style={{ fontSize: 11.5, fontWeight: 700, color: ink2 }}>
                              {t.tuition} · {invoiceMonth(inv.period_month, locale as Locale)}
                            </span>
                            <span className="shrink-0" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                              {money(inv.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Как оплатить. Реквизитов (legal_details) нет намеренно —
                      блок обязан выглядеть законченно на телефоне и адресе. */}
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: 0.76,
                        textTransform: "uppercase",
                        color: SECTION_CAP,
                      }}
                    >
                      {t.sheetHowCap}
                    </span>
                    <div className="flex flex-col" style={{ gap: 10, padding: 12, borderRadius: 16, background: CONTROL_SOFT }}>
                      {school?.phone ? (
                        <div className="flex items-center" style={{ gap: 10 }}>
                          <Glyph paths={ICON.phone} size={15} color={ink2} strokeWidth={1.9} />
                          <span className="min-w-0 flex-1" style={{ fontSize: 10, fontWeight: 700, color: ink2 }}>
                            {t.sheetPhone}
                          </span>
                          <span className="shrink-0" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                            {school.phone}
                          </span>
                        </div>
                      ) : null}
                      {school?.address ? (
                        <div className="flex items-start" style={{ gap: 10 }}>
                          <span style={{ paddingTop: 1 }}>
                            <Glyph paths={ICON.pin} size={15} color={ink2} strokeWidth={1.9} />
                          </span>
                          <span className="min-w-0 flex-1" style={{ fontSize: 10, fontWeight: 700, color: ink2 }}>
                            {t.sheetAddress}
                          </span>
                          <span
                            className="shrink-0"
                            style={{ maxWidth: 210, fontSize: 11, fontWeight: 700, color: ink1, textAlign: "right" }}
                          >
                            {school.address}
                          </span>
                        </div>
                      ) : null}
                      {!school?.phone && !school?.address ? (
                        <span style={{ fontSize: 11, fontWeight: 600, lineHeight: "17px", color: ink2 }}>
                          {t.sheetNoContacts}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full" style={{ gap: 10, marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="flex-1"
                      style={{
                        paddingBlock: 14,
                        borderRadius: 16,
                        background: CONTROL_SOFT,
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: ink1,
                      }}
                    >
                      {t.sheetOk}
                    </button>
                    {phoneDigits ? (
                      <a
                        href={`tel:${phoneDigits}`}
                        className="relative flex-1 overflow-hidden text-center"
                        style={{
                          padding: 15,
                          borderRadius: 16,
                          background: accentGrad,
                          boxShadow: "0 14px 32px rgba(124,58,237,0.4)",
                          fontSize: 13,
                          fontWeight: 800,
                          color: WHITE,
                        }}
                      >
                        {t.sheetCall}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 top-0"
                          style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
                        />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
