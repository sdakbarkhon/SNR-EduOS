import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai-gemini";
import { EXTERNAL_SERVICE_ORDER } from "@/lib/external-services";
import type { CodeLanguage, ExternalServiceType } from "@snr/core";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── Types ────────────────────────────────────────────────────────────────────

type HomeworkType = "file" | "test" | "programming" | "bundle";
type SubtaskType = "file" | "test" | "code" | ExternalServiceType;

const ALLOWED_TYPES: HomeworkType[] = ["file", "test", "programming", "bundle"];
const ALLOWED_SUBTASK_TYPES: SubtaskType[] = ["file", "test", "code", ...EXTERNAL_SERVICE_ORDER];
const RUNNABLE_LANGUAGES: CodeLanguage[] = ["python", "javascript", "cpp", "java"];

interface RequestBody {
  type: HomeworkType;
  topic: string;
  level: string;
  hints?: string;
  bundleSubtaskTypes?: string[];
}

interface GenQuestion {
  question?: string;
  options?: string[];
  correctIndex?: number;
}

interface GenSubtask {
  type?: string;
  title?: string;
  description?: string;
  config?: {
    questions?: GenQuestion[];
    starterCode?: string;
    language?: string;
    expectedOutput?: string;
  };
}

interface GenRaw {
  title?: string;
  description?: string;
  questions?: GenQuestion[];
  starterCode?: string;
  language?: string;
  expectedOutput?: string;
  subtasks?: GenSubtask[];
}

interface NormalizedQuestion { question: string; options: string[]; correctIndex: number }

interface GeneratedHomework {
  title: string;
  description: string;
  config?: {
    questions?: NormalizedQuestion[];
    starterCode?: string;
    language?: CodeLanguage;
    expectedOutput?: string;
  };
  subtasks?: Array<{
    type: SubtaskType;
    title: string;
    description: string;
    config: Record<string, unknown>;
  }>;
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function hintsLine(hints: string | undefined): string {
  return hints && hints.trim() ? `\nДополнительные пожелания учителя: ${hints.trim()}` : "";
}

function buildFilePrompt(topic: string, level: string, hints: string | undefined): string {
  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Составить формулировку домашнего задания типа "файл" (ученик готовит и присылает файл/текстовый ответ).

Тема задания: ${topic}
Класс/уровень: ${level}${hintsLine(hints)}

Требования:
- title — короткое ёмкое название задания (без кавычек).
- description — чёткая инструкция для ученика: что именно нужно сделать и что сдать. Академический стиль, понятные формулировки для школьников, без markdown-разметки, без эмодзи.

ВЕРНИ СТРОГО JSON (без markdown, без вступления, без комментариев):
{
  "title": "...",
  "description": "..."
}`;
}

function buildTestPrompt(topic: string, level: string, hints: string | undefined): string {
  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Составить тест (домашнее задание типа "тест") с вопросами с одним правильным ответом.

Тема задания: ${topic}
Класс/уровень: ${level}${hintsLine(hints)}

Требования:
- title — короткое ёмкое название теста (без кавычек).
- description — краткая инструкция для ученика (1–2 предложения), без markdown-разметки, без эмодзи.
- questions — массив из 5–10 вопросов, каждый с полем "question" (текст вопроса), "options" (массив из 4 вариантов ответа) и "correctIndex" (индекс правильного варианта в options, начиная с 0). Ровно один правильный вариант на вопрос.
- Вопросы должны проверять ПОНИМАНИЕ темы, а не запоминание формулировок или синтаксиса.

ВЕРНИ СТРОГО JSON (без markdown, без вступления, без комментариев):
{
  "title": "...",
  "description": "...",
  "questions": [
    { "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0 }
  ]
}`;
}

function buildProgrammingPrompt(topic: string, level: string, hints: string | undefined): string {
  const langHint = hints && /c\+\+|си\+\+|cpp/i.test(hints) ? "cpp"
    : hints && /java(?!script)/i.test(hints) ? "java"
    : hints && /javascript|js\b/i.test(hints) ? "javascript"
    : "python";
  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Составить задание по программированию (домашнее задание типа "программирование").

Тема задания: ${topic}
Класс/уровень: ${level}${hintsLine(hints)}
Язык программирования по умолчанию: ${langHint} (используй его, если пожелания учителя явно не требуют другого из списка "python"|"javascript"|"cpp"|"java").

Требования:
- title — короткое ёмкое название задания (без кавычек).
- description — условие задачи: что должна делать программа, входные/выходные данные. Академический стиль, без markdown-разметки, без эмодзи.
- starterCode — код-скелет для ученика с комментарием/TODO, подсказывающим что реализовать (НЕ полное решение).
- expectedOutput — то, что выведет на экран правильное решение (пример вывода).
- language — "python", "javascript", "cpp" или "java".

ВЕРНИ СТРОГО JSON (без markdown, без вступления, без комментариев):
{
  "title": "...",
  "description": "...",
  "starterCode": "...",
  "expectedOutput": "...",
  "language": "python"
}`;
}

function buildBundlePrompt(topic: string, level: string, hints: string | undefined, requestedTypes: SubtaskType[]): string {
  const typesInstruction = requestedTypes.length > 0
    ? `Создай РОВНО ${requestedTypes.length} подзадач(и) — по одной подзадаче на каждый из следующих типов, СТРОГО в этом порядке: ${requestedTypes.join(", ")}.`
    : `Сам выбери от 2 до 4 РАЗНЫХ типов подзадач из списка "file", "test", "code" и внешних сервисов ниже — те, что лучше всего подходят теме.`;

  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Составить домашнее задание типа "набор заданий" (bundle) — оно состоит из нескольких независимых подзадач разных типов, которые ученик решает по отдельности, а учитель оценивает весь набор ОДНОЙ общей оценкой.

Тема задания: ${topic}
Класс/уровень: ${level}${hintsLine(hints)}

Доступные типы подзадач:
- "file" — ученик присылает файл/текстовый ответ. config всегда {} (пустой объект).
- "test" — мини-тест с вопросами с одним правильным ответом. config = { "questions": [...] }, 3–5 вопросов (меньше, чем в полном тесте — это только часть набора), формат вопроса такой же как ниже.
- "code" — задача по программированию. config = { "starterCode": "...", "language": "python"|"javascript"|"cpp"|"java", "expectedOutput": "..." }.
- "${EXTERNAL_SERVICE_ORDER.join('", "')}" — задание во внешнем сервисе (${EXTERNAL_SERVICE_ORDER.join(", ")}). config ВСЕГДА {} (пустой объект) — НЕ придумывай ссылку на проект, она подставится автоматически. Вместо этого подробно опиши в поле "description" ЧТО именно ученик должен сделать в этом сервисе.

${typesInstruction}

Общие требования:
- title — короткое ёмкое название всего набора заданий (без кавычек).
- description — краткое общее описание набора для ученика (1–3 предложения), без markdown-разметки, без эмодзи.
- Для каждой подзадачи заполни: "type", "title" (короткое название подзадачи), "description" (чёткая инструкция что сделать), "config" (по правилам типа выше).
- Академический стиль, понятные формулировки для школьников, без эмодзи, без markdown-разметки внутри текстов.

ВЕРНИ СТРОГО JSON (без markdown, без вступления, без комментариев):
{
  "title": "...",
  "description": "...",
  "subtasks": [
    {
      "type": "file"|"test"|"code"|"...",
      "title": "...",
      "description": "...",
      "config": { }
    }
  ]
}`;
}

// ── Normalization / validation ──────────────────────────────────────────────

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeQuestions(raw: GenQuestion[] | undefined, max: number): NormalizedQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Required<GenQuestion> => {
      if (!q || typeof q.question !== "string" || !q.question.trim()) return false;
      if (!Array.isArray(q.options)) return false;
      const validOptions = q.options.filter((o) => typeof o === "string" && o.trim());
      if (validOptions.length < 2) return false;
      return Number.isInteger(q.correctIndex) && q.correctIndex! >= 0 && q.correctIndex! < q.options.length;
    })
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => String(o).trim()),
      correctIndex: q.correctIndex,
    }))
    .slice(0, max);
}

function normalizeLanguage(raw: unknown): CodeLanguage {
  return (RUNNABLE_LANGUAGES as string[]).includes(String(raw)) ? (raw as CodeLanguage) : "python";
}

function normalizeFileResult(parsed: GenRaw): GeneratedHomework | null {
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  if (!title || !description) return null;
  return { title, description };
}

function normalizeTestResult(parsed: GenRaw): GeneratedHomework | null {
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const questions = normalizeQuestions(parsed.questions, 10);
  if (!title || questions.length === 0) return null;
  return { title, description, config: { questions } };
}

function normalizeProgrammingResult(parsed: GenRaw): GeneratedHomework | null {
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  if (!title || !description) return null;
  const starterCode = typeof parsed.starterCode === "string" ? parsed.starterCode.trim() : "";
  const expectedOutput = typeof parsed.expectedOutput === "string" ? parsed.expectedOutput.trim() : "";
  const language = normalizeLanguage(parsed.language);
  return { title, description, config: { starterCode, expectedOutput, language } };
}

const MAX_BUNDLE_SUBTASKS = 4;

function normalizeSubtask(s: GenSubtask): { type: SubtaskType; title: string; description: string; config: Record<string, unknown> } | null {
  if (!s || typeof s.title !== "string" || !s.title.trim()) return null;
  const type = ALLOWED_SUBTASK_TYPES.includes(s.type as SubtaskType) ? (s.type as SubtaskType) : null;
  if (!type) return null;
  const title = s.title.trim();
  const description = typeof s.description === "string" ? s.description.trim() : "";

  let config: Record<string, unknown> = {};
  if (type === "test") {
    const questions = normalizeQuestions(s.config?.questions, 5);
    config = questions.length > 0 ? { questions } : {};
  } else if (type === "code") {
    config = {
      starterCode: typeof s.config?.starterCode === "string" ? s.config.starterCode.trim() : "",
      language: normalizeLanguage(s.config?.language),
      expectedOutput: typeof s.config?.expectedOutput === "string" ? s.config.expectedOutput.trim() : "",
    };
  } else {
    // "file" | external service — always empty config
    config = {};
  }

  return { type, title, description, config };
}

function normalizeBundleResult(parsed: GenRaw): GeneratedHomework | null {
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const rawSubtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];
  const subtasks = rawSubtasks
    .map(normalizeSubtask)
    .filter((s): s is NonNullable<ReturnType<typeof normalizeSubtask>> => s !== null)
    .slice(0, MAX_BUNDLE_SUBTASKS);
  if (!title || subtasks.length === 0) return null;
  return { title, description, subtasks };
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = (await req.json()) as Partial<RequestBody>;

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }
  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const topic = body.topic.trim();
  const level = body.level?.trim() || "—";
  const hints = body.hints?.trim() || undefined;
  const type = body.type;
  const requestedSubtaskTypes = Array.isArray(body.bundleSubtaskTypes)
    ? body.bundleSubtaskTypes.filter((t): t is SubtaskType => ALLOWED_SUBTASK_TYPES.includes(t as SubtaskType))
    : [];

  const prompt = type === "file" ? buildFilePrompt(topic, level, hints)
    : type === "test" ? buildTestPrompt(topic, level, hints)
    : type === "programming" ? buildProgrammingPrompt(topic, level, hints)
    : buildBundlePrompt(topic, level, hints, requestedSubtaskTypes);

  let result: GeneratedHomework | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const { text, error } = await callGemini(prompt, [], {
      temperature: 0.8,
      responseMimeType: "application/json",
      useSearch: false,
    });

    if (error) {
      console.error(`[ai-generate-homework] attempt ${attempt} error:`, error);
      lastError = error;
      continue;
    }

    try {
      const parsed = JSON.parse(stripFences(text)) as GenRaw;
      const normalized = type === "file" ? normalizeFileResult(parsed)
        : type === "test" ? normalizeTestResult(parsed)
        : type === "programming" ? normalizeProgrammingResult(parsed)
        : normalizeBundleResult(parsed);

      if (!normalized) {
        lastError = "Generated homework failed validation";
        continue;
      }
      result = normalized;
    } catch (e: unknown) {
      console.error("[ai-generate-homework] parse error:", text.slice(0, 300), (e as Error)?.message);
      lastError = "Generated JSON parse error";
    }
  }

  if (!result) {
    return NextResponse.json({ error: lastError || "Generation failed" }, { status: 500 });
  }

  return NextResponse.json(result);
}
