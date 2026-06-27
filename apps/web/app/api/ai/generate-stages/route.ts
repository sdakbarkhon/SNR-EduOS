import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai-gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  overallDifficulty: string;
  materials: AttachedMaterial[];
}): string {
  const hasFiles = input.materials.length > 0;
  const materialsContext = hasFiles
    ? input.materials
        .map((m) => `=== Материал "${m.title}" ===\n${m.text}`)
        .join("\n\n")
    : "Материалы не прикреплены.";

  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Предложить 8–10 ВАРИАНТОВ этапов урока на выбор учителя.

ВХОДНЫЕ ДАННЫЕ:
- Класс: ${input.grade}
- Предмет: ${input.subject}
- Тема урока: ${input.topic}
- Длительность урока: ${input.durationMin} минут
- Общий уровень сложности: ${input.overallDifficulty}

МАТЕРИАЛЫ ОТ УЧИТЕЛЯ:
${materialsContext}

ВАЖНО: Ты создаёшь СПИСОК ВАРИАНТОВ для выбора учителем, а НЕ последовательность на ${input.durationMin} мин.
НЕ пытайся сложить суммы длительности = ${input.durationMin}. Каждый этап — самостоятельный вариант.
Каждый этап имеет разумную длительность 5–30 мин.

ОБЯЗАТЕЛЬНО РАЗНООБРАЗИЕ ТИПОВ — используй разные content_type:
- "presentation" — теория/объяснение (stage_type: theory)
- "code" — программирование в Monaco редакторе
- "quiz_qia" — асинхронный тест с вопросами
- "quiz_kahoot" — синхронный live-квиз с таймером
- "scratch" — визуальное программирование блоками
- "makecode" — игровое программирование Microsoft
- "wokwi" — Arduino/электроника симуляция
- "codesandbox" — веб-разработка (HTML/CSS/JS)

ПРАВИЛА ВЫБОРА ТИПА ПО КЛАССУ (${input.grade} класс):
- scratch: классы 1–7 (игры, анимации, блочное программирование)
- makecode: классы 5–9 (2D игры, micro:bit, переход от Scratch к коду)
- wokwi: классы 7–11 (Arduino C++, электроника, физика, датчики)
- codesandbox: классы 9–11 (HTML/CSS/JavaScript, React, сайты)
- code: классы 7–11 (Python/JS/C++, алгоритмы)

ОБЯЗАТЕЛЬНО в 8–10 вариантах должны быть:
✓ Минимум 1 этап "presentation" (введение/теория)
✓ Минимум 1 практический этап (code/scratch/wokwi/codesandbox/makecode)
✓ Минимум 1 квиз (quiz_qia или quiz_kahoot)
✓ Если класс подходит — 1–2 внешних сервиса (scratch/wokwi/codesandbox/makecode)

СЛОЖНОСТЬ:
Общий уровень: ${input.overallDifficulty}
- easy: больше теории, базовые понятия, простые задачи
- medium: баланс теории и практики, средние задачи
- hard: упор на практику, сложные задачи, углубление
Делай основную часть этапов уровня ${input.overallDifficulty}, допустимы 1–2 варианта смежного уровня.

ФОРМАТ КАЖДОГО ЭТАПА (без config, без questions — только описание):
{
  "content_type": "presentation" | "code" | "quiz_qia" | "quiz_kahoot" | "scratch" | "wokwi" | "codesandbox" | "makecode",
  "title": "Короткое название этапа",
  "description": "Что конкретно будет делать ученик на этом этапе",
  "difficulty": "easy" | "medium" | "hard",
  "duration_min": 10
}

ВЕРНИ СТРОГО JSON (без markdown, без вступления):
{
  "stages": [ ... 8–10 вариантов ... ],
  "recommendedSearches": ["запрос 1", "запрос 2", "запрос 3", "запрос 4", "запрос 5"],
  "classGrade": ${input.grade},
  "notes": "Краткий комментарий для учителя о подборе этапов"
}

ВАЖНО: ТОЛЬКО валидный JSON. Заголовки и описания на русском.`;
}

interface GenStage {
  content_type?: string;
  title?: string;
  description?: string;
  difficulty?: string;
  duration_min?: number;
  // stage_type derived server-side
  stage_type?: string;
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

function normalizeStage(s: GenStage): GenStage | null {
  if (!s || typeof s.title !== "string" || !s.title.trim()) return null;
  let ct = String(s.content_type ?? "presentation");
  if (!ALLOWED_CONTENT.includes(ct)) ct = "presentation";
  const stage_type = ct === "presentation" ? "theory" : "task";
  const difficulty = ["easy", "medium", "hard"].includes(String(s.difficulty)) ? s.difficulty : "medium";
  // Clamp per-stage duration to 5–45 min; default 10
  const raw = Number(s.duration_min);
  const duration_min = Number.isFinite(raw) && raw > 0
    ? Math.max(5, Math.min(45, Math.round(raw))) : 10;
  return { ...s, title: s.title.trim(), content_type: ct, stage_type, difficulty, duration_min };
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
    overall_difficulty?: string;
    attached_materials?: AttachedMaterial[];
  };

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

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
  const overallDifficulty = ["easy", "medium", "hard"].includes(body.overall_difficulty ?? "")
    ? (body.overall_difficulty as string) : "medium";
  const materials = Array.isArray(body.attached_materials) ? body.attached_materials.slice(0, 10) : [];
  const wantSearch = body.use_web_search ?? materials.length === 0;

  const prompt = buildPrompt({ topic: body.topic.trim(), grade, subject, durationMin, overallDifficulty, materials });

  let result: GenResult | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const useSearch = wantSearch && attempt === 0;
    const { text, error } = await callGemini(prompt, [], {
      temperature: 0.85,
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
