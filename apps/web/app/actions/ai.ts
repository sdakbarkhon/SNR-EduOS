"use server";

import { chat, generateText } from "@/lib/ai/gemini-client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth";
import { computeEmbedding } from "@/lib/ai/embeddings";

const RAG_TOP_K = 5;

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

/** Пачка 5.1: для студентов подмешивает в systemPrompt релевантные
 *  фрагменты из lesson_stages их группы (RAG) — retrieval через
 *  match_lesson_stage_embeddings() (миграция 139). Для остальных ролей
 *  поведение не меняется. */
async function buildRagContext(
  userMessage: string,
): Promise<{ contextBlock: string; sources: AiChatSource[] } | null> {
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

  const chunks = (data ?? []) as RetrievedChunk[];
  if (chunks.length === 0) return { contextBlock: "", sources: [] };

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

  return { contextBlock, sources };
}

export async function callAiChat(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "model"; text: string }>,
): Promise<{ text: string; sources_used?: AiChatSource[] } | { error: string }> {
  const rag = await buildRagContext(userMessage);

  let effectiveSystemPrompt = systemPrompt;
  if (rag && rag.contextBlock) {
    effectiveSystemPrompt = `${systemPrompt}

КОНТЕКСТ ИЗ УРОКОВ УЧЕНИКА (используй для ответа, если он релевантен вопросу; не выдумывай факты сверх этого списка и не упоминай, что это "контекст" или "источники" — отвечай естественно, как будто просто знаешь материал):

${rag.contextBlock}`;
  }

  const messages = [
    ...history.map((m) => ({
      role: (m.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: userMessage },
  ];
  const { text, error } = await chat(effectiveSystemPrompt, messages);
  if (error) return { error };
  return rag && rag.sources.length > 0 ? { text, sources_used: rag.sources } : { text };
}

export async function getStudyTip(): Promise<{ text: string } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10);
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
