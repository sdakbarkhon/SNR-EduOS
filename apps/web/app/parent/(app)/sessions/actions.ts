"use server";

import { revalidatePath } from "next/cache";
import { endSession, type EndSessionResult } from "@snr/core";
import { createClient } from "@/lib/supabase/server";

/**
 * Закрыть один свой вход в аккаунт.
 *
 * Своей проверки прав здесь нет и не нужно: `end_session` (миграция 199)
 * берёт пользователя из токена и удаляет строку только с его user_id и только
 * не текущую. Служебный ключ не используется — экшен ходит обычным клиентом
 * вошедшего, как и все остальные действия родителя.
 */
export async function endParentSession(
  sessionId: string,
): Promise<{ ok: true; result: EndSessionResult } | { ok: false }> {
  const db = await createClient();
  let result: EndSessionResult;
  try {
    result = await endSession(db, sessionId);
  } catch (e) {
    console.error("[endParentSession] не удалось закрыть сеанс:", e);
    return { ok: false };
  }
  revalidatePath("/parent/sessions");
  return { ok: true, result };
}
