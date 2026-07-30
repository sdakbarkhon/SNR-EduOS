"use client";

/**
 * Экран d26 «Объявления» — веб-порт
 * apps/mobile-parent/src/screens/messages/AnnouncementsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 801–839), но на реальной таблице
 * `announcements` (RLS для родителя открыта миграцией 126).
 *
 * Что от макета осталось: SegmentPills-фильтр, карточка r22 с бэджем-типом и
 * датой, hero-градиент 104h, title 13.5/800, body 10.5/600, футер с автором.
 *
 * Чего нет и почему:
 *  • счётчиков просмотров/комментариев — таких колонок в БД не существует,
 *    рисовать выдуманные числа на реальном экране нельзя;
 *  • картинок-обложек — вложений у объявления нет, поэтому hero остаётся
 *    декоративным градиентом (как и в макете, где это был плейсхолдер);
 *  • фильтры теперь по РЕАЛЬНОЙ колонке `category`, а не по выдуманному
 *    набору «Важные / Мероприятия / Информация».
 */

import { useMemo, useState } from "react";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, Glyph, ICON, SegmentPills, StatusChip, grad135 } from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { glassBorder, ink1, ink2, ink3, type StatusKey } from "../v2/tokens";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  authorName: string | null;
  isFromAdmin: boolean;
  isPinned: boolean;
  /** `announcements.category` — general | academic | event | urgent | reminder. */
  category: string;
};

/** category → подпись бэджа + семейство статус-цветов токенов. */
const CATEGORY_META: Record<string, { label: string; family: StatusKey; hero: [string, string] }> = {
  urgent: { label: "Срочно", family: "red", hero: ["rgba(244,63,94,0.24)", "rgba(251,146,60,0.24)"] },
  event: { label: "Мероприятие", family: "green", hero: ["rgba(16,185,129,0.22)", "rgba(14,165,233,0.22)"] },
  academic: { label: "Учёба", family: "blue", hero: ["rgba(59,130,246,0.22)", "rgba(34,211,238,0.22)"] },
  reminder: { label: "Напоминание", family: "orange", hero: ["rgba(251,191,36,0.24)", "rgba(249,115,22,0.22)"] },
  general: { label: "Информация", family: "violet", hero: ["rgba(124,58,237,0.22)", "rgba(34,211,238,0.22)"] },
};

const FALLBACK_META = CATEGORY_META.general!;

type Filter = "all" | "urgent" | "event" | "academic";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "urgent", label: "Срочные" },
  { key: "event", label: "События" },
  { key: "academic", label: "Учёба" },
];

export function AnnouncementsView({ items }: { items: AnnouncementItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((a) => a.category === filter)),
    [filter, items],
  );

  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.key === filter));

  return (
    <div className="flex flex-col" style={{ gap: 11 }}>
      <SegmentPills
        items={FILTERS.map((f) => f.label)}
        activeIndex={activeIndex}
        onChange={(i) => setFilter(FILTERS[i]?.key ?? "all")}
      />

      {shown.length === 0 ? (
        <GlassCard>
          <EmptyState
            title={items.length === 0 ? "Объявлений пока нет" : "В этой категории пусто"}
            text={
              items.length === 0
                ? "Здесь появятся новости школы и класса вашего ребёнка."
                : "Попробуйте другую вкладку."
            }
            paths={ICON.mega}
          />
        </GlassCard>
      ) : null}

      {shown.map((a) => (
        <AnnouncementCard key={a.id} row={a} />
      ))}
    </div>
  );
}

function AnnouncementCard({ row }: { row: AnnouncementItem }) {
  const meta = CATEGORY_META[row.category] ?? FALLBACK_META;

  return (
    <GlassCard radius={22} className="flex flex-col" style={{ padding: 13, gap: 10 }}>
      {/* Бэдж-тип + дата. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <StatusChip label={meta.label} family={meta.family} />
          {row.isPinned ? <StatusChip label="Закреплено" family="orange" fontSize={8.5} /> : null}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>{row.dateLabel}</span>
      </div>

      {/* Hero — декоративный градиент 104h. */}
      <div
        className="flex items-center justify-center"
        style={{
          height: 104,
          borderRadius: 14,
          background: grad135(meta.hero),
          // Рамка стекла, а не «белая линия»: в тёмной теме glassBorder сам
          // становится еле заметным W16, иначе hero светился белым контуром.
          border: `1px solid ${glassBorder}`,
        }}
      >
        <Glyph paths={ICON.mega} size={26} color={ink3} strokeWidth={1.7} />
      </div>

      <span style={{ fontSize: 13.5, fontWeight: 800, color: ink1 }}>{row.title}</span>

      <p style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "16px", color: ink2, whiteSpace: "pre-wrap" }}>
        {row.body}
      </p>

      {/* Футер: hairline + автор. */}
      <div
        className="flex items-center gap-2"
        style={{ paddingTop: 6, borderTop: `1px solid ${DIVIDER}` }}
      >
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
          {row.authorName ?? (row.isFromAdmin ? "Администрация школы" : "Школа")}
        </span>
        {row.isFromAdmin ? <StatusChip label="Администрация" family="gray" fontSize={8.5} /> : null}
      </div>
    </GlassCard>
  );
}
