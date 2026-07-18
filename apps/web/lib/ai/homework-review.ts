// Server-side only — API key never reaches the browser.
// Пачка 5.3 — AI-проверка текстовых/код-ответов на домашние задания.
// Отдельный клиент/ретрай от apps/web/lib/ai/gemini-client.ts — тот же
// приём, что уже применён в generate-lesson-content.ts и embeddings.ts
// (withRetry() внутри gemini-client.ts имеет свой backoff 1с/2с/4с,
// здесь по ТЗ нужен 5с/15с/45с).

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";

export type HomeworkReview = {
  grade: 2 | 3 | 4 | 5;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    summary: string;
  };
};

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing on server");
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BACKOFF_429_MS = [5000, 15000, 45000];

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

const SYSTEM_PROMPT_TEMPLATE = (subject_name: string, group_grade: number) => `Ты — учитель "${subject_name}" для ${group_grade} класса, проверяешь домашнее задание ученика.

ЗАДАЧА: оценить ответ ученика по 5-балльной шкале (2 — неудовлетворительно,
3 — удовлетворительно, 4 — хорошо, 5 — отлично) и дать подробный,
конструктивный feedback.

Если ответ — КОД: оценивай корректность, читаемость, стиль.
Если ответ — ТЕКСТ: оценивай содержание, полноту, грамотность.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON), формат:
{
  "grade": 4,
  "feedback": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "suggestions": ["...", "..."],
    "summary": "Общая оценка одной фразой"
  }
}

ПРАВИЛА:
- grade — целое число 2, 3, 4 или 5.
- strengths — 2-4 сильные стороны ответа.
- weaknesses — 2-4 слабые стороны (если ответ отличный и слабых сторон
  почти нет — можно указать 1-2 мелких момента для роста, не выдумывай
  серьёзных недостатков там, где их нет).
- suggestions — 2-4 конкретные рекомендации, что улучшить.
- summary — одна фраза, итоговое впечатление.
- Тон — конструктивный, обращайся к ученику на "ты", без обидных или
  унизительных формулировок, даже если ответ слабый.
- Только валидный JSON, ничего больше.`;

/** Один Gemini-вызов (gemini-2.5-flash, JSON-режим) — оценивает текстовый/
 *  код-ответ на ДЗ. Retry на 429 — экспоненциальный backoff 5с/15с/45с,
 *  макс 3 попытки; прочие ошибки — 1 ретрай через 3с, потом throw. */
export async function reviewHomework(input: {
  homework_title: string;
  homework_description: string;
  subject_name: string;
  answer_text: string;
  group_grade: number;
}): Promise<HomeworkReview> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT_TEMPLATE(input.subject_name, input.group_grade),
    generationConfig: { responseMimeType: "application/json" },
  });

  const userPrompt = `Задание: "${input.homework_title}"\nОписание задания: ${input.homework_description || "(без описания)"}\n\nОтвет ученика:\n${input.answer_text}`;

  let text = "";
  let otherErrorRetried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      text = result.response.text();
      break;
    } catch (e) {
      const is429 = e instanceof GoogleGenerativeAIFetchError && e.status === 429;
      if (is429 && attempt < BACKOFF_429_MS.length) {
        const delay = BACKOFF_429_MS[attempt]!;
        console.warn(`[homework-review] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${BACKOFF_429_MS.length})`);
        await sleep(delay);
        continue;
      }
      if (!is429 && !otherErrorRetried) {
        otherErrorRetried = true;
        console.warn(`[homework-review] error "${(e as Error)?.message}", 1 retry in 3s`);
        await sleep(3000);
        continue;
      }
      throw e;
    }
  }

  const parsed = JSON.parse(stripFences(text)) as HomeworkReview;
  return parsed;
}
