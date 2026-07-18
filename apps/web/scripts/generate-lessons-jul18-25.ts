#!/usr/bin/env -S npx tsx
// Пачка 4 → Пачка 5.2 — генератор контента для уроков 18-25 июля 2026.
// Переведён с .mjs на .ts (запуск через tsx — уже используется в проекте,
// см. package.json "seed:demo-iter4"), чтобы использовать ОДНУ и ту же
// generateLessonContent() (apps/web/lib/ai/generate-lesson-content.ts),
// что и задумано Пачкой 5.2 — "Единая функция... используется в обоих
// местах" (второе место — UI-инструмент учителя /api/ai/generate-stages,
// который сознательно НЕ трогали: он архитектурно другой генератор —
// гибкий список произвольных этапов/внешних сервисов с контекстом
// учебного плана, а не жёсткая FULL/SIMPLE-схема theory+practice+quiz;
// перевод его на generateLessonContent() урезал бы учителю возможности).
//
// Работает НАД УЖЕ СУЩЕСТВУЮЩЕЙ структурой (create-lesson-slots-jul18-31.mjs
// уже создал пустые уроки со scaffolding) — этот скрипт их НЕ создаёт,
// только заполняет контентом те, что ещё пустые.
//
// ЗАПУСК (из apps/web):
//   npx tsx --env-file=.env.local scripts/generate-lessons-jul18-25.ts --dry-run
//   npx tsx --env-file=.env.local scripts/generate-lessons-jul18-25.ts --confirm
//   npx tsx --env-file=.env.local scripts/generate-lessons-jul18-25.ts --confirm --limit-per-run=40
//
// Аргументы — те же, что были у .mjs-версии:
//   --confirm               обязателен для боевого запуска; без него — dry-run
//   --dry-run                явный dry-run (тоже работает без --confirm)
//   --limit-per-run=N        максимум РЕАЛЬНЫХ Gemini-вызовов ПО ТЕМЕ (не
//                            путать с общим числом вызовов — на урок теперь
//                            2 вызова: тема + контент, см. ниже) за прогон
//                            (default 40)
//   --date-from=YYYY-MM-DD   default 2026-07-18
//   --date-to=YYYY-MM-DD     default 2026-07-25 (включительно)
//
// ВАЖНО (Пачка 5.2, изменение поведения квоты): раньше на урок был 1
// Gemini-вызов (тема+контент одним промтом). generateLessonContent()
// делает РОВНО 1 вызов (по ТЗ Пачки 5.2), но тема теперь выбирается
// ОТДЕЛЬНЫМ вызовом до неё (proposeNextTopic ниже) — на урок стало 2
// реальных вызова Gemini вместо 1, оба считаются в ai_usage_log. При том
// же --limit-per-run квота на прогон расходуется вдвое быстрее по числу
// обработанных уроков.

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { generateLessonContent, type LessonContent, type LessonFormat } from "../lib/ai/generate-lesson-content";
import { generateSlideImage } from "../lib/ai-imagen";

// ── env + clients (service-role) ────────────────────────────────────────
function loadEnvFallback(): Record<string, string> {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const envFallback = loadEnvFallback();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFallback.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFallback.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? envFallback.GEMINI_API_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и GEMINI_API_KEY в .env.local.");
  console.error("Запускай так: npx tsx --env-file=.env.local scripts/generate-lessons-jul18-25.ts [--dry-run|--confirm]");
  process.exit(1);
}
// generateLessonContent()/generateSlideImage() читают process.env напрямую
// (не принимают ключ параметром) — гарантируем, что он там есть независимо
// от того, сработал ли --env-file или только ручной fallback-парсер выше.
process.env.GEMINI_API_KEY = GEMINI_API_KEY;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name: string): boolean { return argv.includes(`--${name}`); }
function opt(name: string, def: string): string {
  const pfx = `--${name}=`;
  const found = argv.find((a) => a.startsWith(pfx));
  return found ? found.slice(pfx.length) : def;
}
const CONFIRM = flag("confirm");
const EXPLICIT_DRY = flag("dry-run");
const DRY_RUN = !CONFIRM || EXPLICIT_DRY;
if (CONFIRM && EXPLICIT_DRY) {
  console.warn("Указаны и --confirm, и --dry-run одновременно — выигрывает dry-run (безопаснее).");
}
const LIMIT_PER_RUN = Number(opt("limit-per-run", "40")) || 40;
const DATE_FROM = opt("date-from", "2026-07-18");
const DATE_TO = opt("date-to", "2026-07-25"); // inclusive

const TZ_OFFSET = "+05:00";
const rangeStartIso = `${DATE_FROM}T00:00:00${TZ_OFFSET}`;
const rangeEndExclusiveIso = new Date(new Date(`${DATE_TO}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(70));
console.log(`Генерация контента уроков ${DATE_FROM}..${DATE_TO}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД, Gemini не вызываем)" : "БОЕВОЙ (пишем в БД + вызываем Gemini)"}`);
console.log(`limit-per-run: ${LIMIT_PER_RUN} (уроков; по 2 Gemini-вызова каждый — тема + контент)`);
console.log("═".repeat(70));

// ── rate limiting: 6.5с между Gemini-вызовами (тема + модель-пинг) ───────
const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── выбор рабочей модели (для вызова "тема", generateLessonContent сама
//    фиксирует gemini-2.5-flash по ТЗ Пачки 5.2) ─────────────────────────
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
let modelName: string | null = null;
async function pickWorkingModel(): Promise<string | null> {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      console.log(`Используем модель (для темы): ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${((e as Error).message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}

// ── FULL/SIMPLE классификация + practice_kind (Пачка 5.2 — content_type
//    для SIMPLE-предметов: 'learningapps' — тот же тип, что уже реально
//    используется в БД для Русского/Математики/Английского практики
//    (проверено live-запросом: content_type='learningapps' на предмете
//    "Русский язык" — не только для программирования, вопреки исходному
//    предположению, что он "внешний" только для FULL). ──────────────────
const GRADE_BY_GROUP: Record<string, number> = { "3-А класс": 3, "7-А класс": 7, "10-А класс": 10 };
const FULL_SUBJECTS = new Set(["Программирование", "Робототехника"]);
const PRACTICE_KIND_BY_SUBJECT: Record<string, (group: string) => string> = {
  "Программирование": (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  "Робототехника": () => "wokwi",
};
const SIMPLE_PRACTICE_KIND = "learningapps";

// ── тема урока: отдельный лёгкий Gemini-вызов (generateLessonContent
//    берёт topic как ГОТОВЫЙ вход, не предлагает её сама — см. ТЗ Пачки
//    5.2 сигнатуры) ────────────────────────────────────────────────────
const TOPIC_SYSTEM_PROMPT = `Ты — методист. Предложи СЛЕДУЮЩУЮ тему урока в естественной программе
обучения для заданного предмета/класса, не повторяя уже пройденные темы.
Верни СТРОГО JSON: {"topic": "короткое конкретное название темы"}. Ничего
больше.`;

function stripFences(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function proposeNextTopic(subjectName: string, grade: number, usedTopics: string[]): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: modelName!,
    systemInstruction: TOPIC_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });
  const userPrompt = `Предмет: ${subjectName}\nКласс: ${grade}\nУже пройденные темы (не повторять): ${usedTopics.length ? usedTopics.join("; ") : "(пока нет — это первая тема)"}`;
  const result = await model.generateContent(userPrompt);
  const parsed = JSON.parse(stripFences(result.response.text())) as { topic?: string };
  return parsed.topic?.trim() || subjectName;
}

// Пачка 4/5.2 — тот же increment_ai_usage() RPC (миграция 136), что
// apps/web/lib/ai/gemini-client.ts's bumpAiUsage() зовёт на каждый
// успешный вызов из веб-приложения. Awaited (не fire-and-forget) — скрипт
// не UI, тихий пропуск инкремента исказил бы видимый расход квоты сильнее.
async function bumpAiUsageAwaited() {
  const { error } = await db.rpc("increment_ai_usage");
  if (error) console.error(`  !! increment_ai_usage failed: ${error.message}`);
}

// ── Пачка 5.2, Задача E — плейсхолдеры [image: описание] → реальные
//    картинки. generateSlideImage() (lib/ai-imagen.ts) уже сама решает
//    Imagen (платный tier, недоступен на текущем ключе — см. lib/ai-imagen.ts
//    комментарий, уже подтверждено живым тестом в прошлой сессии: 404
//    независимо от ключа) vs Pollinations.ai (бесплатно, без ключа,
//    реально работает) — здесь просто вызываем и, если получилось,
//    заливаем в тот же Storage-бакет slide-images, что и /api/ai/
//    generate-stages, и подменяем плейсхолдер на markdown ![]() — рендерer
//    слайдов уже понимает markdown-картинки, доп. UI-правок не требует.
//    Если генерация/заливка не удалась — плейсхолдер остаётся текстом как
//    есть (Задача E, ветка "если не сработало").
const IMAGE_PLACEHOLDER_RE = /\[image:\s*([^\]]+)\]/gi;
const MAX_IMAGES_PER_LESSON = 8;
const IMAGE_CALL_DELAY_MS = 2000;

async function resolveImagePlaceholders(
  slides: LessonContent["theory"]["slides"],
  lessonId: string,
): Promise<{ slides: LessonContent["theory"]["slides"]; imagesGenerated: number; imagesFailed: number }> {
  let imagesGenerated = 0;
  let imagesFailed = 0;
  let callCount = 0;

  const resolvedSlides = [];
  for (const slide of slides) {
    let content = slide.content;
    const matches = [...content.matchAll(IMAGE_PLACEHOLDER_RE)];
    for (const m of matches) {
      if (callCount >= MAX_IMAGES_PER_LESSON) break;
      const description = m[1]!.trim();
      if (callCount > 0) await sleep(IMAGE_CALL_DELAY_MS);
      callCount++;
      try {
        const base64 = await generateSlideImage(description);
        if (!base64) { imagesFailed++; continue; }
        const buffer = Buffer.from(base64, "base64");
        const filename = `${lessonId}/${Date.now()}-${callCount}.png`;
        const { error: upErr } = await db.storage
          .from("slide-images")
          .upload(filename, buffer, { contentType: "image/png", upsert: false });
        if (upErr) { console.warn(`  !! slide image upload failed: ${upErr.message}`); imagesFailed++; continue; }
        const { data: pub } = db.storage.from("slide-images").getPublicUrl(filename);
        if (pub?.publicUrl) {
          content = content.replace(m[0], `![${description}](${pub.publicUrl})`);
          imagesGenerated++;
        } else {
          imagesFailed++;
        }
      } catch (e) {
        console.warn(`  !! image generation error for "${description}": ${(e as Error)?.message}`);
        imagesFailed++;
      }
    }
    resolvedSlides.push({ ...slide, content });
  }
  return { slides: resolvedSlides, imagesGenerated, imagesFailed };
}

const STAGE_DURATIONS_FULL = { theory: 70, practice: 90, quiz: 25 };
const STAGE_DURATIONS_SIMPLE = { theory: 20, practice: 15, quiz: 15 };
const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

// ── чекпоинт (резюмируемый) ────────────────────────────────────────────────
const LOG_PATH = path.resolve(process.cwd(), "scripts/.lessons-progress-jul18-25.json");
type ProgressLog = { done: Record<string, boolean>; results: Array<Record<string, unknown>> };
function loadLog(): ProgressLog {
  return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {}, results: [] };
}
function saveLog(log: ProgressLog) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// Формирует lesson_stages-строки из LessonContent (Пачка 5.2 схема) —
// НЕ меняет структуру lesson_stages, только маппит новые поля
// (practice.tasks, quiz.explanation) в существующие текстовые/config-поля,
// т.к. под них нет отдельных колонок и миграция не запрошена:
//  - practice.tasks[] → пронумерованный список внутри description +
//    структурированно в config.tasks (для будущего использования, ничего
//    не ломает — config уже jsonb произвольной формы для др. content_type).
//  - quiz.explanation → в teacher_notes quiz-этапа (учителю видно,
//    ученику при прохождении quiz — как и раньше, explanation не палится).
function buildStagesToInsert(
  content: LessonContent,
  format: LessonFormat,
  practiceKind: string,
  practiceLanguage: "python" | null,
) {
  const durations = format === "FULL" ? STAGE_DURATIONS_FULL : STAGE_DURATIONS_SIMPLE;
  const theoryTitle = content.theory.slides[0]?.title ?? "Теория";
  const practiceTasksList = content.practice.tasks
    .map((t, i) => `${i + 1}. ${t.text}${t.expected_answer ? ` (ответ: ${t.expected_answer})` : ""}`)
    .join("\n");
  const practiceDescription = `${content.practice.description}\n\n**Задания:**\n${practiceTasksList}`;
  const quizExplanations = content.quiz.questions
    .map((q, i) => `${i + 1}. ${q.question}\nПояснение: ${q.explanation}`)
    .join("\n\n");

  return [
    {
      position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation",
      title: theoryTitle, description: null, slides: content.theory.slides,
      difficulty: "medium", duration_min: durations.theory,
    },
    {
      position: 2, stage_role: "middle", stage_type: "task", content_type: practiceKind,
      title: "Практика", description: practiceDescription,
      teacher_notes: `Структурированные задания:\n${JSON.stringify(content.practice.tasks, null, 2)}`,
      ...(practiceLanguage ? { starter_code: "", programming_language: practiceLanguage } : {}),
      config: practiceKind === "code" ? { tasks: content.practice.tasks } : { url: "", requires_link: true, requires_screenshot: false, tasks: content.practice.tasks },
      difficulty: "medium", duration_min: durations.practice,
    },
    {
      position: 3, stage_role: "middle", stage_type: "task", content_type: "quiz_qia",
      title: "Тест", description: null, teacher_notes: quizExplanations,
      config: { time_limit_minutes: null, points_per_question: 1 },
      difficulty: "medium", duration_min: durations.quiz,
    },
  ];
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();

  const { data: usageBefore } = await db.rpc("get_ai_usage_today");
  console.log(`\nai_usage_log до запуска: ${usageBefore ?? "?"} / 250`);

  const { data: allLessons, error: fetchErr } = await db
    .from("lessons")
    .select("id, starts_at, group:groups(name), subject:subjects(name)")
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });
  if (fetchErr) throw new Error(`fetch lessons: ${fetchErr.message}`);

  const { data: stageRows, error: stageErr } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  if (stageErr) throw new Error(`fetch stages: ${stageErr.message}`);
  const hasMiddle = new Set((stageRows ?? []).map((r: { lesson_id: string }) => r.lesson_id));

  const { data: filledWithStages, error: filledErr } = await db
    .from("lessons")
    .select("id, topic, group:groups(name), subject:subjects(name)")
    .in("id", [...hasMiddle]);
  if (filledErr) throw new Error(`fetch used topics: ${filledErr.message}`);
  const usedTopicsByKey = new Map<string, string[]>();
  for (const l of (filledWithStages ?? []) as unknown as Array<{ topic: string | null; group: { name: string } | null; subject: { name: string } | null }>) {
    if (!l.topic || !l.subject?.name || !l.group?.name) continue;
    const key = `${l.subject.name}|${l.group.name}`;
    const arr = usedTopicsByKey.get(key) ?? [];
    if (!arr.includes(l.topic)) arr.push(l.topic);
    usedTopicsByKey.set(key, arr);
  }

  const log = loadLog();
  console.log(`Уроков в диапазоне ${DATE_FROM}..${DATE_TO}: ${allLessons!.length}`);

  if (!DRY_RUN) {
    modelName = await pickWorkingModel();
    if (!modelName) {
      console.warn("Ни одна модель недоступна (дневной лимит исчерпан?). Прогресс не потерян — повторите позже.");
      return;
    }
  }

  let lessonsThisRun = 0;
  let done = 0, skipped = 0, errors = 0;

  for (let i = 0; i < allLessons!.length; i++) {
    const lessonSpec = allLessons![i] as unknown as { id: string; starts_at: string; group: { name: string } | null; subject: { name: string } | null };
    const n = i + 1;
    const subjectName = lessonSpec.subject?.name ?? "";
    const groupName = lessonSpec.group?.name ?? "";
    const isFull = FULL_SUBJECTS.has(subjectName);
    const format: LessonFormat = isFull ? "FULL" : "SIMPLE";
    const logPrefix = `[${n}/${allLessons!.length}] ${groupName} · ${lessonSpec.starts_at.slice(0, 10)} · ${lessonSpec.starts_at.slice(11, 16)} · ${subjectName} [${format}]`;

    const alreadyDone = hasMiddle.has(lessonSpec.id) || log.done[lessonSpec.id];
    if (alreadyDone) {
      console.log(`${logPrefix} → SKIPPED (already has content)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${logPrefix} → [DRY-RUN] would generate`);
      done++;
      continue;
    }

    if (lessonsThisRun >= LIMIT_PER_RUN) {
      console.log(`${logPrefix} → SKIPPED (limit-per-run=${LIMIT_PER_RUN} достигнут в этом запуске, останется на следующий)`);
      skipped++;
      continue;
    }

    const grade = GRADE_BY_GROUP[groupName] ?? 7;
    const practiceKindFn = isFull ? PRACTICE_KIND_BY_SUBJECT[subjectName] : null;
    if (isFull && !practiceKindFn) {
      console.error(`${logPrefix} → ERROR (нет practice_kind для "${subjectName}")`);
      log.results.push({ id: lessonSpec.id, error: "no_practice_kind" });
      errors++;
      continue;
    }
    const practiceKind = practiceKindFn ? practiceKindFn(groupName) : SIMPLE_PRACTICE_KIND;
    const key = `${subjectName}|${groupName}`;
    const usedTopics = usedTopicsByKey.get(key) ?? [];

    lessonsThisRun++;
    let topic: string;
    let content: LessonContent;
    try {
      await throttle();
      topic = await proposeNextTopic(subjectName, grade, usedTopics);
      await bumpAiUsageAwaited();

      await throttle();
      content = await generateLessonContent({ subject_name: subjectName, topic, group_grade: grade, format });
      await bumpAiUsageAwaited();
    } catch (e) {
      const err = e as Error & { status?: number };
      console.error(`${logPrefix} → ERROR (Gemini: ${(err.message ?? "").split("\n")[0]})`);
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: err.message });
      saveLog(log);
      errors++;
      if (err instanceof GoogleGenerativeAIFetchError && err.status === 429) {
        console.warn("  429 — квота, вероятно, исчерпана. Прогресс сохранён, повторите запуск позже.");
      }
      continue;
    }

    usedTopicsByKey.set(key, [...usedTopics, topic]);

    const { error: topicErr } = await db.from("lessons").update({ topic, title: topic }).eq("id", lessonSpec.id);
    if (topicErr) console.error(`  !! lesson topic update failed: ${topicErr.message}`);

    const { slides: resolvedSlides, imagesGenerated, imagesFailed } = await resolveImagePlaceholders(content.theory.slides, lessonSpec.id);
    content.theory.slides = resolvedSlides;
    if (imagesGenerated || imagesFailed) {
      console.log(`  картинки: ${imagesGenerated} сгенерировано, ${imagesFailed} не удалось (остались как [image: ...])`);
    }

    const practiceLanguage = practiceKind === "code" ? "python" : null;
    const stagesToInsert = buildStagesToInsert(content, format, practiceKind, practiceLanguage);

    let quizStageId: string | null = null;
    let writeOk = true;
    for (const stage of stagesToInsert) {
      const { data: insertedStage, error: insErr } = await db
        .from("lesson_stages")
        .insert({ lesson_id: lessonSpec.id, school_id: SCHOOL_ID, ...stage })
        .select("id, content_type")
        .single();
      if (insErr) {
        console.error(`  !! stage insert failed (${stage.content_type}): ${insErr.message}`);
        writeOk = false;
        continue;
      }
      if (insertedStage.content_type === "quiz_qia") quizStageId = insertedStage.id;
    }

    if (quizStageId && content.quiz.questions.length) {
      const rows = content.quiz.questions.map((q, qi) => ({
        stage_id: quizStageId, school_id: SCHOOL_ID, position: qi, question_text: q.question, options: q.options,
        correct_option_index: q.correct_index, points: 1, time_per_question_seconds: 20,
      }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    }

    log.done[lessonSpec.id] = true;
    log.results.push({
      id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName,
      format, topic, slides: content.theory.slides.length, tasks: content.practice.tasks.length,
      questions: content.quiz.questions.length, imagesGenerated, imagesFailed, writeOk,
    });
    saveLog(log);
    console.log(`${logPrefix} → OK: "${topic}" (${content.theory.slides.length} слайдов, ${content.practice.tasks.length} задач, ${content.quiz.questions.length} вопросов)`);
    done++;
  }

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  console.log(`  ${DRY_RUN ? "Было бы сгенерировано" : "Сгенерировано"}: ${done}`);
  console.log(`  Пропущено (уже готово / вне лимита): ${skipped}`);
  console.log(`  Ошибок: ${errors}`);
  if (!DRY_RUN) {
    const { data: usageAfter } = await db.rpc("get_ai_usage_today");
    console.log(`  ai_usage_log до запуска: ${usageBefore ?? "?"} / 250`);
    console.log(`  ai_usage_log после запуска: ${usageAfter ?? "?"} / 250`);
  }
  console.log(`  Время выполнения: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);
  const stillPending = allLessons!.filter((l) => !(hasMiddle.has((l as { id: string }).id) || log.done[(l as { id: string }).id])).length;
  if (!DRY_RUN && stillPending > 0) {
    console.log(`\n  Осталось необработанных: ${stillPending}. Для добивания — тот же запуск ещё раз:`);
    console.log(`  npx tsx --env-file=.env.local scripts/generate-lessons-jul18-25.ts --confirm --limit-per-run=${LIMIT_PER_RUN}`);
  }
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
