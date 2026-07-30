import { notFound, redirect } from "next/navigation";
import { GlassCard } from "../../v2/GlassCard";
import { EmptyState, Glyph, GlassCircleButton, InnerHeader, ScreenScroll } from "../../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON } from "../../_ui/screen-tokens";
import { ink1 } from "../../v2/tokens";
import { parentThreadMessages, parentToday } from "@/lib/parent-queries";
import { dayDivider, formatTime, previousDay, tashkentDay } from "../../_ui/format";
import {
  getAuthUserId,
  parentThreadParticipantNames,
  parentThreadVMs,
  pickSupportThread,
} from "../../_ui/threads";
import { ChatView, type ChatBubbleItem } from "./ChatView";

/**
 * Переписка родителя. Один реальный тред `chat_threads` + его сообщения.
 *
 * Особый id `support` — точка входа пункта «Помощь и поддержка» из профиля:
 * конкретного id у поддержки нет, поэтому он резолвится в ближайший подходящий
 * тред (admin_ai → по названию → групповой) и страница делает redirect на
 * настоящий /parent/chat/<id>. Если поддержки в БД нет вовсе — показываем
 * честное пустое состояние, а не 404.
 */
export default async function ParentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const today = parentToday();
  const yesterday = previousDay(today);

  const threads = await parentThreadVMs(today);

  // ── Псевдо-тред «поддержка» ──
  if (id === "support") {
    const support = pickSupportThread(threads);
    if (support) redirect(`/parent/chat/${support.id}`);
    return (
      <div className="mx-auto w-full max-w-[430px]">
        <InnerHeader
          title="Помощь и поддержка"
          backHref="/parent/profile"
          right={
            <GlassCircleButton href="/parent/announcements" ariaLabel="Объявления школы">
              <Glyph paths={ICON.mega} size={16} color={ink1} strokeWidth={1.8} />
            </GlassCircleButton>
          }
        />
        <ScreenScroll>
          <GlassCard>
            <EmptyState
              title="Чат поддержки ещё не открыт"
              text="Администрация школы пока не создала чат поддержки для вашей семьи. Обратитесь к классному руководителю — его чат виден в разделе «Сообщения»."
              paths={ICON.help}
            />
          </GlassCard>
        </ScreenScroll>
      </div>
    );
  }

  const thread = threads.find((t) => t.id === id);
  if (!thread) notFound();

  const [messages, myUserId, participantNames] = await Promise.all([
    parentThreadMessages(id),
    getAuthUserId(),
    parentThreadParticipantNames(id),
  ]);

  // Разделитель дня ставится перед первым сообщением каждой новой даты —
  // ровно как в мобильном ChatScreen (там он был один, потому что фикстура
  // умещалась в один день).
  let prevDay: string | null = null;
  const bubbles: ChatBubbleItem[] = messages
    .filter((m) => !m.deleted_at)
    .map((m) => {
      const day = tashkentDay(m.created_at);
      const divider = day === prevDay ? null : dayDivider(m.created_at, today, yesterday);
      prevDay = day;
      return {
        id: m.id,
        own: myUserId !== null && m.sender_id === myUserId,
        body: m.body,
        timeLabel: formatTime(m.created_at),
        dayDivider: divider,
        authorName: m.sender_id ? participantNames[m.sender_id] ?? null : null,
      };
    });

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]!.id : null;

  return (
    <ChatView
      header={{
        threadId: thread.id,
        name: thread.name,
        initials: thread.initials,
        gradient: thread.gradient,
        roleLabel: thread.roleLabel,
        subjectLabel: thread.subjectLabel,
      }}
      messages={bubbles}
      isGroup={thread.kind === "group"}
      lastMessageId={lastMessageId}
    />
  );
}
