"use server";

import { chat, generateText } from "@/lib/ai/gemini-client";

export async function callAiChat(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "model"; text: string }>,
): Promise<{ text: string } | { error: string }> {
  const messages = [
    ...history.map((m) => ({
      role: (m.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: userMessage },
  ];
  const { text, error } = await chat(systemPrompt, messages);
  if (error) return { error };
  return { text };
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
