import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/ai/gemini-client";
import {
  buildHomeworkFilePrompt, buildHomeworkTestPrompt, buildHomeworkProgrammingPrompt, buildHomeworkBundlePrompt,
} from "@/lib/ai/prompts";
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

  const prompt = type === "file" ? buildHomeworkFilePrompt(topic, level, hints)
    : type === "test" ? buildHomeworkTestPrompt(topic, level, hints)
    : type === "programming" ? buildHomeworkProgrammingPrompt(topic, level, hints)
    : buildHomeworkBundlePrompt(topic, level, hints, requestedSubtaskTypes, EXTERNAL_SERVICE_ORDER);

  let result: GeneratedHomework | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const { data: parsed, error } = await generateJSON<GenRaw>(prompt, null, { temperature: 0.8 });

    if (error || !parsed) {
      console.error(`[ai-generate-homework] attempt ${attempt} error:`, error);
      lastError = error || "Generated JSON parse error";
      continue;
    }

    const normalized = type === "file" ? normalizeFileResult(parsed)
      : type === "test" ? normalizeTestResult(parsed)
      : type === "programming" ? normalizeProgrammingResult(parsed)
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
