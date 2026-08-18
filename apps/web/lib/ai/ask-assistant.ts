/**
 * Единственный способ поговорить с помощником из браузера.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. Помощников было два, и они спорили: чат в уроке ходил в
 * /api/ai/chat с номером урока, а общий помощник и плавающая кнопка — в
 * серверное действие callAiChat, куда урок не передавался ВООБЩЕ. Поэтому,
 * открыв плавающую кнопку внутри урока, ученик получал ответ без темы и
 * предмета, и модель называла тему по догадке — та самая «чужая тема», которую
 * чинили трижды не в том механизме.
 *
 * Теперь поверхность одна: все три места зовут один маршрут. Есть номер урока —
 * помощник в режиме урока и знает про него всё; нет — обычный помощник.
 * Счётчик приходит в том же ответе, поэтому число везде одно по построению.
 */

export type AskResult =
  | { ok: true; text: string; remaining: number; limit: number }
  | { ok: false; reason: "limit_reached" | "failed" };

export async function askAssistant(input: {
  message: string;
  /** Номер текущего урока. null — обычный помощник вне урока. */
  lessonId?: string | null;
  /** Текущий этап урока, если ученик стоит на нём. */
  stageId?: string | null;
}): Promise<AskResult> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_id: input.lessonId ?? null,
        stage_id: input.stageId ?? null,
        user_message: input.message,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      text?: string; remaining?: number; limit?: number; error?: string;
    };
    if (!res.ok) {
      return { ok: false, reason: res.status === 429 ? "limit_reached" : "failed" };
    }
    return {
      ok: true,
      text: json.text ?? "",
      remaining: json.remaining ?? 0,
      limit: json.limit ?? 0,
    };
  } catch (e) {
    console.error("[askAssistant] запрос не прошёл:", e);
    return { ok: false, reason: "failed" };
  }
}
