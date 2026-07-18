// Server-side only — API key never reaches the browser.
// Пачка 5.2 — единая функция генерации контента урока (theory/practice/
// quiz) с упором на practice, используется скриптом
// generate-lessons-jul18-25.mjs. Отдельный клиент/ретрай от
// apps/web/lib/ai/gemini-client.ts — тот же приём, что уже применён в
// apps/web/lib/ai/embeddings.ts: withRetry() внутри gemini-client.ts
// использует backoff 1с/2с/4с (общий для generateText/generateJSON/chat),
// а здесь по ТЗ нужен свой 5с/15с/45с (тот же тайминг, что уже был у
// генератора уроков в generate-lessons-jul18-25.mjs) — переиспользовать
// withRetry() пришлось бы менять таймингом для ВСЕХ вызывающих мест,
// поэтому отдельный минимальный клиент.
//
// НЕ считает ai_usage_log сама — вызывающий код (скрипт) уже делает
// awaited bumpAiUsageAwaited() после успешного вызова (см. Задачу C) —
// инкремент здесь задвоил бы счётчик.

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";

export type LessonFormat = "FULL" | "SIMPLE";

export type LessonContent = {
  theory: { slides: Array<{ title: string; content: string }> };
  practice: { description: string; tasks: Array<{ text: string; expected_answer?: string }> };
  quiz: {
    questions: Array<{ question: string; options: string[]; correct_index: number; explanation: string }>;
  };
};

const ENGLISH_SUBJECT = "Английский язык";

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

const JSON_SHAPE_FULL = `{
  "theory": { "slides": [ { "title": "...", "content": "..." } ] },
  "practice": { "description": "...", "tasks": [ { "text": "...", "expected_answer": "..." } ] },
  "quiz": { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correct_index": 0, "explanation": "..." } ] }
}`;

function buildSystemPrompt(input: { subject_name: string; group_grade: number; format: LessonFormat }): string {
  const { subject_name, group_grade, format } = input;
  const isEnglish = subject_name === ENGLISH_SUBJECT;

  if (format === "FULL") {
    return `Ты — методический ассистент для учителя в школе Узбекистана. Предмет: "${subject_name}", класс: ${group_grade}.

ЗАДАЧА: сгенерировать содержимое урока для этого предмета — упор на PRACTICE
(практика — главное для программирования/робототехники, теория короче).

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON), формат:
${JSON_SHAPE_FULL}

ПРАВИЛА ДЛЯ theory.slides:
- РОВНО 5-10 слайдов (не меньше 5, не больше 10).
- Каждый слайд: title (короткий заголовок) + content (100-200 слов,
  markdown допустим: ## заголовки, списки через "-", **жирный** для
  терминов).
- Если для слайда нужна иллюстрация — вставь в content плейсхолдер вида
  "[image: краткое описание того, что нарисовать]" (на английском или
  русском — не важно, главное описательно). Не на каждом слайде, только
  где реально помогает понять материал.
- СТРОГО адаптировано под класс ${group_grade} (возраст ученика).

ПРАВИЛА ДЛЯ practice (это ГЛАВНАЯ часть урока — уделяй ей больше внимания, чем теории):
- description: 1-2 абзаца, что в целом делает ученик на практике.
- tasks: РОВНО 5-10 задач, возрастающей сложности, конкретные и
  проверяемые. Каждая задача — text (формулировка) и опционально
  expected_answer (ожидаемый результат/ответ, если применимо — для
  открытых творческих задач можно не указывать).

ПРАВИЛА ДЛЯ quiz.questions:
- РОВНО 5 вопросов, проверяющих понимание темы (не practice-заданий).
- Для каждого — question, options (4 варианта), correct_index (0-based,
  ровно один правильный), explanation (1 предложение — почему правильный
  ответ верен, показывается ученику после ответа).

ЯЗЫК: весь контент (theory, practice, quiz) — на русском.
Только валидный JSON, ничего больше.`;
  }

  // SIMPLE
  const englishRule = isEnglish
    ? `\nИСКЛЮЧЕНИЕ ПО ЯЗЫКУ (предмет "${ENGLISH_SUBJECT}"): theory.slides[].content пишется НА
АНГЛИЙСКОМ (реалистичный урок английского — тема, примеры, разбор на
английском). practice И quiz — НА РУССКОМ (описание задания, вопросы,
варианты ответов — на русском, чтобы не путать язык вопроса с языком
темы).`
    : `\nЯЗЫК: весь контент (theory, practice, quiz) — на русском.`;

  return `Ты — методический ассистент для учителя в школе Узбекистана. Предмет: "${subject_name}", класс: ${group_grade}.

ЗАДАЧА: сгенерировать КОРОТКОЕ содержимое урока — короткая теория,
маленькая практика, короткий тест.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON), формат:
${JSON_SHAPE_FULL}

ПРАВИЛА ДЛЯ theory.slides:
- РОВНО 3-5 слайдов (не меньше 3, не больше 5).
- Каждый слайд: title + content (80-150 слов, markdown допустим).
- Плейсхолдер "[image: описание]" в content разрешён, если иллюстрация
  реально помогает — не обязателен на каждом слайде.
- СТРОГО адаптировано под класс ${group_grade}.

ПРАВИЛА ДЛЯ practice (маленькая, но обязательна — не пропускай):
- description: 1 абзац, что делает ученик.
- tasks: РОВНО 3-5 небольших задач. Каждая — text + опционально
  expected_answer.

ПРАВИЛА ДЛЯ quiz.questions:
- РОВНО 3 вопроса. question, options (4 варианта), correct_index
  (0-based), explanation (1 предложение).
${englishRule}
Только валидный JSON, ничего больше.`;
}

/** Один Gemini-вызов (gemini-2.5-flash, JSON-режим), генерирует
 *  theory+practice+quiz по FULL/SIMPLE-пресету. Retry на 429 —
 *  экспоненциальный backoff 5с/15с/45с, макс 3 попытки; прочие ошибки не
 *  ретраятся (в отличие от embeddings.ts — здесь дорогой генеративный
 *  вызов, повторный запрос при неизвестной ошибке тратил бы квоту
 *  впустую чаще, чем помогал). */
export async function generateLessonContent(input: {
  subject_name: string;
  topic: string;
  group_grade: number;
  format: LessonFormat;
}): Promise<LessonContent> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystemPrompt(input),
    generationConfig: { responseMimeType: "application/json" },
  });

  const userPrompt = `Тема урока: "${input.topic}"\nПредмет: ${input.subject_name}\nКласс: ${input.group_grade}\nФормат: ${input.format}`;

  let text = "";
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      text = result.response.text();
      break;
    } catch (e) {
      const is429 = e instanceof GoogleGenerativeAIFetchError && e.status === 429;
      if (is429 && attempt < BACKOFF_429_MS.length) {
        const delay = BACKOFF_429_MS[attempt]!;
        console.warn(`[generate-lesson-content] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${BACKOFF_429_MS.length})`);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }

  const parsed = JSON.parse(stripFences(text)) as LessonContent;
  return parsed;
}
