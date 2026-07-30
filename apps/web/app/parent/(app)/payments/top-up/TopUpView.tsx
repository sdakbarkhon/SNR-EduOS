"use client";

/**
 * Экран «Пополнение баланса» (dtop) — веб-порт
 * apps/mobile-parent/src/screens/payments/TopUpScreen.tsx (ветка
 * `feat/mobile-parent-redesign`, макет «SNR EduOS v2 Light.dc.html» 1098–1130).
 *
 * Композиция сверху вниз (как в RN):
 *  1. WalletCard — круглый бейдж с первой буквой имени, «Кошелёк {gen}» +
 *     «Текущий баланс», справа сумма.
 *  2. AmountCard — подпись «СУММА ПОПОЛНЕНИЯ», крупный ввод + суффикс «сум»,
 *     нижняя граница 2px accent .35, ряд быстрых сумм (TOPUP_PRESETS).
 *  3. PaymentMethodRow — Payme + ссылка «Изменить» на /parent/payments/methods
 *     (в мобилке это был переход на d33 — тот же экран «Способы оплаты»).
 *  4. CTA «Пополнить [на N сум]» — серая и некликабельная при пустом поле.
 *  5. Зелёная плашка про мгновенное зачисление.
 *
 * ЧТО ОТЛИЧАЕТСЯ ОТ МОБИЛКИ. В RN нажатие CTA было молчаливым no-op'ом
 * (`doTopup` c комментарием TODO). В вебе так нельзя: кнопка, которая
 * визуально работает и ничего не делает, читается как баг. Поэтому нажатие
 * показывает SoonNote с объяснением, почему пополнение недоступно.
 *
 * Баланс кошелька берётся ТЕМ ЖЕ аксессором, что и на /parent/payments
 * (getSelectedChildContext), — иначе два экрана показывали бы разные числа.
 */

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "../../v2/GlassCard";
import { Glyph, ScreenScroll, SectionCap, WHITE } from "../../_ui/screen-kit";
import { accent, accentGrad, fontDisplay, ink1, ink2, ink3, status } from "../../v2/tokens";
import { getSelectedChildContext } from "../../v2/data";
import {
  CURRENCY,
  TOPUP_PRESETS,
  formatMoney,
  givenNameOf,
  walletTitleOf,
  SOON_PAYMENTS,
} from "../mock-data";
import { BrandChip, NoticeBanner, PAY_GLYPH, SoonNote } from "../parts";

const MAX_DIGITS = 9;

export function TopUpView({ childName }: { childName: string | null }) {
  // Баланс — фикстура (кошелька в БД нет), но ЕДИНАЯ с карточкой на /parent/payments.
  const { wallet_balance: balance } = getSelectedChildContext();

  const given = givenNameOf(childName);
  const initial = (given[0] ?? "—").toUpperCase();
  // Заголовок — общий хелпер: /parent/payments рисует ту же карточку кошелька
  // и обязан называть её теми же словами.
  const walletTitle = walletTitleOf(childName);

  const [amount, setAmount] = useState("");
  const [soon, setSoon] = useState(false);

  const numeric = Number(amount);
  const hasValue = amount.length > 0 && numeric > 0;
  const ctaLabel = hasValue
    ? `Пополнить на ${formatMoney(numeric, { withCurrency: true })}`
    : "Пополнить";

  return (
    <ScreenScroll>
      {/* 1. Кошелёк ребёнка. */}
      <GlassCard radius={20} style={{ padding: "12px 14px" }}>
        <div className="flex items-center" style={{ gap: 11 }}>
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 38,
              height: 38,
              background: `rgba(124,58,237,0.12)`,
              border: `1px solid rgba(124,58,237,0.3)`,
              fontSize: 12.5,
              fontWeight: 800,
              color: accent,
            }}
          >
            {initial}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
              {walletTitle}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: ink2 }}>Текущий баланс</span>
          </span>
          <span className="shrink-0" style={{ fontSize: 13.5, fontWeight: 800, color: ink1 }}>
            {formatMoney(balance, { withCurrency: true })}
          </span>
        </div>
      </GlassCard>

      {/* 2. Сумма пополнения. */}
      <GlassCard radius={20} style={{ padding: "16px 14px" }}>
        <div className="flex flex-col" style={{ gap: 9 }}>
          <SectionCap label="Сумма пополнения" tone="ink3" />

          <label
            className="flex items-center"
            style={{
              gap: 8,
              padding: "4px 2px",
              borderBottom: `2px solid rgba(124,58,237,0.35)`,
            }}
          >
            <span className="sr-only">Сумма пополнения в сумах</span>
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS));
                setSoon(false);
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent outline-none"
              style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 600, color: ink1 }}
            />
            <span className="shrink-0" style={{ fontSize: 13, fontWeight: 700, color: ink2 }}>
              {CURRENCY}
            </span>
          </label>

          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {TOPUP_PRESETS.map((preset) => {
              const active = amount === String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(String(preset));
                    setSoon(false);
                  }}
                  style={{
                    padding: "7px 11px",
                    borderRadius: 999,
                    background: active ? accentGrad : "rgba(139,92,246,0.12)",
                    border: active ? "1px solid transparent" : "1px solid rgba(139,92,246,0.35)",
                    boxShadow: active ? "0 6px 14px rgba(124,58,237,0.35)" : undefined,
                    fontSize: 11,
                    fontWeight: 800,
                    color: active ? WHITE : status.violet.text,
                  }}
                >
                  {formatMoney(preset)}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* 3. Способ оплаты. */}
      <GlassCard radius={20} style={{ padding: "12px 14px" }}>
        <div className="flex items-center" style={{ gap: 11 }}>
          <BrandChip gradient={["#2dd4bf", "#0d9488"]} label="PAYME" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>Payme</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
              Мгновенное зачисление
            </span>
          </span>
          <Link
            href="/parent/payments/methods"
            className="shrink-0"
            style={{ fontSize: 11, fontWeight: 800, color: status.violet.text }}
          >
            Изменить
          </Link>
        </div>
      </GlassCard>

      {/* 4. CTA. Пустое поле → серая и некликабельная (правило макета). */}
      <div>
        <button
          type="button"
          disabled={!hasValue}
          onClick={() => setSoon(true)}
          className="relative flex w-full items-center justify-center overflow-hidden"
          style={{
            gap: 8,
            padding: 15,
            borderRadius: 16,
            background: hasValue ? accentGrad : "rgba(23,18,67,0.08)",
            boxShadow: hasValue ? "0 14px 32px rgba(124,58,237,0.4)" : undefined,
            cursor: hasValue ? "pointer" : "default",
          }}
        >
          {hasValue ? (
            <>
              <Glyph paths={PAY_GLYPH.plus} size={16} color={WHITE} strokeWidth={2.2} />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
              />
            </>
          ) : null}
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: hasValue ? WHITE : "rgba(26,19,74,0.4)",
            }}
          >
            {ctaLabel}
          </span>
        </button>
        {soon ? <SoonNote text={SOON_PAYMENTS} /> : null}
      </div>

      {/* 5. Плашка про мгновенное зачисление. */}
      <NoticeBanner
        family="green"
        paths={PAY_GLYPH.bolt}
        text="Зачисление мгновенное: деньги появятся на кошельке ребёнка сразу после оплаты и будут доступны в столовой уже на следующей перемене."
      />

      <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
        Кошелёк тратится только на питание и покупки в школе.
      </span>
    </ScreenScroll>
  );
}
