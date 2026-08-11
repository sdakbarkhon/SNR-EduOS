#!/usr/bin/env node
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 2: AI-этапы для 49 уроков, созданных
// заново после аварии ночного отката (scripts/restore-demo-lessons.mjs).
//
// Основа — scripts/generate-stages-jul28-30.mjs, тот самый механизм, которым
// наполнялась часть эталонной недели. Промпт, валидация, троттлинг и
// повторы взяты оттуда без изменений: он уже дал ровно тот профиль, который
// сейчас у уцелевших уроков (замерено живым запросом 09.08):
//   pos 1  «Изучение материала»   presentation/theory  15 мин  5-7 слайдов
//   pos 2  «Демонстрация учителя» по предмету          10 мин
//   pos 3  практика               по предмету          12 мин
//   pos 4  «Проверка знаний»      quiz_qia/task         8 мин  4 вопроса
//   pos 9999 «Итог урока»         presentation/theory  — обновляем, не дублируем
// Сумма 15+10+12+8 = 45 — как у всех 77 уцелевших уроков.
//
// ОТЛИЧИЯ ОТ ИСХОДНОГО СКРИПТА, оба намеренные:
//  1. Цель — не диапазон дат, а точный список идентификаторов из
//     scripts/.restored-lessons.json. Уцелевшие уроки не могут попасть под
//     обработку даже теоретически.
//  2. Практика на слайдах (математика/русский/английский) называется
//     «Разбор примеров», а не «Практическая работа» — переименование из
//     коммита 6c2dccd. У уцелевших уроков этих предметов ровно так: 39
//     этапов «Разбор примеров» против нуля «Практических работ».
//     Заодно это и есть правило из 6289c28: тип этапа обязан отвечать роли,
//     и слайды не должны называться практикой.
//
// КАРТИНКИ здесь не генерируются — это отдельный шаг
// (scripts/restore-demo-stage-media.mjs), потому что фоновый вызов
// /api/stage-media/generate уходит только из браузера (см. addLessonStage
// в packages/core: проверка "window" in globalThis).
//
// ИДЕМПОТЕНТНОСТЬ: урок с middle-этапами пропускается; сделанное
// отмечается в scripts/.restore-stages-progress.json, так что после сбоя
// или дневного лимита Gemini достаточно перезапустить.
//
// ЗАПУСК (из apps/web):
//   node scripts/restore-demo-stages.mjs                # холостой прогон
//   node scripts/restore-demo-stages.mjs --apply --limit=1   # один урок
//   node scripts/restore-demo-stages.mjs --apply        # остальные

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID, loadEnvLocal } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.slice("--limit=".length), 10) : Infinity;

// 11.08.2026 — РЕЖИМ ДОБОРА (--fill-thin).
//
// После четырёх заходов уборки шаблонных заготовок у части уроков демо-школы
// осталось 1-2 содержательных этапа вместо четырёх: заготовки составляли их
// почти целиком. Мусор убран правильно, но на его месте дыра, и заказчик
// увидит на показе урок из одного этапа.
//
// Второй генератор ради этого не заводим — берём ЭТОТ, он уже делает ровно
// тот профиль, что у уцелевших уроков (замерено заново 11.08 и совпало со
// снятым в шапке). Отличий от обычного режима два:
//   • цель — не список из .restored-lessons.json, а уроки демо-школы с 1-3
//     содержательными этапами;
//   • создаются ТОЛЬКО недостающие позиции. Существующие этапы, их вопросы и
//     работы учеников не трогаются вовсе.
const FILL_THIN = process.argv.includes("--fill-thin");

const IDS_PATH = new URL("./.restored-lessons.json", import.meta.url);
const LOG_PATH = path.resolve(process.cwd(),
  FILL_THIN ? "scripts/.fill-thin-progress.json" : "scripts/.restore-stages-progress.json");

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const env = loadEnvLocal();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) fail("GEMINI_API_KEY отсутствует в .env.local.");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── профиль этапов по предмету ──────────────────────────────────────────────
function practiceKindFor(subjectName) {
  if (subjectName === "Программирование") return "code";
  if (subjectName === "Робототехника") return "wokwi";
  return "slides";
}
function programmingLanguageFor(topic) { return /c\+\+/i.test(topic) ? "cpp" : "python"; }
/** Практика на слайдах — «Разбор примеров» (коммит 6c2dccd). Практикой
 *  называется только то, где ученик действительно что-то делает. */
const practiceTitleFor = (kind) => (kind === "slides" ? "Разбор примеров" : "Практическая работа");

// ── троттлинг и модель ──────────────────────────────────────────────────────
const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
let modelName = null;
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      await throttle();
      await genAI.getGenerativeModel({ model: candidate }).generateContent("ping");
      console.log(`  Используем модель: ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${(e.message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}
const isDailyQuotaError = (e) => /GenerateRequestsPerDay/i.test(e.message ?? "");
async function callGemini(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: modelName, systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });
  const BACKOFF = [5000, 15000, 45000];
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      return (await model.generateContent(userPrompt)).response;
    } catch (e) {
      if (isDailyQuotaError(e)) { const err = new Error("daily quota"); err.isDailyQuota = true; throw err; }
      if (attempt >= BACKOFF.length) throw e;
      await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
    }
  }
}
const stripFences = (t) => t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

// ── промпт (из generate-stages-jul28-30.mjs, дословно) ──────────────────────
const SYSTEM_PROMPT = `Ты — опытный школьный учитель. Тебе даётся предмет, класс и тема одного
урока (45 минут). Сгенерируй содержательное наполнение для 4 блоков урока
(теория, демонстрация учителя, практика ученика, тест) + краткий итог.

ВЕРНИ СТРОГО JSON (без markdown-разметки, без пояснений вне JSON):
{
  "theory": {
    "slides": [ { "title": "...", "content": "markdown, 60-100 слов" }, ... ]
  },
  "live_demo": {
    "description": "объяснение на markdown — что и как показывает учитель (2-4 предложения)",
    "code": "рабочий код (ТОЛЬКО если practice_kind=code — иначе не заполнять)"
  },
  "practice": {
    "description": "конкретное задание для ученика (2-3 предложения)",
    "starter_code": "заготовка кода с комментариями TODO, где писать решение (ТОЛЬКО если practice_kind=code)",
    "slides": [ { "title": "...", "content": "..." }, ... ] (ТОЛЬКО если practice_kind НЕ code — конкретные задачи/упражнения по теме, 3-5 штук)
  },
  "test": {
    "questions": [ { "question_text": "...", "options": ["...","...","...","..."], "correct_option_index": 0 }, ... ]
  },
  "summary": {
    "key_points": [ "...", "...", "..." ]
  }
}

ПРАВИЛА:
- theory.slides: ровно 5-7 слайдов, конкретных по теме (не общие фразы).
- Для математики — формулы в markdown ($...$), пошаговые примеры. Для
  программирования/робототехники — реальный работающий код/псевдокод по
  теме. Для языков — реальные фразы/тексты/переводы по теме.
- live_demo.code (если practice_kind=code) — ПОЛНОСТЬЮ рабочий, готовый
  выполниться пример по теме (учительская демонстрация).
- practice.starter_code (если practice_kind=code) — НЕ готовое решение,
  шаблон с TODO-комментариями, где ученик должен дописать код сам.
- practice.slides (если practice_kind НЕ code) — 3-5 конкретных задач/
  упражнений по теме, без ответов.
- test.questions: РОВНО 4 вопроса, ровно 4 варианта на каждый, один
  правильный (correct_option_index 0-based), конкретные по теме урока
  (не общие).
- summary.key_points: 3-5 пунктов, конкретных по теме.
- Никаких картинок/image_prompt — только текст.
- Адаптируй сложность и словарь под класс (3 = начальная школа, простые
  слова; 7 = средняя; 10 = старшая, продвинуто).
- Язык — русский, кроме случая явного предмета "Английский язык" (там
  content на английском, кроме test.questions — тест всегда на русском).
- Только валидный JSON, без пояснений.`;

const buildUserPrompt = ({ subjectName, groupName, topic, practiceKind }) => `ВХОДНЫЕ ДАННЫЕ:
- Класс: ${groupName}
- Предмет: ${subjectName}
- Тема урока: "${topic}"
- practice_kind: ${practiceKind}`;

// ── валидация ответа ────────────────────────────────────────────────────────
function normalizeSlides(raw, min = 1) {
  if (!Array.isArray(raw)) return null;
  const slides = raw
    .filter((s) => s && typeof s.title === "string" && typeof s.content === "string" && s.title.trim() && s.content.trim())
    .map((s) => ({ layout: "default", title: s.title.trim(), content: s.content.trim() }));
  return slides.length >= min ? slides : null;
}
function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return null;
  const qs = raw
    .filter((q) => q && typeof q.question_text === "string" && q.question_text.trim()
      && Array.isArray(q.options) && q.options.filter((o) => typeof o === "string" && o.trim()).length >= 2
      && Number.isInteger(q.correct_option_index) && q.correct_option_index >= 0 && q.correct_option_index < q.options.length)
    .map((q) => ({ question_text: q.question_text.trim(), options: q.options.map((o) => String(o).trim()), correct_option_index: q.correct_option_index }))
    .slice(0, 5);
  return qs.length >= 3 ? qs : null;
}
function normalizeKeyPoints(raw) {
  if (!Array.isArray(raw)) return null;
  const pts = raw.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()).slice(0, 5);
  return pts.length >= 3 ? pts : null;
}
function validate(parsed, practiceKind) {
  const theorySlides = normalizeSlides(parsed?.theory?.slides, 5);
  if (!theorySlides) return null;
  const liveDemoDescription = typeof parsed?.live_demo?.description === "string" && parsed.live_demo.description.trim()
    ? parsed.live_demo.description.trim() : null;
  if (!liveDemoDescription) return null;
  const liveDemoCode = practiceKind === "code" && typeof parsed?.live_demo?.code === "string" && parsed.live_demo.code.trim()
    ? parsed.live_demo.code.trim() : null;
  if (practiceKind === "code" && !liveDemoCode) return null;
  const practiceDescription = typeof parsed?.practice?.description === "string" && parsed.practice.description.trim()
    ? parsed.practice.description.trim() : null;
  if (!practiceDescription) return null;
  const practiceStarterCode = practiceKind === "code" && typeof parsed?.practice?.starter_code === "string" && parsed.practice.starter_code.trim()
    ? parsed.practice.starter_code.trim() : null;
  if (practiceKind === "code" && !practiceStarterCode) return null;
  // wokwi рисуется внешним сервисом — слайды ему не нужны и не требуются.
  const practiceSlides = practiceKind === "slides" ? normalizeSlides(parsed?.practice?.slides, 3) : null;
  if (practiceKind === "slides" && !practiceSlides) return null;
  const questions = normalizeQuestions(parsed?.test?.questions);
  if (!questions) return null;
  const keyPoints = normalizeKeyPoints(parsed?.summary?.key_points);
  if (!keyPoints) return null;
  return { theorySlides, liveDemoDescription, liveDemoCode, practiceDescription, practiceStarterCode, practiceSlides, questions, keyPoints };
}

/** Скелет этапов урока. Отдельной функцией, чтобы холостой прогон показывал
 *  ровно то, что потом запишется, а не похожее на него. */
function buildStages(v, practiceKind, programmingLanguage) {
  const EXT_CONFIG = { url: "", requires_link: true, requires_screenshot: false };
  return [
    { position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation",
      title: "Изучение материала", slides: v?.theorySlides, difficulty: "medium", duration_min: 15 },
    practiceKind === "code"
      ? { position: 2, stage_role: "middle", stage_type: "theory", content_type: "code", title: "Демонстрация учителя",
          description: v?.liveDemoDescription, starter_code: v?.liveDemoCode, programming_language: programmingLanguage,
          difficulty: "medium", duration_min: 10 }
      : { position: 2, stage_role: "middle", stage_type: "theory",
          content_type: practiceKind === "wokwi" ? "wokwi" : "presentation", title: "Демонстрация учителя",
          description: v?.liveDemoDescription,
          ...(practiceKind === "wokwi"
            ? { config: EXT_CONFIG }
            : { slides: v ? [{ layout: "default", title: "Демонстрация", content: v.liveDemoDescription }] : undefined }),
          difficulty: "medium", duration_min: 10 },
    practiceKind === "code"
      ? { position: 3, stage_role: "middle", stage_type: "task", content_type: "code", title: practiceTitleFor(practiceKind),
          description: v?.practiceDescription, starter_code: v?.practiceStarterCode, programming_language: programmingLanguage,
          difficulty: "medium", duration_min: 12 }
      : { position: 3, stage_role: "middle", stage_type: "task",
          content_type: practiceKind === "wokwi" ? "wokwi" : "presentation", title: practiceTitleFor(practiceKind),
          description: v?.practiceDescription,
          ...(practiceKind === "wokwi" ? { config: EXT_CONFIG } : { slides: v?.practiceSlides }),
          difficulty: "medium", duration_min: 12 },
    { position: 4, stage_role: "middle", stage_type: "task", content_type: "quiz_qia", title: "Проверка знаний",
      config: { time_limit_minutes: null, points_per_question: 1 }, difficulty: "medium", duration_min: 8 },
  ];
}

/** Те же правила приёмки, что в /api/ai/generate-stages после 6289c28.
 *  Скелет фиксированный, так что нарушить их можно только ошибкой в коде —
 *  проверка стоит именно поэтому. */
function checkShape(stages) {
  const problems = [];
  const total = stages.reduce((a, s) => a + s.duration_min, 0);
  if (total !== 45) problems.push(`сумма длительностей ${total} вместо 45`);
  if (!stages.some((s) => String(s.content_type).startsWith("quiz"))) problems.push("нет квиза");
  if (new Set(stages.map((s) => s.content_type)).size < 2) problems.push("все этапы одного типа");
  for (const s of stages) {
    if (s.content_type === "presentation" && !(Array.isArray(s.slides) && s.slides.length)) {
      problems.push(`презентация без слайдов: ${s.title}`);
    }
    if (s.content_type === "presentation" && /практич|практика|задани|упражнен|лаборатор/i.test(s.title)) {
      problems.push(`практика типом presentation: ${s.title}`);
    }
  }
  return problems;
}

const loadLog = () => (fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {} });
const saveLog = (log) => fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

// ── основная часть ──────────────────────────────────────────────────────────
console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, Gemini не вызывается, в базу не пишется"}\n`);

let lessons, targetIds, existingByLesson = new Map();

if (FILL_THIN) {
  // Все уроки школы читаем разом и считаем этапы на стороне скрипта: уроков
  // сотня с небольшим, постранично тут нечего листать, но счётчик всё равно
  // сверяем — правило про 1000 строк.
  const { count: lessonCount, error: cErr } = await db
    .from("lessons").select("id", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  if (cErr) fail(`счёт уроков: ${cErr.message}`);
  const { data: allLessons, error: alErr } = await db
    .from("lessons").select("id, topic, title, starts_at, group:groups(name), subject:subjects(name)")
    .eq("school_id", SCHOOL_ID).order("starts_at");
  if (alErr) fail(`чтение уроков: ${alErr.message}`);
  if (allLessons.length !== lessonCount) fail(`уроков прочитано ${allLessons.length} из ${lessonCount}`);

  const { count: stageCount, error: scErr } = await db
    .from("lesson_stages").select("id", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  if (scErr) fail(`счёт этапов: ${scErr.message}`);
  const { data: allStages, error: asErr } = await db
    .from("lesson_stages").select("lesson_id, position, title, stage_role, content_type, slides")
    .eq("school_id", SCHOOL_ID);
  if (asErr) fail(`чтение этапов: ${asErr.message}`);
  if (allStages.length !== stageCount) fail(`этапов прочитано ${allStages.length} из ${stageCount}`);

  for (const s of allStages) {
    if (!existingByLesson.has(s.lesson_id)) existingByLesson.set(s.lesson_id, []);
    existingByLesson.get(s.lesson_id).push(s);
  }
  lessons = allLessons.filter((l) => {
    const mid = (existingByLesson.get(l.id) ?? []).filter((s) => s.stage_role === "middle").length;
    return mid >= 1 && mid <= 3;
  });
  targetIds = lessons.map((l) => l.id);
  console.log(`Уроков в школе: ${allLessons.length}; из них тонких (1-3 содержательных этапа): ${lessons.length}\n`);
} else {
  const restoredIds = JSON.parse(fs.readFileSync(IDS_PATH, "utf8")).map((r) => r.id);
  if (restoredIds.length !== 49) fail(`в списке восстановленных ${restoredIds.length} уроков вместо 49`);

  const { data: rows, error: lErr } = await db
    .from("lessons")
    .select("id, topic, title, starts_at, group:groups(name), subject:subjects(name)")
    .in("id", restoredIds).order("starts_at");
  if (lErr) fail(`чтение уроков: ${lErr.message}`);
  if (rows.length !== 49) fail(`в базе нашлось ${rows.length} из 49 восстановленных уроков`);
  lessons = rows;
  targetIds = restoredIds;

  const { data: middleRows, error: mErr } = await db
    .from("lesson_stages").select("lesson_id").in("lesson_id", restoredIds).eq("stage_role", "middle");
  if (mErr) fail(`проверка существующих этапов: ${mErr.message}`);
  const hasMiddle = new Set(middleRows.map((r) => r.lesson_id));
  lessons = lessons.filter((l) => !hasMiddle.has(l.id));
}

/** Какие позиции скелета у урока уже заняты. В режиме добора создаём только
 *  недостающие; позиция 4 (квиз с вопросами) занята у всех тонких уроков и
 *  не трогается никогда. */
function missingPositions(lessonId) {
  const have = new Set((existingByLesson.get(lessonId) ?? [])
    .filter((s) => s.stage_role === "middle").map((s) => s.position));
  return [1, 2, 3, 4].filter((p) => !have.has(p));
}
/** Пустой ли «Итог» — заполняем только пустой, содержательный не перетираем. */
function summaryIsEmpty(lessonId) {
  const sum = (existingByLesson.get(lessonId) ?? []).find((s) => s.stage_role === "summary");
  return !!sum && !(Array.isArray(sum.slides) && sum.slides.length > 0);
}

const log = loadLog();
const queued = lessons.filter((l) => !log.done[l.id]);
const pending = queued.slice(0, LIMIT);

console.log(`В очереди: ${queued.length}; в этом запуске: ${pending.length}\n`);
if (pending.length === 0) { console.log("Нечего делать."); process.exit(0); }

// ── холостой прогон ─────────────────────────────────────────────────────────
if (!APPLY) {
  const byKind = {};
  for (const l of pending) {
    const subjectName = l.subject?.name ?? "—";
    const kind = practiceKindFor(subjectName);
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }
  const sample = pending[0];
  const sampleKind = practiceKindFor(sample.subject?.name ?? "—");
  console.log("── ЧТО БУДЕТ СОЗДАНО В КАЖДОМ УРОКЕ ──");
  for (const s of buildStages(null, sampleKind, "python")) {
    console.log(`   pos ${String(s.position).padEnd(2)} ${s.content_type}/${s.stage_type} · ${s.title} — ${s.duration_min} мин`);
  }
  console.log("   pos 9999 обновляется существующий «Итог урока» (не дублируется)");
  console.log(`   + 4 вопроса quiz_questions к этапу «Проверка знаний»`);
  console.log(`\nВид практики по предметам: ${JSON.stringify(byKind)}`);
  console.log("   code — Программирование, wokwi — Робототехника, slides — «Разбор примеров» у остальных");

  console.log("\n── УРОКИ В ОЧЕРЕДИ ──");
  let newStages = 0, newQuizzes = 0, summaries = 0;
  for (const [i, l] of pending.entries()) {
    const miss = FILL_THIN ? missingPositions(l.id) : [1, 2, 3, 4];
    const sum = FILL_THIN ? summaryIsEmpty(l.id) : true;
    newStages += miss.length;
    if (miss.includes(4)) newQuizzes++;
    if (sum) summaries++;
    const missLabel = FILL_THIN ? `  создаём позиции: ${miss.join(",") || "—"}${sum ? " + Итог" : ""}` : "";
    console.log(`   ${String(i + 1).padStart(2)}. ${l.starts_at.slice(0, 10)} ${l.group?.name?.replace(" класс", "").padEnd(4)} · ${(l.subject?.name ?? "—").padEnd(16)} ${l.topic}${missLabel}`);
  }
  const calls = pending.length;
  console.log(`\nВызовов Gemini: ${calls} (по одному на урок, модель 2.5-flash).`);
  console.log(`Оценка стоимости: ~$${(calls * 0.011).toFixed(2)} — порог в $5 не достигается.`);
  console.log(`Ожидаемое время: ~${Math.ceil((calls * 6.5) / 60)} мин (троттлинг 6.5 с между вызовами).`);
  console.log(`\nБудет создано этапов: ${newStages}, наборов вопросов: ${newQuizzes}, заполнено «Итогов»: ${summaries}.`);
  if (FILL_THIN) console.log("Существующие этапы, их вопросы и работы учеников не трогаются.");
  console.log("\nХолостой прогон. Запуск с --apply начнёт генерацию.");
  process.exit(0);
}

// ── запись ──────────────────────────────────────────────────────────────────
modelName = await pickWorkingModel();
if (!modelName) fail("ни одна модель Gemini не доступна (дневной лимит?).");

let done = 0, errors = 0;
for (const [i, lesson] of pending.entries()) {
  const subjectName = lesson.subject?.name ?? "—";
  const groupName = lesson.group?.name ?? "—";
  const topic = lesson.topic ?? lesson.title ?? subjectName;
  const practiceKind = practiceKindFor(subjectName);
  const programmingLanguage = practiceKind === "code" ? programmingLanguageFor(topic) : null;
  const prefix = `  [${i + 1}/${pending.length}] ${groupName} · ${subjectName} · "${topic}"`;

  let v = null;
  for (let attempt = 0; attempt < 2 && !v; attempt++) {
    let response;
    try {
      response = await callGemini(SYSTEM_PROMPT, buildUserPrompt({ subjectName, groupName, topic, practiceKind }));
    } catch (e) {
      if (e.isDailyQuota) { console.warn(`${prefix} → ДНЕВНОЙ ЛИМИТ, чистая остановка. Перезапусти завтра.`); break; }
      console.error(`${prefix} → ошибка Gemini: ${(e.message ?? "").split("\n")[0]}`);
      continue;
    }
    let parsed;
    try { parsed = JSON.parse(stripFences(response.text())); }
    catch { console.error(`${prefix} → нечитаемый JSON (попытка ${attempt + 1})`); continue; }
    v = validate(parsed, practiceKind);
    if (!v) console.error(`${prefix} → валидация не прошла (попытка ${attempt + 1})`);
  }
  if (!v) { errors++; continue; }

  const stages = buildStages(v, practiceKind, programmingLanguage);
  // Форму проверяем на ПОЛНОМ скелете — это то, каким урок станет, — а
  // записываем только недостающие позиции.
  const problems = checkShape(stages);
  if (problems.length) fail(`урок «${topic}» дал неверную форму: ${problems.join("; ")}`);
  const wanted = FILL_THIN ? new Set(missingPositions(lesson.id)) : new Set([1, 2, 3, 4]);
  const toInsert = stages.filter((s) => wanted.has(s.position));

  let quizStageId = null, writeOk = true;
  for (const stage of toInsert) {
    const { data: ins, error: insErr } = await db
      .from("lesson_stages").insert({ lesson_id: lesson.id, school_id: SCHOOL_ID, ...stage })
      .select("id, content_type").single();
    if (insErr) { console.error(`  !! этап «${stage.title}»: ${insErr.message}`); writeOk = false; continue; }
    if (ins.content_type === "quiz_qia") quizStageId = ins.id;
  }
  if (quizStageId) {
    const rows = v.questions.map((q, qi) => ({
      stage_id: quizStageId, school_id: SCHOOL_ID, position: qi,
      question_text: q.question_text, options: q.options, correct_option_index: q.correct_option_index,
      points: 1, time_per_question_seconds: 20,
    }));
    const { error: qErr } = await db.from("quiz_questions").insert(rows);
    if (qErr) { console.error(`  !! вопросы: ${qErr.message}`); writeOk = false; }
  }

  // «Итог» заполняем только пустой: содержательный, написанный под конкретный
  // урок, перетирать нельзя.
  if (!FILL_THIN || summaryIsEmpty(lesson.id)) {
    const { error: sumErr } = await db.from("lesson_stages").update({
      title: "Итог урока", content_type: "presentation", stage_type: "theory",
      slides: [{ layout: "default", title: "Итог урока", content: v.keyPoints.map((p) => `- ${p}`).join("\n") }],
    }).eq("lesson_id", lesson.id).eq("position", 9999);
    if (sumErr) { console.error(`  !! Итог: ${sumErr.message}`); writeOk = false; }
  }

  log.done[lesson.id] = true;
  saveLog(log);
  console.log(`${prefix} → ${writeOk ? "ОК" : "ЧАСТИЧНО"}`);
  done++;
}

console.log(`\nСгенерировано уроков: ${done}, с ошибкой: ${errors}.`);

// ── проверка после записи ───────────────────────────────────────────────────
const { count: stagesNow } = await db.from("lesson_stages")
  .select("id", { count: "exact", head: true }).in("lesson_id", targetIds);
const { data: midNow } = await db.from("lesson_stages")
  .select("lesson_id").in("lesson_id", targetIds).eq("stage_role", "middle");
const perLesson = {};
for (const r of midNow ?? []) perLesson[r.lesson_id] = (perLesson[r.lesson_id] ?? 0) + 1;
const dist = {};
for (const id of targetIds) dist[perLesson[id] ?? 0] = (dist[perLesson[id] ?? 0] ?? 0) + 1;
console.log(`Этапов у ${targetIds.length} целевых уроков: ${stagesNow}; содержательных на урок: ${JSON.stringify(dist)}`);
console.log(`Готовых уроков (4 содержательных этапа и больше): ${Object.entries(dist).filter(([k]) => Number(k) >= 4).reduce((a, [, v]) => a + v, 0)} из ${targetIds.length}.`);
