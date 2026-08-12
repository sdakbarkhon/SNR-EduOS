"use client";

/**
 * Разметка «От администрации».
 *
 * Карточка — ТА ЖЕ, что на «Объявлениях» (`AnnouncementCard`), а не своя
 * копия. Изначально здесь была упрощённая: у карточки объявлений подписи
 * категорий были вписаны по-русски, и тащить её на трёхъязычный экран было
 * нельзя. 12.08.2026 те подписи переехали в словарь — причина отпала, и
 * второй вид карточки убран, чтобы два экрана с одними и теми же записями не
 * выглядели по-разному.
 *
 * Отличие экрана от «Объявлений» только в отборе: здесь лишь записи с
 * автором-администратором (фильтр в parentAdminNews) и нет вкладок-категорий.
 */

import type { Locale, ParentAnnouncement } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll, SectionCap } from "../_ui/screen-kit";
import { AnnouncementCard, type AnnouncementItem } from "../announcements/AnnouncementsView";

export function NewsView({ news }: { news: ParentAnnouncement[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;

  const items: AnnouncementItem[] = news.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    createdAt: a.created_at,
    authorName: a.authorName,
    isFromAdmin: a.isFromAdmin,
    isPinned: a.is_pinned,
    category: a.category,
  }));

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.adminNews} backHref="/parent/messages" />

      <ScreenScroll gap={11}>
        {items.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.newsEmptyTitle} text={m.newsEmptyText} paths={ICON.mega} />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.newsCount.replace("{n}", String(items.length))} />
            {items.map((a) => (
              <AnnouncementCard key={a.id} row={a} />
            ))}
          </>
        )}
      </ScreenScroll>
    </div>
  );
}
