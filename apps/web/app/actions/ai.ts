"use server";

import { chat, generateText } from "@/lib/ai/gemini-client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth";
import { computeEmbedding } from "@/lib/ai/embeddings";
import { getMySchoolNow } from "@/lib/school-time-server";
import { getStudentAiUsage, logStudentAiExchange } from "@/lib/ai/student-daily-limit";

const RAG_TOP_K = 5;
// Ниже этого порога совпадение считается нерелевантным — не подмешиваем
// в контекст случайный шум топ-5, если ученик спросил о чём-то, чего в
// его уроках просто нет.
const RAG_SIMILARITY_THRESHOLD = 0.5;

const RAG_NO_CONTEXT_HINT =
  "\n\n(Примечание: специфичных учебных материалов ученика по этому вопросу не найдено — отвечай из общих знаний, не выдавай ответ за официальный материал школы.)";

type RetrievedChunk = {
  lesson_stage_id: string;
  chunk_text: string;
  similarity: number;
  lesson_id: string;
  lesson_topic: string | null;
  starts_at: string;
};

export type AiChatSource = {
  lesson_id: string;
  lesson_topic: string | null;
  starts_at: string;
  similarity: number;
};

type RagContext =
  | { kind: "found"; contextBlock: string; sources: AiChatSource[] }
  | { kind: "no_context" };

/** Пачка 5.1: для студентов подмешивает в systemPrompt релевантные
 *  фрагменты из lesson_stages их группы (RAG) — retrieval через
 *  match_lesson_stage_embeddings() (миграция 139). Для остальных ролей
 *  (и при системных сбоях embedding/RPC) возвращает null — поведение
 *  не меняется, без "нет материалов"-подсказки, т.к. это не тот случай. */
async function buildRagContext(userMessage: string): Promise<RagContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = await getCurrentUserRole(supabase, user.id);
  if (role !== "student") return null;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await computeEmbedding(userMessage);
  } catch (e) {
    console.error("[ai] RAG embedding failed, falling back to plain chat:", (e as Error)?.message);
    return null;
  }

  // match_lesson_stage_embeddings — RPC из миграции 139, которая ещё не
  // применена к БД, поэтому её нет в сгенерированном Database-типе
  // (@snr/core). Тот же as-any приём, что уже используется в
  // packages/core для колонок из неприменённых миграций.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_lesson_stage_embeddings", {
    p_query_embedding: queryEmbedding,
    p_match_count: RAG_TOP_K,
  });
  if (error) {
    console.error("[ai] RAG retrieval failed, falling back to plain chat:", error.message);
    return null;
  }

  // Студент без группы или без ещё проиндексированных материалов даёт
  // тот же результат — RPC просто вернёт 0 строк в обоих случаях
  // (student_groups join), различать их отдельным запросом не нужно.
  const chunks = ((data ?? []) as RetrievedChunk[]).filter((c) => c.similarity >= RAG_SIMILARITY_THRESHOLD);
  if (chunks.length === 0) return { kind: "no_context" };

  const contextBlock = chunks
    .map(
      (c, i) =>
        `[Источник ${i + 1}: урок "${c.lesson_topic ?? "без темы"}" от ${c.starts_at.slice(0, 10)}]\n${c.chunk_text}`,
    )
    .join("\n\n");

  const sources: AiChatSource[] = chunks.map((c) => ({
    lesson_id: c.lesson_id,
    lesson_topic: c.lesson_topic,
    starts_at: c.starts_at,
    similarity: c.similarity,
  }));

  return { kind: "found", contextBlock, sources };
}

// callAiChat УДАЛЁН 17.08.2026. Это был второй механизм помощника: серверное
// действие со своим промтом, своей историей в sessionStorage браузера и БЕЗ
// какого-либо контекста урока. Именно из-за него помощник, открытый плавающей
// кнопкой внутри урока, называл чужую тему — урок в него не передавался вовсе.
// Прятать за переключателем не стали: механизм один, /api/ai/chat, и у него
// два режима. Клиенты ходят туда через lib/ai/ask-assistant.ts.

export async function getStudyTip(): Promise<{ text: string } | { error: string }> {
  // Z.3, заход 2 — дата в подсказке от времени школы. Дневной лимит ИИ этим
  // НЕ затрагивается: он считается на стороне базы функцией
  // get_ai_usage_today() по `now() AT TIME ZONE 'Asia/Tashkent'`, то есть по
  // настоящим часам Postgres, и смена источника времени в приложении на
  // счётчики не влияет (проверено чтением определения функции).
  const supabase = await createClient();
  const today = (await getMySchoolNow(supabase)).toISOString().slice(0, 10);
  const prompt = `Ты — школьный коуч. Дай один практичный совет по учёбе, концентрации или продуктивности — 1-2 предложения, конкретно и по делу. Только совет, без вводных фраз. Дата: ${today}.\n\nДай совет по учёбе на сегодня.`;
  const { text, error } = await generateText(prompt);
  if (error) return { error };
  return { text };
}

export async function getGradesAdvice(
  gradesSummary: string,
): Promise<{ text: string } | { error: string }> {
  const prompt = `Ты — добрый школьный наставник. На основе оценок ученика дай персональный совет: что улучшить, на что обратить внимание, что делать дальше. Ответ — 2-3 предложения, поддерживающий тон, конкретно. Только совет, без вводных.\n\n${gradesSummary}`;
  const { text, error } = await generateText(prompt);
  if (error) return { error };
  return { text };
}
