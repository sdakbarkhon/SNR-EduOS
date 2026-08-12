"use client";

/**
 * Разметка «От администрации». Клиентский компонент ради словаря (см. TestsView).
 *
 * Карточка НЕ такая, как на «Объявлениях», намеренно. Там карточка большая:
 * hero-градиент 104h и бэдж категории — а подписи категорий («Срочно»,
 * «Мероприятие», «Учёба»…) на том экране захардкожены по-русски. Утащить её
 * сюда как есть — значит принести русские подписи на экран, который обязан
 * говорить на трёх языках. Поэтому здесь компактная лента из тех же деталей
 * набора (GlassCard r22, StatusChip, hairline-футер): семья та же, размер
 * меньше. Когда «Объявления» переведут, карточки можно будет свести в одну.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentAnnouncement } from "@snr/core";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { formatDateLong } from "../_ui/format";
import { ink1, ink2, ink3 } from "../v2/tokens";

export function NewsView({ news }: { news: ParentAnnouncement[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.adminNews} backHref="/parent/messages" />

      <ScreenScroll>
        {news.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.newsEmptyTitle} text={m.newsEmptyText} paths={ICON.mega} />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.newsCount.replace("{n}", String(news.length))} />

            {news.map((a) => (
              <GlassCard key={a.id} radius={22} className="flex flex-col" style={{ padding: 13, gap: 8 }}>
                <div className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span className="min-w-0 flex-1" style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
                    {a.title}
                  </span>
                  {a.is_pinned ? <StatusChip label={m.newsPinned} family="orange" fontSize={8.5} /> : null}
                </div>

                <p style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "16px", color: ink2, whiteSpace: "pre-wrap" }}>
                  {a.body}
                </p>

                <div className="flex items-center" style={{ gap: 8, paddingTop: 6, borderTop: `1px solid ${DIVIDER}` }}>
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                    {a.authorName ?? m.newsAuthorFallback}
                  </span>
                  <span className="shrink-0" style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                    {formatDateLong(a.created_at)}
                  </span>
                </div>
              </GlassCard>
            ))}
          </>
        )}
      </ScreenScroll>
    </div>
  );
}
