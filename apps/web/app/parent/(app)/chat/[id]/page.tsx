import { notFound, redirect } from "next/navigation";
import { GlassCard } from "../../v2/GlassCard";
import { Glyph, GlassCircleButton, InnerHeader, ScreenScroll } from "../../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON } from "../../_ui/screen-tokens";
import { ink1 } from "../../v2/tokens";
import { parentThreadMessages, parentToday } from "@/lib/parent-queries";
import { tashkentDay } from "../../_ui/format";
import {
  getAuthUserId,
  parentThreadParticipantNames,
  parentThreadVMs,
  pickSupportThread,
} from "../../_ui/threads";
import { ChatView, type ChatBubbleItem } from "./ChatView";
import { SupportStartForm } from "./SupportStartForm";

/**
 * Переписка родителя. Один реальный тред `chat_threads` + его сообщения.
 *
 * Особый id `support` — точка входа пункта «Помощь и поддержка» из профиля.
 * Если комната родителя есть, страница делает redirect на настоящий
 * /parent/chat/<id>.
 *
 * ЕСЛИ КОМНАТЫ НЕТ — предлагаем её ЗАВЕСТИ, а не подсовываем чужую переписку.
 * Раньше pickSupportThread откатывался на личный чат классного руководителя,
 * и «Помощь и поддержка» открывала разговор с учителем под видом поддержки;
 * откат убран 29.08.2026. Комната заводится первым сообщением — тот же
 * порядок, что в мобильном: иначе у каждого заглянувшего появилась бы пустая
 * комната, а список обращений у админа забился бы пустышками.
 */
export default async function ParentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const today = await parentToday();

  const threads = await parentThreadVMs();

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
            {/* Заголовок, пояснение и форма — одним компонентом: иначе
                пояснение печаталось дважды, из EmptyState и из формы. Заодно
                подписи берутся из словаря на языке родителя, а не литералами. */}
            <SupportStartForm />
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
      // Сам разделитель («Сегодня, 23 июля») собирает клиент — здесь только
      // решается, нужен ли он перед этим сообщением.
      const needsDivider = day !== prevDay;
      prevDay = day;
      return {
        id: m.id,
        own: myUserId !== null && m.sender_id === myUserId,
        body: m.body,
        createdAt: m.created_at,
        showDayDivider: needsDivider,
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
      today={today}
    />
  );
}
