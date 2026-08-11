import { parentNotifications, parentToday } from "@/lib/parent-queries";
import { GlassCircleButton, Glyph, InnerHeader, ScreenScroll } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON } from "../_ui/screen-tokens";
import { previousDay, relativeStamp, tashkentDay } from "../_ui/format";
import { ink1 } from "../v2/tokens";
import { NotificationsView, type NotificationItem } from "./NotificationsView";

/**
 * «Уведомления» — реальная таблица `notifications` (RLS: только свои).
 *
 * `notifications.link` рассчитан на ученический веб (`/homework`, `/grades` …)
 * и в родительском приложении ведёт «не туда», поэтому переход выбирается по
 * `kind` и указывает на РОДИТЕЛЬСКИЕ маршруты. Виды, для которых у родителя
 * подходящего экрана нет, остаются некликабельными — лучше, чем увести на
 * чужой раздел.
 */
const HREF_BY_KIND: Record<string, string> = {
  announcement: "/parent/announcements",
  new_grade: "/parent/progress",
  homework_graded: "/parent/progress",
};

export default async function ParentNotificationsPage() {
  const today = await parentToday();
  const yesterday = previousDay(today);
  const rows = await parentNotifications(50);

  const items: NotificationItem[] = rows.map((n) => {
    const day = tashkentDay(n.created_at);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      timeLabel: relativeStamp(n.created_at, today, yesterday),
      isRead: n.is_read,
      kind: n.kind,
      href: HREF_BY_KIND[n.kind] ?? null,
      bucket: day === today ? "today" : day === yesterday ? "yesterday" : "earlier",
    };
  });

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader
        title="Уведомления"
        backHref="/parent/home"
        right={
          <GlassCircleButton href="/parent/notif-settings" ariaLabel="Настройки уведомлений">
            <Glyph paths={ICON.kebab} size={16} color={ink1} strokeWidth={2.2} />
          </GlassCircleButton>
        }
      />
      <ScreenScroll gap={11}>
        <NotificationsView items={items} />
      </ScreenScroll>
    </div>
  );
}
