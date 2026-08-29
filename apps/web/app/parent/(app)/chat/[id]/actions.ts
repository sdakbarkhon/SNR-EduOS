"use server";

import { revalidatePath } from "next/cache";
import { ensureSupportThread, getSupportThread, markThreadRead, sendChatMessage } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/action-result";

/**
 * Отправка сообщения родителем в существующий тред.
 *
 * Никакой собственной проверки прав здесь нет и не нужно: `chat_messages`
 * закрыта RLS «писать может только участник треда», поэтому попытка отправить
 * в чужой тред вернётся ошибкой от Postgres, а не молча пройдёт. sender_id
 * подставляет сам core из auth-сессии.
 */
export async function sendParentMessage(
  threadId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Пустое сообщение" };

  const db = await createClient();
  try {
    await sendChatMessage(db, threadId, text);
  } catch (e) {
    console.error("[sendParentMessage] отправка не удалась:", e);
    return { ok: false, error: "Не удалось отправить сообщение" };
  }

  revalidatePath(`/parent/chat/${threadId}`);
  revalidatePath("/parent/messages");
  return { ok: true };
}

/** Отметить тред прочитанным — сбрасывает бейдж непрочитанных на /parent/messages. */
export async function markParentThreadRead(threadId: string, lastMessageId: string): Promise<void> {
  const db = await createClient();
  try {
    await markThreadRead(db, threadId, lastMessageId);
  } catch (e) {
    // Не критично: счётчик просто останется на месте до следующего захода.
    console.error("[markParentThreadRead] не удалось отметить прочитанным:", e);
    return;
  }
  revalidatePath("/parent/messages");
}

/**
 * Начать переписку с поддержкой из веба.
 *
 * ПОЧЕМУ КОМНАТА ЗАВОДИТСЯ ЗДЕСЬ, А НЕ ПРИ ОТКРЫТИИ ЭКРАНА. Порядок тот же,
 * что в мобильном, и он согласован: `fn_ensure_support_thread` создаёт
 * комнату и вписывает всех админов школы. Зови её на открытии — и у каждого,
 * кто просто заглянул в раздел, заведётся пустая комната, а список обращений
 * у админа забьётся пустышками, среди которых потеряются настоящие.
 *
 * ЕСЛИ АДМИНОВ В ШКОЛЕ НЕТ — не отправляем и говорим словами. Узнать это ДО
 * создания комнаты нельзя: таблицу `admins` родитель не читает вовсе, а имена
 * приходят через `chat_admin_names`, которое отдаёт только тех, с кем ты уже
 * в одной комнате. Поэтому порядок: завести комнату → посмотреть состав → и
 * только потом отправлять. Комната при этом остаётся: триггер из миграции 234
 * впишет туда первого же появившегося админа, и он увидит эту переписку.
 *
 * ПРО school_id У СООБЩЕНИЯ. У колонки умолчание `current_school_id()`, и оно
 * пусто, если `auth.uid()` не выставлен. Здесь клиент — куки-сессия родителя,
 * то есть `auth.uid()` на месте и школа берётся его. Пустой она бывает под
 * служебным ключом (на этом спотыкался прогон прошлого захода), а такого
 * клиента у этого пути нет.
 *
 * Отказ уходит ЗНАЧЕНИЕМ через guard: в боевой сборке Next подменяет текст
 * брошенной ошибки заглушкой, и родитель увидел бы английскую фразу вместо
 * причины (см. шапку lib/action-result.ts).
 */
export async function startParentSupportChat(body: string) {
  return guard(async () => {
    const text = body.trim();
    if (!text) throw new Error("SUPPORT_EMPTY_BODY");

    const db = await createClient();
    const threadId = await ensureSupportThread(db);
    if (!threadId) throw new Error("SUPPORT_NOT_A_PARENT");

    const thread = await getSupportThread(db);
    const hasAdmin = (thread?.participants ?? []).some((p) => p.role_in_thread === "admin");
    if (!hasAdmin) throw new Error("SUPPORT_NO_ADMIN");

    await sendChatMessage(db, threadId, text);
    revalidatePath("/parent/messages");
    revalidatePath(`/parent/chat/${threadId}`);
    // И псевдо-адрес тоже: он теперь обязан уводить в заведённую комнату,
    // а не показывать прежнее пустое состояние из кэша маршрута.
    revalidatePath("/parent/chat/support");
    return { threadId };
  });
}
