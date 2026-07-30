"use server";

import { revalidatePath } from "next/cache";
import { markThreadRead, sendChatMessage } from "@snr/core";
import { createClient } from "@/lib/supabase/server";

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
