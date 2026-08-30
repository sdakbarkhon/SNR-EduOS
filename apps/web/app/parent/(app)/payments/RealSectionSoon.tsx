"use client";

/**
 * «РАЗДЕЛА ПОКА НЕТ» — для настоящего родителя. Заход 7 по оплатам, 30.08.2026.
 *
 * Три раздела оплат у настоящего родителя убраны решением заказчика:
 * пополнение, способы оплаты и кошелёк (он же — операции кошелька). Причина у
 * всех одна: показывать нечего. Карт и привязок не существует до подключения
 * кассы, таблицы школьного кошелька нет в схеме ни одной, а пополнить из
 * приложения нельзя.
 *
 * ССЫЛОК ТУДА БОЛЬШЕ НЕТ — ни на вкладке оплат, ни в меню профиля. Но адрес
 * никуда не делся: его можно открыть по закладке или набрать руками. Тогда
 * человек обязан увидеть ОБЪЯСНЕНИЕ, а не пустой экран и не витрину с чужими
 * картами.
 *
 * ТЕКСТ БЕРЁТСЯ ИЗ ТОГО ЖЕ МЕСТА, ЧТО И В МОБИЛЬНОМ — `parentApp.soon2.items`.
 * Там у каждого раздела свой текст, написанный ровно под этот случай («карту
 * будет принимать платёжная система, а не приложение»), и мобильное показывает
 * его же на своём «Скоро». Заводить второй текст об одном и том же значило бы
 * разойтись в словах.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll } from "../_ui/screen-kit";

export function RealSectionSoon({ sectionKey }: { sectionKey: string }) {
  const { locale } = useLocale();
  const soon = getDictionary(locale as Locale).parentApp.soon2;
  const item = soon.items[sectionKey] ?? soon.fallback;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={item.title} backHref="/parent/payments" />
      <ScreenScroll gap={11}>
        <GlassCard radius={20}>
          <EmptyState title={item.title} text={item.text} paths={ICON.clock} />
        </GlassCard>
      </ScreenScroll>
    </div>
  );
}
