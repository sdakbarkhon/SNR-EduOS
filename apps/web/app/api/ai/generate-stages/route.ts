import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { getGroupPerformance, groupPerformancePromptSection } from "@/lib/ai/group-performance";
import { getMySchoolNow } from "@/lib/school-time-server";
import { getSubjectKeyByLabel } from "@snr/core";
import { buildLessonGenerationPrompt, type CurriculumTopicContext } from "@/lib/ai/prompts";
import { generateSlideImage } from "@/lib/ai-imagen";
import { gradeFromGroupName, JUNIOR_GRADE_MAX } from "@/lib/group-grade";
import { schoolStoragePath } from "@snr/core";

// Hard cap on Imagen calls per generation (keeps us within maxDuration).
const MAX_SLIDE_IMAGES = 6;

export const runtime = "nodejs";
// 10.08.2026 — было 60, маршрут отваливался в 504 на проде.
//
// Столько он честно и работает: ниже цикл делает ДО ТРЁХ попыток
// generateJSON (модель отдаёт большой план урока, и при негодном ответе
// попытка повторяется), а следом генерируются картинки слайдов — до
// MAX_SLIDE_IMAGES штук. Три обращения к модели плюс шесть картинок в
// шестьдесят секунд не укладываются, и Vercel обрывал запрос.
//
// 300 — не «с запасом побольше», а тот же предел, что уже стоит у всех
// тяжёлых маршрутов проекта: stage-media/generate, rag/process-stage,
// teacher/homework/ai-review/run, curriculum-plans/[id]/background-parse.
// Он доступен: Fluid Compute у проекта включён (resourceConfig.fluid=true,
// подтверждено ответом Vercel API 10.08).
export const maxDuration = 300;

const ALLOWED_CONTENT = [
  "presentation", "code", "quiz_qia", "quiz_kahoot",
  "wokwi", "codesandbox",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js", "excalidraw", "learningapps", "sqlonline",
  // 08.08.2026 — Scratch как практика для младших. В промпте он предлагается
  // для 1-5 классов; без него в этом списке нормализация молча подменила бы
  // тип на presentation, то есть ровно на то, что мы и чиним.
  "scratch",
];
const EXTERNAL = [
  "wokwi", "codesandbox",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js", "excalidraw", "learningapps", "sqlonline",
  "scratch",
];

/** Scratch и Blockly как тип этапа — только младшим классам (то же правило,
 *  что в форме учителя, см. lib/group-grade.ts). Для старших модель иногда
 *  предлагает их «за компанию»; вместо отклонения всего плана переводим этап
 *  в code — деятельностный характер сохраняется, а это и было целью. */
const JUNIOR_ONLY_CONTENT = new Set(["scratch", "blockly_games"]);

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

/** 07.08.2026 — почти-попадания Gemini по content_type. Раньше любое из них
 *  молча превращалось в "presentation" (см. ниже), а слайдов у такого этапа
 *  нет — в уроке появлялась пустая презентация вместо квиза. Это и выглядело
 *  как «ИИ перестал делать Kahoot и тесты». */
/** Русские и разнорегистровые варианты уровня — см. комментарий в normalizeStage. */
const DIFFICULTY_ALIASES: Record<string, string> = {
  "лёгкий": "easy", "легкий": "easy", "простой": "easy",
  "средний": "medium", "обычный": "medium",
  "сложный": "hard", "трудный": "hard", "продвинутый": "hard",
};

const CONTENT_ALIASES: Record<string, string> = {
  quiz: "quiz_qia",
  qia: "quiz_qia",
  test: "quiz_qia",
  "quiz-qia": "quiz_qia",
  kahoot: "quiz_kahoot",
  "quiz-kahoot": "quiz_kahoot",
  quizkahoot: "quiz_kahoot",
};

function normalizeStage(s: GenStage, overallDifficulty: string): GenStage | null {
  if (!s || typeof s.title !== "string" || !s.title.trim()) return null;
  let ct = String(s.content_type ?? "presentation").trim().toLowerCase();
  if (!ALLOWED_CONTENT.includes(ct) && CONTENT_ALIASES[ct]) ct = CONTENT_ALIASES[ct]!;
  if (!ALLOWED_CONTENT.includes(ct)) {
    // Логируем ПЕРЕД подменой: раньше подмена была немой, и отличить
    // «модель не предложила квиз» от «предложила, но мы её не поняли» в
    // проде было невозможно.
    console.warn("[ai-generate] неизвестный content_type:", JSON.stringify(s.content_type), "→ presentation");
    ct = "presentation";
  }
  // Honour stage_type from AI (theory/task), fallback to ct-based
  const stage_type = ["theory", "task"].includes(String(s.stage_type ?? ""))
    ? s.stage_type
    : ct === "presentation" ? "theory" : "task";
  // 07.08.2026 — учитель выбирал «Лёгкий», а в БД ложилось medium. Причин две,
  // обе здесь: (1) запасным значением была ЛИТЕРАЛЬНАЯ "medium", а не то, что
  // выбрал учитель; (2) проверка регистрозависимая и только по-английски, а
  // весь промпт русский при temperature 0.85 — «Лёгкий», «легкий», «Easy»
  // одинаково не проходили и падали в ту же "medium".
  const rawDiff = String(s.difficulty ?? "").trim().toLowerCase();
  const mapped = DIFFICULTY_ALIASES[rawDiff] ?? rawDiff;
  const difficulty = ["easy", "medium", "hard"].includes(mapped) ? mapped : overallDifficulty;
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
    .select("group_id, curriculum_topic_id, subject_id, school_id, group:groups!inner(teacher_id, name, subject)")
    .eq("id", body.lesson_id)
    .single();
  const group = lesson?.group as { teacher_id: string; name: string | null; subject: string | null } | null;
  // Школа урока — для пути картинок слайдов: они грузятся служебным ключом,
  // а под ним current_school_id() пуст (миграции 188/189).
  const lessonSchoolId = (lesson?.school_id as string | undefined) ?? "";
  // No extra teacher_id equality check here — RLS on "lessons" already gates
  // this SELECT on is_my_teacher_group(group_id) (owner, subject-assigned,
  // or co-teacher via group_teachers), so a non-null result already proves
  // legitimate access. A straight groups.teacher_id comparison 403'd every
  // co-teacher/demo account that isn't the group's single primary owner.
  if (!lesson || !group) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const grade = gradeFromGroupName(group.name) ?? body.grade ?? 7;
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

  // Как эта группа учится по этому предмету. Уходит в ТОТ ЖЕ промпт ниже —
  // отдельного обращения к модели подстройка не стоит.
  //
  // Если группа новая и данных мало, справка пустая, и промпт получается
  // ровно таким, каким был до этой правки. Ветки «есть данные / нет данных» в
  // генерации нет: есть пустая строка.
  let performanceSection = "";
  try {
    const schoolNow = await getMySchoolNow(db);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subjRow } = await (db as any)
      .from("subjects").select("name").eq("id", (lesson as { subject_id: string | null }).subject_id).maybeSingle();
    const perf = await getGroupPerformance(db, {
      groupName: group.name ?? "",
      subjectKey: getSubjectKeyByLabel((subjRow as { name: string } | null)?.name) ?? "",
      todayIso: schoolNow.toISOString().slice(0, 10),
    });
    performanceSection = groupPerformancePromptSection(perf);
  } catch (e) {
    // Подсказка — надстройка над генерацией, а не её часть. Сбой здесь не
    // имеет права отменить урок: продолжаем без неё.
    console.error("[ai-generate] справка по группе не собралась:", (e as Error)?.message);
  }

  const prompt = buildLessonGenerationPrompt({
    topic: body.topic.trim(), grade, subject, durationMin, overallDifficulty, materials,
    curriculumTopic, kbMaterials,
    groupPerformance: performanceSection,
  });

  let result: GenResult | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const useSearch = wantSearch && attempt === 0;
    const { data: parsed, error } = await generateJSON<GenResult>(prompt, null, {
      model: "pro",
      temperature: 0.85,
      useSearch,
      usage: {
        task: AI_TASKS.generateStages,
        teacherId: teacher.id,
        // Школа берётся у урока, а не из current_school_id(): под служебным
        // ключом её там нет (миграции 188/189) — см. lessonSchoolId выше.
        schoolId: lessonSchoolId || null,
      },
    });

    if (error || !parsed) {
      console.error(`[ai-generate] attempt ${attempt} error:`, error);
      lastError = error || "Generated JSON parse error";
      continue;
    }

    const rawStages = Array.isArray(parsed.stages) ? parsed.stages : [];
    const stages = rawStages
      .map((s) => normalizeStage(s, overallDifficulty))
      .filter((s): s is GenStage => s !== null)
      .map((st) =>
        JUNIOR_ONLY_CONTENT.has(st.content_type ?? "") && grade > JUNIOR_GRADE_MAX
          ? { ...st, content_type: "code" }
          : st,
      );
    if (stages.length === 0) {
      lastError = "Generated stages failed validation";
      continue;
    }

    // 07.08.2026 — правило «в каждом уроке обязан быть квиз» и требование
    // разнообразия типов до сих пор существовали ТОЛЬКО как текст в промпте.
    // Цикл повторов рядом уже был, но срабатывал лишь на нечитаемый JSON —
    // план из четырёх презентаций проходил насквозь. Теперь план без квиза
    // считается неудачной попыткой и генерируется заново; на последней
    // попытке принимаем что есть, чтобы учитель не остался вообще без плана.
    const hasQuiz = stages.some((s) => s.content_type === "quiz_qia" || s.content_type === "quiz_kahoot");
    const distinctTypes = new Set(stages.map((s) => s.content_type)).size;
    const needQuiz = durationMin >= 20;

    // 08.08.2026 — тип этапа обязан соответствовать его РОЛИ. Модель ставила
    // "presentation" этапам с названием «Практическая работа»: на живых данных
    // так вышло у 107 этапов из 126 уроков. Ученик открывал практику и видел
    // слайды, а если слайдов не сгенерилось — пустой этап.
    //
    // Проверяем две вещи, обе однозначные и не требующие догадок:
    //   1) презентация без слайдов — показывать нечего;
    //   2) этап, названный практикой/заданием, с типом "presentation" —
    //      деятельность подменена показом.
    // Правило про квиз рядом (07.08.2026) устроено так же: текст в промпте без
    // проверки на выходе не работает, модель его игнорирует.
    const PRACTICE_TITLE = /практич|практика|задани|упражнен|лаборатор/i;
    const emptyPresentations = stages.filter(
      (s) => s.content_type === "presentation" && (!Array.isArray(s.slides) || s.slides.length === 0),
    );
    const practiceAsPresentation = stages.filter(
      (s) => s.content_type === "presentation" && PRACTICE_TITLE.test(s.title ?? ""),
    );

    if (
      attempt < 2 &&
      ((needQuiz && !hasQuiz) || distinctTypes < 2 || emptyPresentations.length > 0 || practiceAsPresentation.length > 0)
    ) {
      console.warn(
        `[ai-generate] attempt ${attempt}: план отклонён — квиз=${hasQuiz}, разных типов=${distinctTypes},`,
        `презентаций без слайдов=${emptyPresentations.length}, практик как презентация=${practiceAsPresentation.length};`,
        "типы:", stages.map((s) => s.content_type).join(","),
      );
      lastError = "Plan rejected: missing quiz, too little variety, slideless presentation or practice typed as presentation";
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
            const filename = schoolStoragePath(lessonSchoolId, body.lesson_id, `${Date.now()}-${idx}.png`);
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
