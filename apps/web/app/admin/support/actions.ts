"use server";

/**
 * Действия раздела «Поддержка» админки.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ app/admin/actions.ts. Тот файл — общий для
 * восьми экранов и уже перевалил за полторы тысячи строк; поддержка живёт
 * своим экраном и своим набором из двух действий. Тот же порядок, что у
 * родительского чата (app/parent/(app)/chat/[id]/actions.ts).
 *
 * ОТКАЗЫ — ЗНАЧЕНИЕМ, а не броском: в боевой сборке Next подменяет текст
 * брошенной ошибки заглушкой, и админ увидел бы английскую фразу про
 * «Server Components render» вместо причины. Порядок принят в проекте,
 * см. шапку lib/action-result.ts.
 */

import { revalidatePath } from "next/cache";
import { markThreadRead, sendChatMessage } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/action-result";

/** Админ школы и его школа. Отказ — если зовёт кто угодно другой. */
async function verifySupportAdmin(): Promise<{ schoolId: string; userId: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (sb as any)
    .from("admins").select("school_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new Error("Not admin");
  return { schoolId: admin.school_id as string, userId: user.id };
}

/**
 * Комната обращения — ТОЛЬКО из своей школы и ТОЛЬКО вида support.
 *
 * Проверка не лишняя, хотя правило доступа и так сузит до своей школы:
 * без неё админ мог бы послать сюда идентификатор ЛЮБОГО чата своей школы —
 * включая личную переписку ученик↔учитель, которую миграция 142 открыла ему
 * на чтение ради надзора. Писать в неё он не должен, и раздел поддержки не
 * станет для этого лазейкой.
 */
async function assertSupportThread(threadId: string): Promise<void> {
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread } = await (sb as any)
    .from("chat_threads").select("id, kind").eq("id", threadId).maybeSingle();
  if (!thread) throw new Error("SUPPORT_THREAD_NOT_FOUND");
  if (thread.kind !== "support") throw new Error("SUPPORT_THREAD_WRONG_KIND");
}

/** Ответ админа в обращение. Отправка — существующим sendChatMessage. */
export async function actionReplySupport(formData: FormData) {
  return guard(async () => {
    await verifySupportAdmin();
    const threadId = String(formData.get("thread_id") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!threadId) throw new Error("SUPPORT_THREAD_NOT_FOUND");
    if (!body) throw new Error("SUPPORT_EMPTY_BODY");
    await assertSupportThread(threadId);

    const db = await createClient();
    const saved = await sendChatMessage(db, threadId, body);
    revalidatePath("/admin/support");
    return { id: saved.id };
  });
}

/** Отметить обращение прочитанным. Без этого счётчик непрочитанного стал бы
 *  красным кружком, ведущим в никуда. */
export async function actionMarkSupportRead(threadId: string, lastMessageId: string | null) {
  return guard(async () => {
    await verifySupportAdmin();
    if (!threadId || !lastMessageId) return { ok: true };
    await assertSupportThread(threadId);
    const db = await createClient();
    await markThreadRead(db, threadId, lastMessageId);
    revalidatePath("/admin/support");
    return { ok: true };
  });
}
