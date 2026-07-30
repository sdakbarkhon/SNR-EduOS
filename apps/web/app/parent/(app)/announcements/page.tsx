import { parentAnnouncements } from "@/lib/parent-queries";
import { GlassCircleButton, Glyph, ICON, InnerHeader, ScreenScroll } from "../_ui/screen-kit";
import { formatDateLong } from "../_ui/format";
import { ink1 } from "../v2/tokens";
import { AnnouncementsView, type AnnouncementItem } from "./AnnouncementsView";

/**
 * «Объявления школы» — реальная таблица `announcements` через
 * parentAnnouncements() (RLS: только объявления, адресованные детям этого
 * родителя, миграция 126). Даты форматируются на сервере по Ташкенту.
 */
export default async function ParentAnnouncementsPage() {
  const rows = await parentAnnouncements(50);

  const items: AnnouncementItem[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    dateLabel: formatDateLong(a.created_at),
    authorName: a.authorName,
    isFromAdmin: a.isFromAdmin,
    isPinned: a.is_pinned,
    category: a.category,
  }));

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader
        title="Объявления"
        backHref="/parent/messages"
        right={
          <GlassCircleButton href="/parent/notifications" ariaLabel="Уведомления">
            <Glyph paths={ICON.bell} size={16} color={ink1} strokeWidth={1.8} />
          </GlassCircleButton>
        }
      />
      <ScreenScroll gap={11}>
        <AnnouncementsView items={items} />
      </ScreenScroll>
    </div>
  );
}
