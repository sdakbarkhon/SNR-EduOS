import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini-client";
import { buildLessonGenerationPrompt, type CurriculumTopicContext } from "@/lib/ai/prompts";
import { generateSlideImage } from "@/lib/ai-imagen";

// Hard cap on Imagen calls per generation (keeps us within maxDuration).
const MAX_SLIDE_IMAGES = 6;

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_CONTENT = [
  "presentation", "code", "quiz_qia", "quiz_kahoot",
  "wokwi", "codesandbox",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js", "excalidraw", "learningapps", "sqlonline",
  "h5p",
];
const EXTERNAL = [
  "wokwi", "codesandbox",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js", "excalidraw", "learningapps", "sqlonline",
  "h5p",
];

type AttachedMaterial = { title: string; text: string };

// subjects.name (RU) → books.subject slug — тот же словарь, что SUBJECTS
// в apps/web/app/teacher/books/TeacherBooksView.tsx. "Русский язык" не
// маппится намеренно — у books нет соответствующего slug (см. Часть 6,
// SUBJECT_NAME_TO_BOOK_SLUG usage): для него просто нет книжного фильтра.
const SUBJECT_NAME_TO_BOOK_SLUG: Record<string, string> = {
  "Математика": "math",
  "Физика": "physics",
  "Программирование": "programming",
  "Робототехника": "robotics",
  "Английский язык": "english",
  "Информатика": "informatics",
  "Химия": "chemistry",
  "Биология": "biology",
  "История": "history",
};

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

interface GenQuizQuestion {
  text?: string;
  options?: string[];
  correct_index?: number;
}

interface GenQuiz {
  questions?: GenQuizQuestion[];
}

interface GenStage {
  content_type?: string;
  title?: string;
  description?: string;
  teacher_notes?: string;
  starter_code?: string;
  programming_language?: string;
  slides?: GenSlide[];
  quiz?: GenQuiz;
  difficulty?: string;
  duration_min?: number;
  stage_type?: string;
}

const MAX_QUIZ_QUESTIONS = 8;

function normalizeQuiz(raw: GenQuiz | undefined): { questions: { text: string; options: string[]; correct_index: number }[] } | undefined {
  if (!raw || !Array.isArray(raw.questions)) return undefined;
  const questions = raw.questions
    .filter((q): q is Required<GenQuizQuestion> => {
      if (!q || typeof q.text !== "string" || !q.text.trim()) return false;
      if (!Array.isArray(q.options)) return false;
      const validOptions = q.options.filter((o) => typeof o === "string" && o.trim());
      if (validOptions.length < 2) return false;
      return Number.isInteger(q.correct_index) && q.correct_index! >= 0 && q.correct_index! < q.options.length;
    })
    .map((q) => ({
      text: q.text.trim(),
      options: q.options.map((o) => String(o).trim()),
      correct_index: q.correct_index,
    }))
    .slice(0, MAX_QUIZ_QUESTIONS);
  return questions.length > 0 ? { questions } : undefined;
}

const RUNNABLE_LANGUAGES = ["python", "cpp"];

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
  const programming_language = ct === "code"
    ? (RUNNABLE_LANGUAGES.includes(String(s.programming_language)) ? String(s.programming_language) : "python")
    : undefined;
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
  // Quiz questions only meaningful for quiz_qia (quiz_kahoot questions are added
  // manually by the teacher via KahootTeacherModal, matching the existing flow).
  const quiz = ct === "quiz_qia" ? normalizeQuiz(s.quiz) : undefined;
  return { ...s, title: s.title.trim(), content_type: ct, stage_type, difficulty, duration_min, teacher_notes, starter_code, programming_language, slides, quiz };
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
    .select("group_id, curriculum_topic_id, subject_id, group:groups!inner(teacher_id, name, subject)")
    .eq("id", body.lesson_id)
    .single();
  const group = lesson?.group as { teacher_id: string; name: string | null; subject: string | null } | null;
  // No extra teacher_id equality check here — RLS on "lessons" already gates
  // this SELECT on is_my_teacher_group(group_id) (owner, subject-assigned,
  // or co-teacher via group_teachers), so a non-null result already proves
  // legitimate access. A straight groups.teacher_id comparison 403'd every
  // co-teacher/demo account that isn't the group's single primary owner.
  if (!lesson || !group) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const grade = gradeFromGroupName(group.name, body.grade ?? 7);
  const subject = group.subject ?? "—";
  const durationMin = Math.max(5, Math.min(240, body.duration_min ?? 45));
  const overallDifficulty = ["easy", "medium", "hard"].includes(body.overall_difficulty ?? "")
    ? (body.overall_difficulty as string) : "medium";
  const materials = Array.isArray(body.attached_materials) ? body.attached_materials.slice(0, 10) : [];
  const wantSearch = body.use_web_search ?? materials.length === 0;

  // Промт 4, Часть 6: если у урока есть curriculum_topic_id (только новые уроки,
  // созданные через селектор темы из плана) — подтягиваем тему плана + метаданные
  // БЗ (course_materials/books по предмету) как доп. контекст для AI.
  // Существующие уроки (curriculum_topic_id всегда NULL) этот блок не затрагивает.
  let curriculumTopic: CurriculumTopicContext | null = null;
  let kbMaterials: string[] = [];
  const curriculumTopicId = (lesson as { curriculum_topic_id?: string | null }).curriculum_topic_id;
  if (curriculumTopicId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: topicRow } = await (db as any)
      .from("curriculum_plan_topics")
      .select("title, description, estimated_lessons")
      .eq("id", curriculumTopicId)
      .maybeSingle();
    if (topicRow) {
      curriculumTopic = {
        title: topicRow.title,
        description: topicRow.description ?? null,
        estimatedLessons: topicRow.estimated_lessons ?? 1,
      };

      const groupId = (lesson as { group_id: string }).group_id;
      const subjectId = (lesson as { subject_id: string | null }).subject_id;
      // "books.subject" — независимый slug, выбираемый учителем при загрузке
      // (SUBJECTS в TeacherBooksView.tsx), НЕ совпадает с groups.subject —
      // тот захардкожен в 'programming' для всех 3 групп ещё миграцией 97
      // (full reset), фильтр по нему молча терял бы Математику/Английский/
      // Русский. Резолвим настоящий предмет через subjects.name и мапим
      // на тот же slug-словарь, что использует форма загрузки книг.
      let booksSlug: string | null = null;
      if (subjectId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: subjectRow } = await (db as any)
          .from("subjects").select("name").eq("id", subjectId).maybeSingle();
        booksSlug = SUBJECT_NAME_TO_BOOK_SLUG[subjectRow?.name as string] ?? null;
      }

      // course_materials.subject тоже всегда равен groups.subject
      // ('programming' константа) — фильтр по нему исключил бы все
      // материалы для не-программирования, поэтому здесь достаточно
      // group_id (материалы группы общие для всех её предметов).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: cm }, { data: bk }] = await Promise.all([
        (db as any)
          .from("course_materials")
          .select("title, description")
          .eq("group_id", groupId)
          .limit(15),
        booksSlug
          ? (db as any).from("books").select("title, description").eq("subject", booksSlug).limit(15)
          : Promise.resolve({ data: [] }),
      ]);
      const cmRows = (cm ?? []) as Array<{ title: string; description: string | null }>;
      const bkRows = (bk ?? []) as Array<{ title: string; description: string | null }>;
      kbMaterials = [...cmRows, ...bkRows]
        .map((m) => (m.description ? `${m.title} — ${m.description}` : m.title))
        .slice(0, 25);
    }
  }

  const prompt = buildLessonGenerationPrompt({
    topic: body.topic.trim(), grade, subject, durationMin, overallDifficulty, materials,
    curriculumTopic, kbMaterials,
  });

  let result: GenResult | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const useSearch = wantSearch && attempt === 0;
    const { data: parsed, error } = await generateJSON<GenResult>(prompt, null, {
      model: "pro",
      temperature: 0.85,
      useSearch,
    });

    if (error || !parsed) {
      console.error(`[ai-generate] attempt ${attempt} error:`, error);
      lastError = error || "Generated JSON parse error";
      continue;
    }

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
