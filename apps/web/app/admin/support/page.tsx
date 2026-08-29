/**
 * Раздел «Поддержка» админки — рабочий ящик, а НЕ надзорная витрина.
 *
 * ПОЧЕМУ НЕ НА /admin/chats. Тот экран показывает все переписки школы, включая
 * личные ученик↔учитель: миграция 142 открыла их админу ради надзора, и он там
 * только читает. Смешивать надзор с ящиком, куда отвечают каждый день,
 * неправильно: у них разный смысл, разная частота и разная цена ошибки.
 * Поэтому отдельный раздел, и /admin/chats не тронут ни строкой.
 *
 * ПОЧЕМУ СПИСОК И ПЕРЕПИСКА НА ОДНОЙ СТРАНИЦЕ. Выбранное обращение приезжает
 * адресом (?thread=...), а не состоянием на клиенте: тогда страница
 * серверная целиком, сообщения грузятся тем же заходом, что и список, а
 * revalidatePath после ответа обновляет обе половины разом.
 *
 * КОМНАТ МОЖЕТ НЕ БЫТЬ ВОВСЕ. Их создаёт первый вызов родителем
 * (fn_ensure_support_thread, миграция 234). Пустой список — верное состояние,
 * а не поломка, и говорит об этом словами.
 */
import { createClient } from "@/lib/supabase/server";
import { getSupportThreadsForAdmin, getThreadMessages } from "@snr/core";
import { AdminSupportView } from "./AdminSupportView";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const db = await createClient();
  const { thread: askedThread } = await searchParams;

  let threads: Awaited<ReturnType<typeof getSupportThreadsForAdmin>> = [];
  try {
    threads = await getSupportThreadsForAdmin(db);
  } catch (e) {
    // Не роняем раздел из-за списка: пустой экран с текстом лучше, чем
    // страница ошибки. Причина уходит в журнал сервера.
    console.error("[AdminSupportPage] getSupportThreadsForAdmin failed:",
      (e as { message?: string })?.message ?? e);
  }

  // ОТКРЫТО ТОЛЬКО ТО, ЧТО ПОПРОСИЛИ АДРЕСОМ. Самое свежее НЕ открывается
  // само, хотя так было бы привычнее по почтовым программам. Причина: открытое
  // обращение экран сразу помечает прочитанным, и админ, заглянувший в раздел
  // и ушедший, гасил бы значок непрочитанного, ничего не прочитав. Значок,
  // погасший без прочтения, вреднее лишнего клика.
  const active = askedThread ? threads.find((t) => t.id === askedThread) ?? null : null;

  let messages: Awaited<ReturnType<typeof getThreadMessages>> = [];
  if (active) {
    try {
      messages = await getThreadMessages(db, active.id);
    } catch (e) {
      console.error("[AdminSupportPage] getThreadMessages failed:",
        (e as { message?: string })?.message ?? e);
    }
  }

  // Имя отправителя у каждого сообщения — решение заказчика: родитель должен
  // понимать, кто из админов ему отвечает, а админ — видеть, что ответил
  // коллега. Имена уже разрешены общим слоем через chat_parent_names и
  // chat_admin_names, здесь только раскладываем по идентификатору.
  const nameByUserId: Record<string, string> = {};
  const roleByUserId: Record<string, string> = {};
  for (const p of active?.participants ?? []) {
    nameByUserId[p.user_id] = p.full_name;
    roleByUserId[p.user_id] = p.role_in_thread;
  }

  return (
    <AdminSupportView
      threads={threads.map((t) => ({
        id: t.id,
        parentName: t.parentName,
        updatedAt: t.updatedAt,
        unreadCount: t.unreadCount,
        lastBody: t.lastMessage?.body ?? null,
        lastSenderName: t.lastMessage?.senderName ?? null,
        lastAt: t.lastMessage?.created_at ?? null,
      }))}
      activeId={active?.id ?? null}
      activeParentName={active?.parentName ?? null}
      messages={messages.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at,
      }))}
      nameByUserId={nameByUserId}
      roleByUserId={roleByUserId}
    />
  );
}
