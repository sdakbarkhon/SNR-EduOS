"use client";

/**
 * Экран «Способы оплаты» (d33).
 *
 * ПЕРЕПИСАН 27.08.2026 — ЭКРАН ГОВОРИЛ НЕПРАВДУ.
 *
 * Было: крупная фиолетовая карта UZCARD с маскированным номером и подписью
 * «Автоплатёж 1-го числа», список «Других карт» — HUMO и VISA со сроками
 * действия, и три «других способа», из которых Click и Payme значились как
 * «Привязан аккаунт» зелёным. Ни одной карты в проекте не хранится, ни один
 * провайдер не подключён, платить нечем вовсе — таблицы платежей пусты.
 * Заказчик показывает приложение клиентам, и всё, что выглядит рабочим, он
 * нажимает.
 *
 * Стало: три способа из утверждённой модели — Payme, Click, Uzum, — все
 * неактивные, с подписью «Скоро». Ни привязанных аккаунтов, ни сохранённых
 * карт, ни кнопки «Добавить карту»: добавлять карту некуда, пока нет
 * провайдера.
 *
 * ПОЧЕМУ СПОСОБЫ ВСЁ-ТАКИ ПОКАЗАНЫ, а не убраны совсем. Родителю полезно
 * заранее знать, чем он сможет платить, — но ровно с той честностью, с какой
 * это есть сегодня. Пустой экран сказал бы меньше правды, чем список с
 * «Скоро».
 *
 * Нажимать здесь нечего: ни одна строка не Pressable, ни одна кнопка никуда не
 * ведёт. Это осознанно — «кнопки в никуда» и были болезнью этого экрана.
 */

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../../v2/GlassCard";
import { DIVIDER, ScreenScroll, SectionCap } from "../../_ui/screen-kit";
import { ink1, ink2 } from "../../v2/tokens";
import { OTHER_METHODS, SOON_PAYMENTS } from "../../_demo/demo-data";
import { BrandChip, NoticeBanner } from "../parts";

/** Строка способа оплаты: бренд-плашка, название, подпись «Скоро». */
function MethodRow({
  gradient,
  tag,
  title,
  subtitle,
  soonLabel,
  divider,
}: {
  gradient: readonly [string, string];
  tag: string;
  title: string;
  subtitle: string;
  soonLabel: string;
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
        // Приглушение — это и есть «неактивно»: способ виден, но ясно, что им
        // сейчас не воспользоваться.
        opacity: 0.55,
      }}
    >
      <BrandChip gradient={gradient} label={tag} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
          {title}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>{subtitle}</span>
      </span>
      <span
        className="shrink-0"
        style={{
          padding: "3px 9px",
          borderRadius: 8,
          background: "rgba(100,116,139,0.14)",
          fontSize: 9.5,
          fontWeight: 800,
          color: ink2,
        }}
      >
        {soonLabel}
      </span>
    </div>
  );
}

export function PayMethodsView() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <ScreenScroll>
      <SectionCap label={d.parentApp.pay.otherMethods} />
      <GlassCard radius={20} style={{ padding: "5px 14px" }}>
        {OTHER_METHODS.map((method, i) => (
          <MethodRow
            key={method.id}
            gradient={method.gradient}
            tag={method.tag}
            title={method.title}
            subtitle={d.parentApp.pay2.methodNotLinked}
            soonLabel={d.status.soon}
            divider={i > 0}
          />
        ))}
      </GlassCard>

      <NoticeBanner family="violet" title="Оплата пока не подключена" text={SOON_PAYMENTS} />
    </ScreenScroll>
  );
}
