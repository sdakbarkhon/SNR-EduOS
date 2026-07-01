import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGemini } from "@/lib/ai-gemini";
import { generateSlideImage } from "@/lib/ai-imagen";

// Hard cap on Imagen calls per generation (keeps us within maxDuration).
const MAX_SLIDE_IMAGES = 6;

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

  // Optimal stage count based on lesson duration
  const stageCount = input.durationMin <= 30 ? "2–3" :
    input.durationMin <= 45 ? "3–4" :
    input.durationMin <= 60 ? "4–5" :
    input.durationMin <= 90 ? "5–6" : "6–8";

  const isProgramming = ["programming", "информатика", "робототехника", "informatika", "robotics", "code", "python", "web"].some(
    (kw) => input.subject.toLowerCase().includes(kw) || input.topic.toLowerCase().includes(kw),
  );

  const programmingSection = isProgramming ? `

СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ ПРОГРАММИРОВАНИЯ (subject = "${input.subject}"):
Для этапов content_type="code" используй паттерн прогрессии:
1. DEMO-этап: stage_type="theory", title начинается с "Демо:", teacher_notes содержит ПОЛНЫЙ рабочий код примера, description объясняет что происходит в коде.
2. PRACTICE-этап: stage_type="task", title начинается с "Практика:", starter_code = скелет с TODO-комментариями для ученика, description = что нужно дополнить, teacher_notes = готовое решение.
3. TASK-этап (если время позволяет): stage_type="task", title начинается с "Задание:", starter_code = только комментарии-инструкции (без кода), description = условие задачи, teacher_notes = эталонное решение.

ОБЯЗАТЕЛЬНО заполняй starter_code для PRACTICE и TASK этапов code!` : "";

  return `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: Создать ОПТИМАЛЬНЫЙ ПЛАН урока из ${stageCount} последовательных этапов на ${input.durationMin} минут.
Суммарная длительность всех этапов должна быть РОВНО ${input.durationMin} минут.

ВХОДНЫЕ ДАННЫЕ:
- Класс: ${input.grade}
- Предмет: ${input.subject}
- Тема урока: ${input.topic}
- Длительность урока: ${input.durationMin} минут
- Общий уровень сложности: ${input.overallDifficulty}

МАТЕРИАЛЫ ОТ УЧИТЕЛЯ:
${materialsContext}
${programmingSection}

ТИПЫ КОНТЕНТА (выбирай по предмету и классу):
- "presentation" — теория/объяснение (stage_type: "theory")
- "code" — программирование в Monaco редакторе (stage_type: "task")
- "quiz_qia" — асинхронный тест с вопросами (stage_type: "task")
- "quiz_kahoot" — синхронный live-квиз с таймером (stage_type: "task")
- "scratch" — визуальное блочное программирование, классы 1–7
- "makecode" — игровое программирование Microsoft, классы 5–9
- "wokwi" — Arduino/электроника симуляция, классы 7–11
- "codesandbox" — веб-разработка HTML/CSS/JS, классы 9–11

СЛОЖНОСТЬ:
Уровень: ${input.overallDifficulty}
- easy: больше теории, базовые понятия, простые задачи
- medium: баланс теории и практики
- hard: упор на практику, сложные задачи, углубление

ДЛЯ ЭТАПОВ ТЕОРИИ (content_type='presentation'):
Сгенерируй массив слайдов презентации в поле "slides".
Каждый слайд содержит:
- layout: ОДИН ИЗ "title" | "split" | "quote" | "code" | "default" (см. правила ниже)
- title: заголовок слайда (текст)
- content: содержимое в формате markdown (заголовки ##, списки -, **жирный**, параграфы)
- image_prompt: описание картинки НА АНГЛИЙСКОМ для генерации (только для layout='split')
- code: { language, content } — только для layout='code'
- quote: { text, author? } — только для layout='quote'

ПРАВИЛА ВЫБОРА layout:
- 'title' — ПЕРВЫЙ слайд урока: крупный заголовок темы + короткое вводное описание
- 'split' — визуальная концепция (объект, схема, процесс) — ОБЯЗАТЕЛЬНО заполни image_prompt
- 'code' — есть фрагмент кода для показа (для программирования/информатики) — заполни code.language и code.content
- 'quote' — важное определение или ключевая мысль крупным текстом — заполни quote.text (и quote.author, если это цитата человека, иначе не указывай)
- 'default' — обычный слайд с заголовком и текстом/списком (используй чаще всего)

Типичная структура: 1 слайд 'title' в начале, затем 3–5 слайдов 'default'/'split'/'code' по содержимому,
изредка один 'quote' для ключевого определения. НЕ делай все слайды одного layout.

ВАЖНО ДЛЯ СЛАЙДОВ:
- НИКАКИХ эмодзи в контенте
- Академический стиль, понятные формулировки для школьников
- Сам реши сколько слайдов нужно (обычно 3–6 на тему)

ФОРМАТ КАЖДОГО ЭТАПА:
{
  "content_type": "presentation"|"code"|"quiz_qia"|"quiz_kahoot"|"scratch"|"wokwi"|"codesandbox"|"makecode",
  "stage_type": "theory"|"task",
  "title": "Короткое название",
  "description": "Что конкретно будет делать УЧЕНИК на этом этапе (1–3 предложения)",
  "teacher_notes": "Педагогические подсказки для учителя: на что обратить внимание, типичные ошибки, решение, эталонный код",
  "starter_code": "Стартовый код для code-этапов (скелет или только комментарии — только для PRACTICE/TASK)",
  "slides": [
    { "layout": "title", "title": "...", "content": "..." },
    { "layout": "split", "title": "...", "content": "## ...\\n- ...", "image_prompt": "..." },
    { "layout": "code", "title": "...", "content": "Пояснение к коду", "code": { "language": "python", "content": "def f():\\n    pass" } },
    { "layout": "quote", "title": "...", "content": "", "quote": { "text": "...", "author": "..." } }
  ],
  "difficulty": "easy"|"medium"|"hard",
  "duration_min": число
}
(поле slides — ТОЛЬКО для content_type='presentation'; для остальных опусти)

ВЕРНИ СТРОГО JSON (без markdown, без вступления):
{
  "stages": [ ... ${stageCount} этапов ... ],
  "recommendedSearches": ["запрос 1", "запрос 2", "запрос 3"],
  "classGrade": ${input.grade},
  "notes": "Краткий комментарий учителю о структуре урока"
}

ВАЖНО: ТОЛЬКО валидный JSON. Заголовки и описания на русском. starter_code только для code-этапов.`;
}

interface GenSlide {
  layout?: string;
  title?: string;
  content?: string;
  image_prompt?: string;
  image_url?: string;
  code?: { language?: string; content?: string };
  quote?: { text?: string; author?: string };
}

const SLIDE_LAYOUTS = ["title", "split", "quote", "code", "default"];
const CODE_LANGUAGES = ["python", "javascript", "typescript", "cpp", "html", "css"];

function normalizeSlideLayout(raw: unknown): string {
  const layout = String(raw ?? "default");
  return SLIDE_LAYOUTS.includes(layout) ? layout : "default";
}

interface GenStage {
  content_type?: string;
  title?: string;
  description?: string;
  teacher_notes?: string;
  starter_code?: string;
  slides?: GenSlide[];
  difficulty?: string;
  duration_min?: number;
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
  // Honour stage_type from AI (theory/task), fallback to ct-based
  const stage_type = ["theory", "task"].includes(String(s.stage_type ?? ""))
    ? s.stage_type
    : ct === "presentation" ? "theory" : "task";
  const difficulty = ["easy", "medium", "hard"].includes(String(s.difficulty)) ? s.difficulty : "medium";
  // Clamp per-stage duration to 5–60 min; default 10
  const raw = Number(s.duration_min);
  const duration_min = Number.isFinite(raw) && raw > 0
    ? Math.max(5, Math.min(60, Math.round(raw))) : 10;
  const teacher_notes = typeof s.teacher_notes === "string" && s.teacher_notes.trim()
    ? s.teacher_notes.trim() : undefined;
  const starter_code = typeof s.starter_code === "string" && s.starter_code.trim()
    ? s.starter_code.trim() : undefined;
  // Slides only meaningful for presentation stages
  const slides = ct === "presentation" && Array.isArray(s.slides)
    ? s.slides
        .filter((sl): sl is GenSlide => !!sl && typeof sl.title === "string" && typeof sl.content === "string")
        .map((sl) => {
          const layout = normalizeSlideLayout(sl.layout);
          const code = layout === "code" && sl.code && typeof sl.code.content === "string" && sl.code.content.trim()
            ? {
                language: CODE_LANGUAGES.includes(String(sl.code.language)) ? String(sl.code.language) : "python",
                content: sl.code.content.trim(),
              }
            : undefined;
          const quote = layout === "quote" && sl.quote && typeof sl.quote.text === "string" && sl.quote.text.trim()
            ? {
                text: sl.quote.text.trim(),
                ...(typeof sl.quote.author === "string" && sl.quote.author.trim() ? { author: sl.quote.author.trim() } : {}),
              }
            : undefined;
          return {
            layout,
            title: sl.title!.trim(),
            content: sl.content!.trim(),
            ...(layout === "split" && typeof sl.image_prompt === "string" && sl.image_prompt.trim()
              ? { image_prompt: sl.image_prompt.trim() } : {}),
            ...(code ? { code } : {}),
            ...(quote ? { quote } : {}),
          };
        })
        .slice(0, 8)
    : undefined;
  return { ...s, title: s.title.trim(), content_type: ct, stage_type, difficulty, duration_min, teacher_notes, starter_code, slides };
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

  // ── Imagen: generate slide illustrations in parallel, upload to storage ──────
  // Collect every slide that requested an image (capped). Failures are silent —
  // the slide just renders without an image and stage creation is never blocked.
  const slideTasks: GenSlide[] = [];
  for (const stage of result.stages ?? []) {
    if (stage.content_type !== "presentation" || !Array.isArray(stage.slides)) continue;
    for (const slide of stage.slides) {
      if (slide.image_prompt && slideTasks.length < MAX_SLIDE_IMAGES) slideTasks.push(slide);
    }
  }

  if (slideTasks.length > 0) {
    let admin: ReturnType<typeof createAdminClient> | null = null;
    try { admin = createAdminClient(); } catch { admin = null; }

    if (admin) {
      const adminClient = admin;
      await Promise.all(
        slideTasks.map(async (slide, idx) => {
          try {
            const base64 = await generateSlideImage(slide.image_prompt!);
            if (!base64) return;
            const buffer = Buffer.from(base64, "base64");
            const filename = `${body.lesson_id}/${Date.now()}-${idx}.png`;
            const { error: upErr } = await adminClient.storage
              .from("slide-images")
              .upload(filename, buffer, { contentType: "image/png", upsert: false });
            if (upErr) { console.warn("[ai-generate] slide upload failed:", upErr.message); return; }
            const { data: pub } = adminClient.storage.from("slide-images").getPublicUrl(filename);
            if (pub?.publicUrl) slide.image_url = pub.publicUrl;
          } catch (e) {
            console.warn("[ai-generate] slide image error:", (e as Error)?.message);
          }
        }),
      );
    }
  }

  return NextResponse.json({ ...result, external: EXTERNAL });
}
