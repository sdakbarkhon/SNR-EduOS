import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai-gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Content types the generator may emit. The first four are fully buildable
// without extra teacher input; the external services are suggested as
// placeholders (teacher adds the project link afterwards).
const ALLOWED_CONTENT = [
  "presentation", "code", "quiz_qia", "quiz_kahoot",
  "scratch", "wokwi", "codesandbox", "makecode",
];
const EXTERNAL = ["scratch", "wokwi", "codesandbox", "makecode"];

type AttachedMaterial = { title: string; text: string };

function buildPrompt(input: {
  topic: string;
  grade: number;
  subject: string;
  durationMin: number;
  materials: AttachedMaterial[];
}): string {
  const hasFiles = input.materials.length > 0;
  const materialsContext = hasFiles
    ? input.materials
        .map((m) => `=== Материал "${m.title}" ===\n${m.text}`)
        .join("\n\n")
    : "Материалы не прикреплены.";

  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Создать структуру урока с этапами.

ВХОДНЫЕ ДАННЫЕ:
- Класс: ${input.grade}
- Предмет: ${input.subject}
- Тема урока: ${input.topic}
- Длительность урока: ${input.durationMin} минут

МАТЕРИАЛЫ ОТ УЧИТЕЛЯ:
${materialsContext}

ИНСТРУКЦИИ:
1. Если в материалах учителя есть информация по теме — используй её как ПРИОРИТЕТНЫЙ источник.
2. Если материалов нет или их недостаточно — используй свои знания (и поиск, если доступен).
3. Подбирай этапы и сложность с учётом КЛАССА (${input.grade}). Не давай слишком сложное младшим и слишком простое старшим.
4. РАСПРЕДЕЛИ ВРЕМЯ так, чтобы СУММА duration_min всех этапов = ${input.durationMin}.
5. ВЫБОР content_type:
   - "presentation" — теория/объяснение (stage_type: "theory")
   - "code" — программирование, классы с информатикой (stage_type: "task")
   - "quiz_qia" — тест с вопросами (stage_type: "task")
   - "quiz_kahoot" — синхронный live-квиз с таймером (stage_type: "task")
   - "scratch" — визуальное программирование, 5–7 класс (stage_type: "task")
   - "wokwi" — Arduino/электроника, 8–11 класс (stage_type: "task")
   - "codesandbox" — веб-разработка, 9–11 класс (stage_type: "task")
   - "makecode" — игровое программирование, 5–9 класс (stage_type: "task")
   Внешние сервисы (scratch/wokwi/codesandbox/makecode) подбирай по соответствию класса и темы.
6. КОЛИЧЕСТВО ВОПРОСОВ КВИЗА: реши сам по длительности этапа (5 мин→3, 10 мин→5, 15 мин→8, 20 мин→10).
7. СЛОЖНОСТЬ (difficulty): "easy" / "medium" / "hard" — с учётом класса и темы.
8. РЕКОМЕНДУЕМЫЕ МАТЕРИАЛЫ: предложи 3–5 ПОИСКОВЫХ ЗАПРОСОВ (не ссылок) для подготовки учителя.

ФОРМАТ КАЖДОГО ЭТАПА:
{
  "stage_type": "theory" | "task",
  "content_type": "presentation" | "code" | "quiz_qia" | "quiz_kahoot" | "scratch" | "wokwi" | "codesandbox" | "makecode",
  "title": "Название этапа",
  "description": "Описание/инструкция для школьников",
  "difficulty": "easy" | "medium" | "hard",
  "duration_min": 10,
  "config": { "language": "python", "starter_code": "..." },
  "questions": [ { "question_text": "...", "options": ["A","B","C","D"], "correct_option_index": 0 } ]
}
("config" нужен только для code; "questions" — только для quiz_qia/quiz_kahoot.)

ВЕРНИ СТРОГО JSON следующей структуры (без markdown, без вступления):
{
  "lesson_title_suggestion": "...",
  "lesson_description_suggestion": "...",
  "stages": [ ... ],
  "recommendedSearches": ["запрос 1", "запрос 2", "запрос 3"],
  "classGrade": ${input.grade},
  "notes": "Короткий комментарий для учителя"
}

ВАЖНО:
- ТОЛЬКО валидный JSON, без markdown-обёрток.
- Сумма duration_min ВСЕХ этапов = ${input.durationMin}.
- Заголовки и описания на русском.`;
}

interface GenStage {
  stage_type?: string;
  content_type?: string;
  title?: string;
  description?: string;
  difficulty?: string;
  duration_min?: number;
  config?: Record<string, unknown>;
  questions?: unknown[];
}

interface GenResult {
  lesson_title_suggestion?: string;
  lesson_description_suggestion?: string;
  stages?: GenStage[];
  recommendedSearches?: string[];
  classGrade?: number;
  notes?: string;
}

function gradeFromGroupName(name: string | null | undefined, fallback: number): number {
  const m = (name ?? "").match(/(\d{1,2})/);
  const g = m ? parseInt(m[1]!, 10) : NaN;
  return Number.isFinite(g) && g >= 1 && g <= 12 ? g : fallback;
}

/** Coerce/clean one stage; returns null to drop an invalid one. */
function normalizeStage(s: GenStage): GenStage | null {
  if (!s || typeof s.title !== "string" || !s.title.trim()) return null;
  let ct = String(s.content_type ?? "presentation");
  if (!ALLOWED_CONTENT.includes(ct)) ct = "presentation";
  const stage_type = ct === "presentation" ? "theory" : "task";
  const difficulty = ["easy", "medium", "hard"].includes(String(s.difficulty)) ? s.difficulty : "medium";
  const duration_min = Number.isFinite(s.duration_min) && (s.duration_min as number) > 0
    ? Math.round(s.duration_min as number) : 5;
  // Quizzes require questions; drop if missing.
  if ((ct === "quiz_qia" || ct === "quiz_kahoot") && (!Array.isArray(s.questions) || s.questions.length === 0)) {
    return null;
  }
  return { ...s, title: s.title.trim(), content_type: ct, stage_type, difficulty, duration_min };
}

/** Rescale durations so they sum exactly to the lesson duration. */
function normalizeDurations(stages: GenStage[], target: number): void {
  const total = stages.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  if (total <= 0 || stages.length === 0) return;
  if (Math.abs(total - target) <= 5) return;
  const ratio = target / total;
  for (const s of stages) s.duration_min = Math.max(1, Math.round((s.duration_min ?? 0) * ratio));
  const newTotal = stages.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const last = stages[stages.length - 1];
  if (last) last.duration_min = Math.max(1, (last.duration_min ?? 0) + (target - newTotal));
}

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = (await req.json()) as {
    lesson_id: string;
    topic: string;
    grade?: number;
    duration_min?: number;
    use_web_search?: boolean;
    attached_materials?: AttachedMaterial[];
  };

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  // Verify ownership + pull group name/subject to derive grade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = await (db as any)
    .from("lessons")
    .select("group:groups!inner(teacher_id, name, subject)")
    .eq("id", body.lesson_id)
    .single();
  const group = lesson?.group as { teacher_id: string; name: string | null; subject: string | null } | null;
  if (!lesson || !group || group.teacher_id !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const grade = gradeFromGroupName(group.name, body.grade ?? 7);
  const subject = group.subject ?? "—";
  const durationMin = Math.max(5, Math.min(240, body.duration_min ?? 45));
  const materials = Array.isArray(body.attached_materials) ? body.attached_materials.slice(0, 10) : [];
  // Grounding only makes sense when there are no teacher files (per spec default).
  const wantSearch = body.use_web_search ?? materials.length === 0;

  const prompt = buildPrompt({ topic: body.topic.trim(), grade, subject, durationMin, materials });

  let result: GenResult | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    // First attempt honours the web-search flag; if grounding errors, later
    // attempts fall back to plain JSON mode so generation still succeeds.
    const useSearch = wantSearch && attempt === 0;
    const { text, error } = await callGemini(prompt, [], {
      temperature: 0.8,
      responseMimeType: "application/json",
      useSearch,
    });

    if (error) {
      console.error(`[ai-generate] attempt ${attempt} error:`, error);
      lastError = error;
      continue;
    }

    try {
      const parsed = JSON.parse(stripFences(text)) as GenResult;
      const rawStages = Array.isArray(parsed.stages) ? parsed.stages : [];
      const stages = rawStages
        .map(normalizeStage)
        .filter((s): s is GenStage => s !== null);
      if (stages.length === 0) {
        lastError = "Generated stages failed validation";
        continue;
      }
      normalizeDurations(stages, durationMin);
      result = {
        lesson_title_suggestion: parsed.lesson_title_suggestion ?? "",
        lesson_description_suggestion: parsed.lesson_description_suggestion ?? "",
        stages,
        recommendedSearches: Array.isArray(parsed.recommendedSearches)
          ? parsed.recommendedSearches.filter((q) => typeof q === "string").slice(0, 6)
          : [],
        classGrade: grade,
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };
    } catch (e: unknown) {
      console.error("[ai-generate] parse error:", text.slice(0, 300), (e as Error)?.message);
      lastError = "Generated JSON parse error";
    }
  }

  if (!result) {
    return NextResponse.json({ error: lastError || "Generation failed" }, { status: 500 });
  }

  return NextResponse.json({ ...result, external: EXTERNAL });
}
