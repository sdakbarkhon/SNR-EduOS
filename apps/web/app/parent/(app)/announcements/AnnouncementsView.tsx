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
 *  • фильтры по РЕАЛЬНОЙ колонке `category`, а не по выдуманному набору.
 *
 * 12.08.2026 — подписи категорий, фильтров и пустых состояний переехали в
 * словарь (`parentApp.ann`), дата собирается на языке экрана (`_ui/dates`).
 * До этого экран был русским при любом выбранном языке, и из-за этого
 * «Новости школы» пришлось рисовать упрощённой карточкой. Теперь карточка
 * одна на два экрана — `AnnouncementCard` экспортируется.
 */

import { useMemo, useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, Glyph, ICON, SegmentPills, StatusChip, grad135 } from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { useDates } from "../_ui/dates";
import { glassBorder, ink1, ink2, ink3, type StatusKey } from "../v2/tokens";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  /** Сырой ISO: подпись даты зависит от языка, а язык знает только клиент. */
  createdAt: string;
  authorName: string | null;
  isFromAdmin: boolean;
  isPinned: boolean;
  /** `announcements.category` — general | academic | event | urgent | reminder. */
  category: string;
};

type AnnDict = ReturnType<typeof getDictionary>["parentApp"]["ann"];

/** category → ключ подписи в словаре + семейство статус-цветов токенов.
 *  Цвета остаются здесь (это оформление), подписи — в словаре. */
const CATEGORY_META: Record<
  string,
  { key: keyof AnnDict; family: StatusKey; hero: [string, string] }
> = {
  urgent: { key: "catUrgent", family: "red", hero: ["rgba(244,63,94,0.24)", "rgba(251,146,60,0.24)"] },
  event: { key: "catEvent", family: "green", hero: ["rgba(16,185,129,0.22)", "rgba(14,165,233,0.22)"] },
  academic: { key: "catAcademic", family: "blue", hero: ["rgba(59,130,246,0.22)", "rgba(34,211,238,0.22)"] },
  reminder: { key: "catReminder", family: "orange", hero: ["rgba(251,191,36,0.24)", "rgba(249,115,22,0.22)"] },
  general: { key: "catGeneral", family: "violet", hero: ["rgba(124,58,237,0.22)", "rgba(34,211,238,0.22)"] },
};

const FALLBACK_META = CATEGORY_META.general!;

type Filter = "all" | "urgent" | "event" | "academic";

const FILTER_KEYS: { key: Filter; label: keyof AnnDict }[] = [
  { key: "all", label: "filterAll" },
  { key: "urgent", label: "filterUrgent" },
  { key: "event", label: "filterEvent" },
  { key: "academic", label: "filterAcademic" },
];

export function AnnouncementsView({ items }: { items: AnnouncementItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { locale } = useLocale();
  const ann = getDictionary(locale as Locale).parentApp.ann;

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((a) => a.category === filter)),
    [filter, items],
  );

  const activeIndex = Math.max(0, FILTER_KEYS.findIndex((f) => f.key === filter));

  return (
    <div className="flex flex-col" style={{ gap: 11 }}>
      <SegmentPills
        items={FILTER_KEYS.map((f) => ann[f.label])}
        activeIndex={activeIndex}
        onChange={(i) => setFilter(FILTER_KEYS[i]?.key ?? "all")}
      />

      {shown.length === 0 ? (
        <GlassCard>
          <EmptyState
            title={items.length === 0 ? ann.emptyTitle : ann.emptyFilterTitle}
            text={items.length === 0 ? ann.emptyText : ann.emptyFilterText}
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

/**
 * Карточка объявления — общая для «Объявлений» и «Новостей от администрации».
 * Экспортируется намеренно: второй экран показывает те же записи, только
 * отфильтрованные по автору, и своя копия карточки там разошлась бы с этой.
 */
export function AnnouncementCard({ row }: { row: AnnouncementItem }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const ann = d.ann;
  const dt = useDates();
  const meta = CATEGORY_META[row.category] ?? FALLBACK_META;

  return (
    <GlassCard radius={22} className="flex flex-col" style={{ padding: 13, gap: 10 }}>
      {/* Бэдж-тип + дата. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <StatusChip label={ann[meta.key]} family={meta.family} />
          {row.isPinned ? <StatusChip label={d.more.newsPinned} family="orange" fontSize={8.5} /> : null}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>{dt.long(row.createdAt)}</span>
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
          {row.authorName ?? (row.isFromAdmin ? d.more.newsAuthorFallback : ann.authorSchool)}
        </span>
        {row.isFromAdmin ? <StatusChip label={ann.adminChip} family="gray" fontSize={8.5} /> : null}
      </div>
    </GlassCard>
  );
}
