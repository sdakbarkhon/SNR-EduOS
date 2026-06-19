"use server";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
];

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    let delayMs = 3000;
    try {
      const body = await res.text();
      const data = JSON.parse(body) as {
        error?: { details?: Array<{ "@type"?: string; retryDelay?: string }> };
      };
      const retryInfo = data?.error?.details?.find((d) =>
        d["@type"]?.includes("RetryInfo"),
      );
      if (retryInfo?.retryDelay) {
        const m = retryInfo.retryDelay.match(/(\d+(?:\.\d+)?)/);
        if (m && m[1]) delayMs = Math.min(parseFloat(m[1]) * 1000 + 500, 8000);
      }
    } catch {}
    console.log("[gemini] rate limited, retrying in", delayMs, "ms");
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "model"; text: string }>,
): Promise<{ text: string } | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "API key not configured" };

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  contents.push({ role: "user", parts: [{ text: systemPrompt }] });
  contents.push({ role: "model", parts: [{ text: "Понял. Готов помогать." }] });
  for (const msg of history) {
    contents.push({ role: msg.role, parts: [{ text: msg.text }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const body = JSON.stringify({ contents });
  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent`;
    try {
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body,
      });
      if (res.status === 429 || res.status === 404) {
        console.warn(`[gemini] ${model} → ${res.status} after retry, trying next model`);
        continue;
      }
      if (!res.ok) {
        console.error("[gemini] error:", res.status, await res.text());
        return { error: "AI временно недоступен" };
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { error: "Пустой ответ" };
      return { text };
    } catch (err) {
      console.error(`[gemini] ${model} threw:`, err);
      return { error: "Ошибка соединения" };
    }
  }
  return { error: "AI временно недоступен" };
}

export async function getDailyFact(): Promise<{ text: string } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `Ты — помощник для школьников. Дай один интересный факт из науки, истории или технологий — 2-3 предложения, живо и увлекательно. Только факт, без вводных слов. Дата: ${today}.`;
  return callGemini(systemPrompt, "Дай один интересный факт дня.", []);
}

export async function getStudyTip(): Promise<{ text: string } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `Ты — школьный коуч. Дай один практичный совет по учёбе, концентрации или продуктивности — 1-2 предложения, конкретно и по делу. Только совет, без вводных фраз. Дата: ${today}.`;
  return callGemini(systemPrompt, "Дай совет по учёбе на сегодня.", []);
}

export async function getGradesAdvice(
  gradesSummary: string,
): Promise<{ text: string } | { error: string }> {
  const systemPrompt = `Ты — добрый школьный наставник. На основе оценок ученика дай персональный совет: что улучшить, на что обратить внимание, что делать дальше. Ответ — 2-3 предложения, поддерживающий тон, конкретно. Только совет, без вводных.`;
  return callGemini(systemPrompt, gradesSummary, []);
}

export async function generateHomeworkContent(params: {
  subject: string;
  topic: string;
  taskType: "file" | "test";
  difficulty?: "easy" | "medium" | "hard";
}): Promise<
  | {
      title: string;
      description: string;
      questions?: Array<{
        question: string;
        options: string[];
        correctIndex: number;
      }>;
    }
  | { error: string }
> {
  const difficultyLabel =
    params.difficulty === "easy"
      ? "Лёгкое"
      : params.difficulty === "hard"
        ? "Сложное"
        : "Среднее";

  const jsonFormat =
    params.taskType === "file"
      ? `{
  "title": "Краткое название задания",
  "description": "Подробное описание что нужно сделать, 3-5 предложений"
}`
      : `{
  "title": "Краткое название теста",
  "description": "Краткое описание теста, 1-2 предложения",
  "questions": [
    {
      "question": "Текст вопроса",
      "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
      "correctIndex": 0
    }
  ]
}`;

  const systemPrompt = `Ты — помощник учителя школы по предмету ${params.subject}.
Сгенерируй задание для учеников 7 класса по теме "${params.topic}".
Тип задания: ${params.taskType === "file" ? "файловое (ученик загружает файл)" : "тест с вариантами ответов"}.
Уровень сложности: ${difficultyLabel}.

ОТВЕЧАЙ СТРОГО В JSON БЕЗ MARKDOWN-РАЗМЕТКИ. Формат:
${jsonFormat}

Для теста сгенерируй 5 вопросов. Никакого текста до или после JSON. Только сырой JSON.`;

  const result = await callGemini(systemPrompt, "Сгенерируй задание.", []);
  if ("error" in result) return result;

  try {
    const cleaned = result.text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      title: string;
      description: string;
      questions?: Array<{ question: string; options: string[]; correctIndex: number }>;
    };
    return parsed;
  } catch (err) {
    console.error("[gemini] parse error:", err, "raw:", result.text);
    return { error: "Не удалось разобрать ответ AI" };
  }
}
