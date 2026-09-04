import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { getGroupPerformance, groupPerformanceHomeworkHint } from "@/lib/ai/group-performance";
import { getMySchoolNow } from "@/lib/school-time-server";
import { subjectFilterKey } from "@snr/core";
import {
  buildHomeworkFilePrompt, buildHomeworkTestPrompt, buildHomeworkProgrammingPrompt, buildHomeworkBundlePrompt,
  buildHomeworkCodeCompletionPrompt,
} from "@/lib/ai/prompts";
import {
  HOMEWORK_FILE_SCHEMA, HOMEWORK_TEST_SCHEMA, HOMEWORK_PROGRAMMING_SCHEMA, HOMEWORK_CODE_COMPLETION_SCHEMA,
} from "@/lib/ai/schemas";
import { EXTERNAL_SERVICE_ORDER } from "@/lib/external-services";
import type { CodeLanguage, ExternalServiceType } from "@snr/core";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── Types ────────────────────────────────────────────────────────────────────

type HomeworkType = "file" | "test" | "programming" | "bundle" | "code_completion";
type SubtaskType = "file" | "test" | "code" | ExternalServiceType;

// 04.09.2026 — «код с пропусками» добавлен пятым. Тип был в форме с самого
// начала, а здесь его не завели: форма отправляла его как есть, роут отвечал
// «Invalid type», и учитель видел «Попробуйте ещё раз» — совет, который не мог
// помочь никогда.
const ALLOWED_TYPES: HomeworkType[] = ["file", "test", "programming", "bundle", "code_completion"];
const ALLOWED_SUBTASK_TYPES: SubtaskType[] = ["file", "test", "code", ...EXTERNAL_SERVICE_ORDER];
const RUNNABLE_LANGUAGES: CodeLanguage[] = ["python", "javascript", "cpp", "java"];

interface RequestBody {
  type: HomeworkType;
  topic: string;
  level: string;
  hints?: string;
  bundleSubtaskTypes?: string[];
  /** Для подстройки сложности под группу. Необязательны — без них задание
   *  генерируется ровно как раньше. */
  groupId?: string;
  subjectId?: string;
}

interface GenGap {
  id?: string;
  correct?: string;
  options?: unknown[];
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
  /** Код с пропусками: шаблон и список пропусков. */
  codeTemplate?: string;
  gaps?: GenGap[];
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
    /** Код с пропусками. Имена полей — как в базе (CodeCompletionPayload),
     *  чтобы форма клала их в задание без переименований. */
    code_template?: string;
    gaps?: Array<{ id: string; correct: string; options: string[] }>;
  };
  subtasks?: Array<{
    type: SubtaskType;
    title: string;
    description: string;
    config: Record<string, unknown>;
  }>;
}

// ── Normalization / validation ──────────────────────────────────────────────

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

/**
 * КОД С ПРОПУСКАМИ: приводим ответ к тому, что примет форма.
 *
 * Правила не выдуманы здесь — они списаны с `codeCompletionIssues` в
 * `components/teacher/CodeCompletionBuilder`: плейсхолдер `__GAP1__` в коде,
 * тот же id в списке, минимум два варианта, правильный среди них. Отдать
 * учителю «сгенерировано» и красный список ошибок было бы хуже, чем честно
 * отбраковать ответ и попробовать ещё раз.
 *
 * Пропуск, у которого нет плейсхолдера в коде, выбрасываем; плейсхолдер без
 * пропуска — повод забраковать весь ответ: ученик увидел бы сырое `__GAP3__`.
 */
function normalizeCodeCompletionResult(parsed: GenRaw): GeneratedHomework | null {
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const codeTemplate = typeof parsed.codeTemplate === "string" ? parsed.codeTemplate.trim() : "";
  if (!title || !codeTemplate) return null;

  const сырые = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const пропуски: Array<{ id: string; correct: string; options: string[] }> = [];
  for (const g of сырые) {
    const id = typeof g?.id === "string" ? g.id.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]+$/.test(id)) continue;
    if (!codeTemplate.includes(`__${id}__`)) continue;
    if (пропуски.some((x) => x.id === id)) continue;
    const correct = typeof g?.correct === "string" ? g.correct.trim() : "";
    if (!correct) continue;
    const options = Array.isArray(g?.options)
      ? [...new Set(g.options.filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim()))]
      : [];
    if (!options.includes(correct)) options.unshift(correct);
    if (options.length < 2) continue;
    пропуски.push({ id, correct, options });
  }
  if (пропуски.length < CODE_COMPLETION_MIN_GAPS) return null;

  // Плейсхолдер в коде без описанного пропуска — брак: ученик увидит __GAP3__.
  const вКоде = [...codeTemplate.matchAll(/__([A-Z0-9]+)__/g)].map((m) => m[1]);
  if (вКоде.some((p) => !пропуски.some((g) => g.id === p))) return null;

  return {
    title,
    description,
    config: { code_template: codeTemplate, gaps: пропуски, language: normalizeLanguage(parsed.language) },
  };
}

/** Столько же требует форма (CodeCompletionBuilder.MIN_GAPS). */
const CODE_COMPLETION_MIN_GAPS = 3;

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
    .from("teachers").select("id, school_id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = (await req.json()) as Partial<RequestBody>;

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }
  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    // Правда вместо «Invalid type»: этот текст доходит до учителя, и «попробуйте
    // ещё раз» на неподдерживаемом типе — совет, который не сработает никогда.
    return NextResponse.json(
      { error: "Для этого типа задания генерация пока не сделана — заполните поля вручную." },
      { status: 400 },
    );
  }

  const topic = body.topic.trim();
  const level = body.level?.trim() || "—";
  const hints = body.hints?.trim() || undefined;
  const type = body.type;
  const requestedSubtaskTypes = Array.isArray(body.bundleSubtaskTypes)
    ? body.bundleSubtaskTypes.filter((t): t is SubtaskType => ALLOWED_SUBTASK_TYPES.includes(t as SubtaskType))
    : [];

  // Уровень группы — в ТОТ ЖЕ промпт, отдельного обращения к модели нет.
  // Данных мало или группа не передана — строка пустая, и промпт получается
  // ровно прежним.
  let groupContext = "";
  if (body.groupId) {
    try {
      const schoolNow = await getMySchoolNow(db);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: grp }, { data: subj }] = await Promise.all([
        (db as any).from("groups").select("name").eq("id", body.groupId).maybeSingle(),
        body.subjectId
          ? (db as any).from("subjects").select("name").eq("id", body.subjectId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const perf = await getGroupPerformance(db, {
        groupName: (grp as { name: string } | null)?.name ?? "",
        subjectKey: subjectFilterKey((subj as { name: string } | null)?.name),
        todayIso: schoolNow.toISOString().slice(0, 10),
      });
      groupContext = groupPerformanceHomeworkHint(perf);
    } catch (e) {
      // Подсказка — надстройка. Задание должно составиться и без неё.
      console.error("[ai-homework] уровень группы не собрался:", (e as Error)?.message);
    }
  }

  const prompt = type === "file" ? buildHomeworkFilePrompt(topic, level, hints, groupContext)
    : type === "test" ? buildHomeworkTestPrompt(topic, level, hints, groupContext)
    : type === "programming" ? buildHomeworkProgrammingPrompt(topic, level, hints, groupContext)
    : type === "code_completion" ? buildHomeworkCodeCompletionPrompt(topic, level, hints, groupContext)
    : buildHomeworkBundlePrompt(topic, level, hints, requestedSubtaskTypes, EXTERNAL_SERVICE_ORDER, groupContext);

  // bundle остаётся без строгой схемы — см. комментарий в lib/ai/schemas.ts
  // (config-форма зависит от значения соседнего поля "type", Gemini responseSchema
  // не выражает discriminated union).
  const schema = type === "file" ? HOMEWORK_FILE_SCHEMA
    : type === "test" ? HOMEWORK_TEST_SCHEMA
    : type === "programming" ? HOMEWORK_PROGRAMMING_SCHEMA
    : type === "code_completion" ? HOMEWORK_CODE_COMPLETION_SCHEMA
    : null;

  let result: GeneratedHomework | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const { data: parsed, error } = await generateJSON<GenRaw>(prompt, schema, {
      temperature: 0.8,
      usage: { task: AI_TASKS.generateHomework, teacherId: teacher.id, schoolId: teacher.school_id ?? null },
    });

    if (error || !parsed) {
      console.error(`[ai-generate-homework] attempt ${attempt} error:`, error);
      lastError = error || "Generated JSON parse error";
      continue;
    }

    const normalized = type === "file" ? normalizeFileResult(parsed)
      : type === "test" ? normalizeTestResult(parsed)
      : type === "programming" ? normalizeProgrammingResult(parsed)
      : type === "code_completion" ? normalizeCodeCompletionResult(parsed)
      : normalizeBundleResult(parsed);

    if (!normalized) {
      lastError = "Generated homework failed validation";
      continue;
    }
    result = normalized;
  }

  if (!result) {
    return NextResponse.json({ error: lastError || "Generation failed" }, { status: 500 });
  }

  return NextResponse.json(result);
}
