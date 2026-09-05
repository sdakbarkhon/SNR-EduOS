// Лимит ИИ-запросов ученика — ОДИН на оба помощника: чат внутри урока
// (/api/ai/chat) и общий помощник по кнопке (callAiChat).
//
// У общего помощника своего лимита когда-то не было: под ним показывался общий
// на всю установку счётчик вызовов Gemini (get_ai_usage_today(), миграция 136)
// — защита от расходов, а не квота ученика. Персональный счётчик один и общий:
// потратил в уроке — общий помощник тоже недоступен, и наоборот.
//
// ═══ 04.09.2026 — ОКНО ДВА ЧАСА ВМЕСТО СУТОК ══════════════════════════════
//
// Было: десять в сутки, счёт от полуночи по Ташкенту. Стало: двадцать на два
// часа.
//
// ═══ 06.09.2026 — ОКНО СКОЛЬЗЯЩЕЕ (миграция 272) ══════════════════════════
//
// Считалось ОТ МОМЕНТА ИСЧЕРПАНИЯ: потратил двадцатый — ждёшь два часа, потом
// снова полные двадцать. Пока двадцатого не было, край окна лежал в минус
// бесконечности, и в счёт шла ВСЯ история ученика: девятнадцать вопросов со
// вчера показывались вечно и не возвращались никогда.
//
// Теперь считаются вопросы за последние два часа, и каждый возвращается через
// два часа после САМОГО СЕБЯ. Задал час назад — через час вернётся сам.
//
// Считает по-прежнему база — fn_ai_window_state. Разбор, почему окно выводится
// из самих сообщений и новой таблицы не нужно, — в шапке миграции 253, и он
// остаётся верным. Заморозка времени школы на счёт не влияет: сюда её не
// подмешиваем.
//
// СЧЁТ ПО ЧЕЛОВЕКУ, А НЕ ПО АДРЕСУ: ключ — student_id. В школе один адрес на
// весь класс, и счёт по адресу означал бы, что один ученик перекрыл кислород
// остальным.
//
// УЧИТЕЛЯ НЕ ОГРАНИЧИВАЕМ. Нет ученической строки — нет и лимита: studentId
// приходит null, вызывающий такой лимит не применяет и счётчика не рисует.

/** Столько запросов доступно ученику на окно — на оба помощника вместе. */
export const STUDENT_AI_LIMIT = 20;

/** Длина окна. Держится и здесь, и в fn_ai_window_state: показ и отказ должны
 *  называть одно и то же число. */
export const STUDENT_AI_WINDOW_HOURS = 2;

export type StudentAiUsage = {
  /** Профиль ученика; null — значит роль не ученическая, лимит не применяется. */
  studentId: string | null;
  used: number;
  remaining: number;
  limit: number;
  /** Когда освободится СЛЕДУЮЩИЙ вопрос (ISO). null — запас есть.
   *  Не «когда вернутся все»: окно скользящее, вопросы возвращаются по одному. */
  blockedUntil: string | null;
};

/** Сколько ученик потратил в текущем окне и сколько осталось.
 *  Для не-учеников (учитель, родитель, админ) возвращает studentId=null —
 *  вызывающий код такой лимит не применяет. */
export async function getStudentAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
): Promise<StudentAiUsage> {
  const { data: student } = await db
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!student?.id) {
    return {
      studentId: null,
      used: 0,
      remaining: STUDENT_AI_LIMIT,
      limit: STUDENT_AI_LIMIT,
      blockedUntil: null,
    };
  }

  const { data: rows } = await db.rpc("fn_ai_window_state", { p_student_id: student.id });
  const row = (Array.isArray(rows) ? rows[0] : rows) as
    | { used?: number; limit_n?: number; blocked_until?: string | null }
    | null
    | undefined;

  const used = typeof row?.used === "number" ? row.used : 0;
  const limit = typeof row?.limit_n === "number" ? row.limit_n : STUDENT_AI_LIMIT;
  return {
    studentId: student.id as string,
    used,
    remaining: Math.max(0, limit - used),
    limit,
    blockedUntil: row?.blocked_until ?? null,
  };
}

/** Запись пары «вопрос — ответ» в ai_chat_messages. Она же и есть счётчик:
 *  fn_ai_window_state считает строки с role='user'.
 *  lessonId = null — разговор с общим помощником, урока у него нет
 *  (миграция 196 сняла NOT NULL с колонки). */
export async function logStudentAiExchange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  params: {
    studentId: string;
    lessonId?: string | null;
    stageId?: string | null;
    question: string;
    answer: string;
  },
): Promise<void> {
  const base = {
    student_id: params.studentId,
    lesson_id: params.lessonId ?? null,
    stage_id: params.stageId ?? null,
  };
  await db.from("ai_chat_messages").insert([
    { ...base, role: "user", content: params.question },
    { ...base, role: "assistant", content: params.answer },
  ]);
}
