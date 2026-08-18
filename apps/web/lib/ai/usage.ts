// Server-side only. Учёт расходов на модель: один вызов — одна строка в
// ai_usage_events (миграция 209).
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Запись должна быть в ОДНОМ месте, иначе через полгода
// половина вызовов считается, а половина нет — ровно так и вышло со старым
// счётчиком обращений. Здесь единственная функция записи; кто угодно её
// вызывает, но копий её нет. Общий клиент (gemini-client) зовёт её сам, а трём
// местам, которые ходят к модели мимо него (проверка ДЗ, генерация содержимого
// урока, векторы), достаётся тот же вызов, а не своя реализация.
//
// ГЛАВНОЕ ПРАВИЛО. Учёт не имеет права ронять саму AI-функцию. Здесь нет ни
// одного await наружу и ни одного throw: промис не ожидается, обе ветки
// (.then с error и .catch) только пишут в лог. Если Supabase недоступен —
// ученик всё равно получит ответ, а мы потеряем строку статистики. Это
// правильный размен, а не недосмотр.

import { createAdminClient } from "@/lib/supabase/admin";

/** Виды задач. Текст, а не enum в базе: новый вид не должен требовать
 *  миграции. Значение приходит ИЗ МЕСТА ВЫЗОВА — общий клиент не может знать,
 *  чем занят вызывающий, и угадывать по промпту было бы враньём. */
export const AI_TASKS = {
  /** Ответ помощника ученику (общий чат и чат внутри урока). */
  assistantChat: "assistant_chat",
  /** Генерация этапов урока. */
  generateStages: "generate_stages",
  /** Генерация домашнего задания. */
  generateHomework: "generate_homework",
  /** Теория/практика/тест для урока. */
  lessonContent: "lesson_content",
  /** Разбор загруженного учебного плана. */
  curriculumParse: "curriculum_parse",
  /** Проверка домашней работы ученика. */
  homeworkReview: "homework_review",
  /** Промпт для картинки к этапу. */
  stageImage: "stage_image",
  /** Факт дня. */
  dailyFact: "daily_fact",
  /** Сводка для родителя. */
  parentInsight: "parent_insight",
  /** Векторы для поиска по материалам. */
  embeddings: "embeddings",
  /** Совет по учёбе на главной. */
  studyTip: "study_tip",
  /** Совет по оценкам. */
  gradesAdvice: "grades_advice",
  /** Место вызова не подписалось. Не должно встречаться; если встретилось —
   *  значит появился новый вызов модели, который забыли назвать. */
  other: "other",
} as const;

export type AiTask = (typeof AI_TASKS)[keyof typeof AI_TASKS];

/** Все значения — для фильтра на экране отчёта, чтобы список не пришлось
 *  дублировать руками. */
export const AI_TASK_VALUES = Object.values(AI_TASKS) as AiTask[];

/** Токены, как их отдаёт провайдер. */
export type TokenUsage = {
  input: number | null;
  output: number | null;
  total: number | null;
};

/** Кто и в какой школе инициировал вызов. Всё необязательно: часть вызовов
 *  идёт вне школьного контекста (разбор файла до привязки, служебные прогоны),
 *  и терять такую запись из-за отсутствия школы хуже, чем записать без неё. */
export type AiCallContext = {
  task: AiTask;
  schoolId?: string | null;
  studentId?: string | null;
  teacherId?: string | null;
};

/** Достаёт счётчик токенов из ответа Gemini.
 *
 *  ПРОВЕРЕНО: SDK @google/generative-ai@0.24.1 отдаёт usageMetadata с полями
 *  promptTokenCount / candidatesTokenCount / totalTokenCount
 *  (generative-ai.d.ts:1386-1390). Поле опциональное — при отказе его может не
 *  быть вовсе, и тогда возвращается null, а не нули: ноль означал бы «вызов
 *  был бесплатным», что неправда. */
export function readUsage(response: unknown): TokenUsage | null {
  const meta = (response as { usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } })?.usageMetadata;
  if (!meta) return null;
  const input = meta.promptTokenCount ?? null;
  const output = meta.candidatesTokenCount ?? null;
  return {
    input,
    output,
    // totalTokenCount у Gemini включает и «мысли» модели, поэтому он может быть
    // больше суммы двух видимых счётчиков — берём как есть, а не пересчитываем.
    total: meta.totalTokenCount ?? (input != null && output != null ? input + output : null),
  };
}

/** Записать один вызов модели. Ничего не возвращает и никогда не бросает —
 *  вызывать без await. */
export function recordAiCall(input: AiCallContext & {
  model: string;
  usage?: TokenUsage | null;
  ok: boolean;
  /** Короткая причина отказа — то же сообщение, что уходит пользователю. */
  errorReason?: string | null;
  durationMs?: number | null;
}): void {
  try {
    const row = {
      task: input.task,
      model: input.model,
      input_tokens: input.usage?.input ?? null,
      output_tokens: input.usage?.output ?? null,
      total_tokens: input.usage?.total ?? null,
      school_id: input.schoolId ?? null,
      // Ограничение в базе не даёт заполнить обоих разом; если место вызова
      // всё же передало двоих, честнее записать без человека, чем потерять всю
      // строку на нарушении ограничения.
      student_id: input.teacherId ? null : (input.studentId ?? null),
      teacher_id: input.studentId ? null : (input.teacherId ?? null),
      ok: input.ok,
      error_reason: input.errorReason ? input.errorReason.slice(0, 500) : null,
      duration_ms: input.durationMs ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((createAdminClient() as any).from("ai_usage_events").insert(row) as Promise<{ error: { message: string } | null }>)
      .then(({ error }) => {
        if (error) console.error("[ai-usage] запись не удалась:", error.message);
      })
      .catch((e: unknown) => {
        console.error("[ai-usage] запись упала:", (e as Error)?.message);
      });
  } catch (e) {
    console.error("[ai-usage] запись не запустилась:", (e as Error)?.message);
  }
}
