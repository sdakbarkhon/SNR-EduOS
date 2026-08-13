// Дневной лимит ИИ-запросов ученика — ОДИН на оба помощника: чат внутри
// урока (/api/ai/chat) и общий помощник по кнопке (callAiChat).
//
// До этого лимит был только у чата в уроке, а у общего помощника своего не
// было: под ним показывался общий на всю установку счётчик вызовов Gemini
// (get_ai_usage_today(), 250 в сутки, миграция 136) — защита от расходов, а
// не квота ученика. Теперь персональный счётчик один, и он общий: потратил
// в уроке — общий помощник тоже недоступен, и наоборот.
//
// Считает по-прежнему база, функцией fn_ai_messages_today() по своим часам
// (now() AT TIME ZONE 'Asia/Tashkent'). Заморозка времени школы на счётчик
// не влияет — сюда мы её и не подмешиваем.

/** Столько ИИ-запросов в сутки доступно одному ученику на оба помощника. */
export const STUDENT_AI_DAILY_LIMIT = 10;

export type StudentAiUsage = {
  /** Профиль ученика; null — значит роль не ученическая, лимит не применяется. */
  studentId: string | null;
  used: number;
  remaining: number;
  limit: number;
};

/** Сколько ученик уже потратил сегодня и сколько осталось.
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
    return { studentId: null, used: 0, remaining: STUDENT_AI_DAILY_LIMIT, limit: STUDENT_AI_DAILY_LIMIT };
  }

  const { data: raw } = await db.rpc("fn_ai_messages_today", { p_student_id: student.id });
  const used = typeof raw === "number" ? raw : 0;
  return {
    studentId: student.id as string,
    used,
    remaining: Math.max(0, STUDENT_AI_DAILY_LIMIT - used),
    limit: STUDENT_AI_DAILY_LIMIT,
  };
}

/** Запись пары «вопрос — ответ» в ai_chat_messages. Она же и есть счётчик:
 *  fn_ai_messages_today() считает строки с role='user'.
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
