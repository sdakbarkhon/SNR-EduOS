"use client";

/**
 * Экран «Способы оплаты» (d33) — веб-порт
 * apps/mobile-parent/src/screens/payments/PayMethodsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1066–1097).
 *
 * Композиция:
 *  1. «Основная карта» — крупная фиолетовая карта UZCARD: бренд, чип
 *     «Автоплатёж 1-го числа», маскированный номер, срок действия.
 *  2. «Другие карты» — стеклянный список HUMO / VISA.
 *  3. Ghost-кнопка «Добавить карту».
 *  4. «Другие способы» — Click / Payme / Apple Pay со статусом привязки.
 *  5. Зелёная плашка про безопасность платежей.
 *
 * ЧТО ОТЛИЧАЕТСЯ ОТ МОБИЛКИ (осознанно). В RN каждая строка была Pressable с
 * шевроном и вела на экран деталей карты (dcarddet), а «+ Редактировать» —
 * туда же. В вебе таких экранов нет и не будет до подключения провайдера,
 * поэтому строки сделаны ИНФОРМАЦИОННЫМИ: без шевронов и без нажатия — иначе
 * это были бы ровно те «кнопки в никуда», которые мы здесь и чиним.
 * Единственное действие — «Добавить карту»: оно раскрывает SoonNote с
 * объяснением, почему карту пока нельзя привязать.
 */

import { useState } from "react";
import { GlassCard } from "../../v2/GlassCard";
import { DIVIDER, Glyph, ScreenScroll, SectionCap, WHITE } from "../../_ui/screen-kit";
import { glass2, ink1, ink2, status } from "../../v2/tokens";
import { MAIN_CARD, OTHER_CARDS, OTHER_METHODS, SOON_PAYMENTS } from "../mock-data";
import { BrandChip, NoticeBanner, PAY_GLYPH, SoonNote } from "../parts";

/** Строка стеклянного списка: бренд-плашка + название + подпись. */
function MethodRow({
  gradient,
  tag,
  title,
  subtitle,
  subtitleColor,
  divider,
}: {
  gradient: readonly [string, string];
  tag: string;
  title: string;
  subtitle: string;
  subtitleColor: string;
  divider: boolean;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 11,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
      }}
    >
      <BrandChip gradient={gradient} label={tag} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
          {title}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: subtitleColor }}>{subtitle}</span>
      </span>
    </div>
  );
}

export function PayMethodsView() {
  const [soon, setSoon] = useState(false);

  return (
    <ScreenScroll>
      {/* 1. Основная карта. */}
      <SectionCap label="Основная карта" />
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: 22,
          padding: 15,
          background: "linear-gradient(135deg, #7c3aed, #4f6df5)",
          boxShadow: "0 16px 36px rgba(124,58,237,0.38)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
        />
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.96, color: WHITE }}>
              {MAIN_CARD.brand}
            </span>
            <span
              className="shrink-0"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.4)",
                fontSize: 9.5,
                fontWeight: 800,
                color: WHITE,
              }}
            >
              {MAIN_CARD.note}
            </span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 2.2, color: WHITE }}>
            {MAIN_CARD.masked}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            Действует до {MAIN_CARD.validThru}
          </span>
        </div>
      </div>

      {/* 2. Другие карты. */}
      <SectionCap label="Другие карты" />
      <GlassCard radius={20} style={{ padding: "5px 14px" }}>
        {OTHER_CARDS.map((card, i) => (
          <MethodRow
            key={card.id}
            gradient={card.gradient}
            tag={card.brand}
            title={card.masked}
            subtitle={`Действует до ${card.validThru}`}
            subtitleColor={ink2}
            divider={i > 0}
          />
        ))}
      </GlassCard>

      {/* 3. Добавить карту — единственное действие экрана. */}
      <div>
        <button
          type="button"
          onClick={() => setSoon((v) => !v)}
          className="flex w-full items-center justify-center"
          style={{
            gap: 8,
            padding: 13,
            borderRadius: 15,
            background: glass2.background,
            border: "1.5px solid rgba(124,58,237,0.45)",
          }}
        >
          <Glyph paths={PAY_GLYPH.plus} size={15} color={status.violet.text} strokeWidth={2.2} />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: status.violet.text }}>
            Добавить карту
          </span>
        </button>
        {soon ? <SoonNote text={SOON_PAYMENTS} /> : null}
      </div>

      {/* 4. Другие способы. */}
      <SectionCap label="Другие способы" />
      <GlassCard radius={20} style={{ padding: "5px 14px" }}>
        {OTHER_METHODS.map((method, i) => (
          <MethodRow
            key={method.id}
            gradient={method.gradient}
            tag={method.tag}
            title={method.title}
            subtitle={method.subtitle}
            subtitleColor={method.linked ? status.green.text : ink2}
            divider={i > 0}
          />
        ))}
      </GlassCard>

      {/* 5. Плашка про безопасность. */}
      <NoticeBanner
        family="green"
        text="Платежи защищены. Данные карт хранятся у платёжных систем, а не в приложении — SNR EduOS видит только маскированный номер."
      />
    </ScreenScroll>
  );
}
