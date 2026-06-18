"use server";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
];

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
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body,
      });
      if (res.status === 429 || res.status === 404) {
        console.warn(`[gemini] ${model} → ${res.status}, trying next`);
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
