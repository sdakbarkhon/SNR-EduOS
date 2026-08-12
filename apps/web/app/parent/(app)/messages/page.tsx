import { parentAnnouncements, parentToday } from "@/lib/parent-queries";
import { parentThreadVMs } from "../_ui/threads";
import { previewOf } from "../_ui/format";
import { MessagesView, type MessagesAnnouncementItem, type MessagesThreadItem } from "./MessagesView";

/**
 * «Сообщения» — реальные чаты родителя + реальные объявления школы.
 *
 * Данные тянутся здесь, на сервере: `parentThreads()` (RLS уже сузила треды
 * до тех, где родитель — участник) и `parentAnnouncements()`. Клиентскому
 * компоненту уезжают уже готовые строки — время/даты форматируются один раз
 * по Ташкенту, иначе гидратация разошлась бы с сервером.
 *
 * Экран не зависит от выбранного ребёнка (как и в мобилке): чаты и объявления
 * привязаны к родителю, а не к ученику.
 */
export default async function ParentMessagesPage() {
  const today = await parentToday();

  const [threads, announcements] = await Promise.all([
    parentThreadVMs(),
    parentAnnouncements(20),
  ]);

  const threadItems: MessagesThreadItem[] = threads.map((t) => ({
    id: t.id,
    name: t.name,
    roleLabel: t.roleLabel,
    stampIso: t.stampIso,
    preview: t.preview,
    unread: t.unread,
    initials: t.initials,
    gradient: t.gradient,
  }));

  const announcementItems: MessagesAnnouncementItem[] = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    preview: previewOf(a.body, 140),
    createdAt: a.created_at,
    isPinned: a.is_pinned,
  }));

  return <MessagesView threads={threadItems} announcements={announcementItems} today={today} />;
}
