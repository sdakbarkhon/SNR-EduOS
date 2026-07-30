#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 4 — AI-этапы для 54 "идеальных" уроков демо-дней
// 28-29-30 июля (вчера/сегодня/завтра относительно демо заказчику 30.07).
// Не разрушительно (только вставка в уроки без middle-этапов) — без
// --confirm, запускается сразу.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки схемы):
//   - Колонка называется content_type, не kind. CHECK-список (миграция 141):
//     presentation, code, wokwi, codesandbox, quiz_qia, quiz_kahoot,
//     geogebra, phet, desmos, blockly_games, visualgo, p5js, excalidraw,
//     learningapps, sqlonline, h5p, typerun. НЕТ значений
//     live_demo/practice/test/summary — это НЕ content_type, а концепции
//     педагогической структуры, реализуются через content_type+stage_type.
//   - Тест урока — это quiz_questions (stage_id → lesson_stages), а НЕ
//     test_questions (homework_id NOT NULL → homework, тест ДЗ — отдельная
//     от урока система, к lesson_stages вообще не относится).
//   - У КАЖДОГО из 126 уроков (в т.ч. всех 54 в этом диапазоне) уже есть 2
//     авто-созданных этапа от триггера fn_create_default_stages: position=0
//     "Старт" (stage_role='start') и position=9999 "Итог" (stage_role=
//     'summary') — проверено live-запросом. Значит "5 этапов" промта — это
//     НЕ 5 новых строк, а: Старт(уже есть, не трогаем) + 4 НОВЫХ middle-этапа
//     (теория/демо/практика/тест, position 1-4) + существующий "Итог"
//     (position 9999, ОБНОВЛЯЕМ его контентом вместо создания дубликата).
//     Итого 6 строк lesson_stages на урок, 5 из них содержательные.
//
// ЭКОНОМИЯ: 1 вызов Gemini на урок (54 вызова, а не 54×5=270) — весь
// контент урока содержательно связан одной темой, генерируется одним JSON
// (тот же паттерн, что уже проверен в regenerate-jul27-aug2.mjs). Дешевле,
// быстрее, нет риска рассинхрона между этапами одного урока.
//
// PRACTICE_KIND — по предмету (зеркалит уже принятое решение из
// regenerate-jul27-aug2.mjs): Программирование/3-А → blockly_games (темы
// этих дней — Scratch), Программирование/7-А,10-А → code (реальный Python/
// C++, Run через Pyodide/JSCPP), Робототехника → wokwi (внешний Arduino-
// симулятор — description описывает схему/код словами, requires_link).
// Математика/Английский/Русский → нет отдельного "practiceKind" в старом
// скрипте (там был SIMPLE-путь без practice) — в этом заходе ВСЕ 5
// предметов получают полный набор (демо для заказчика показывает ВСЕ
// функции платформы) — для них live_demo/practice — content_type=
// 'presentation' (слайды с разбором примера / упражнениями).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/generate-stages-jul28-30.mjs

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

function loadEnvFallback() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? loadEnvFallback().GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error("FATAL: GEMINI_API_KEY отсутствует в .env.local."); process.exit(1); }
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const START_DATE = "2026-07-28";
const END_DATE = "2026-07-30"; // включительно
const TZ_OFFSET = "+05:00";
const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

// --limit=N — необязательный предохранитель (не в промте, добавлено для
// проверки пайплайна на 1-2 уроках перед полным прогоном на 54, платные
// Gemini-вызовы). Без флага — обрабатывает все уроки в очереди, как просил
// пользователь ("без --confirm флага... запуск на прод сразу").
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.slice("--limit=".length), 10) : Infinity;

// ── practiceKind по предмету+классу (зеркалит regenerate-jul27-aug2.mjs) ──
const PRACTICE_KIND_BY_SUBJECT = {
  "Программирование": (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  "Робототехника": () => "wokwi",
};
function practiceKindFor(subjectName, groupName) {
  const fn = PRACTICE_KIND_BY_SUBJECT[subjectName];
  return fn ? fn(groupName) : "presentation";
}
function programmingLanguageFor(topic) {
  return /c\+\+/i.test(topic) ? "cpp" : "python";
}

// ── throttle + модель + retry (зеркалит regenerate-jul27-aug2.mjs) ──────────
const MIN_INTERVAL_MS = 6500; // ~9 вызовов/мин — тот же интервал, что уже
// проверен на этом ключе в предыдущем заходе; промт просил 1с/60 в минуту,
// но берём проверенное на практике значение вместо теоретического.
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}
// Запасные модели: gemini-2.0-flash и 2.0-flash-lite ОТКЛЮЧЕНЫ Google
// (отдают 404 «no longer available»), т.е. фолбэк был мёртвым — при 503 у
// основной модели скрипт просто падал. Заменены на живые 2.5-семейства.
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
let modelName = null;
const exhaustedModels = new Set();
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    if (exhaustedModels.has(candidate)) continue;
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      console.log(`  Используем модель: ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${(e.message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}
function isDailyQuotaError(e) { return /GenerateRequestsPerDay/i.test(e.message ?? ""); }
async function callGeminiWithRetry(systemPrompt, userPrompt) {
  for (;;) {
    const model = genAI.getGenerativeModel({
      model: modelName, systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json" },
    });
    const BACKOFF_429_MS = [5000, 15000, 45000];
    let otherErrorRetried = false;
    for (let attempt = 0; ; attempt++) {
      await throttle();
      try {
        const result = await model.generateContent(userPrompt);
        return result.response;
      } catch (e) {
        if (isDailyQuotaError(e)) {
          exhaustedModels.add(modelName);
          console.warn(`  [daily quota] "${modelName}" исчерпана, пробуем следующую…`);
          const next = await pickWorkingModel();
          if (!next) { e.isDailyQuota = true; throw e; }
          modelName = next;
          break;
        }
        const is429 = e.status === 429 || /429|rate.?limit|quota/i.test(e.message ?? "");
        if (is429 && attempt < BACKOFF_429_MS.length) {
          await new Promise((r) => setTimeout(r, BACKOFF_429_MS[attempt]));
          continue;
        }
        if (!is429 && !otherErrorRetried) { otherErrorRetried = true; await new Promise((r) => setTimeout(r, 3000)); continue; }
        throw e;
      }
    }
  }
}
function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── чекпоинт (crash-resume) ─────────────────────────────────────────────────
const LOG_PATH = path.resolve(process.cwd(), "scripts/.generate-stages-jul28-30-progress.json");
function loadLog() { return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {} }; }
function saveLog(log) { fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2)); }

// ── системный промпт ─────────────────────────────────────────────────────────
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

function buildUserPrompt({ subjectName, groupName, topic, practiceKind }) {
  return `ВХОДНЫЕ ДАННЫЕ:
- Класс: ${groupName}
- Предмет: ${subjectName}
- Тема урока: "${topic}"
- practice_kind: ${practiceKind}`;
}

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

/** Валидирует весь ответ разом — если чего-то не хватает, вызывающий код
 *  повторяет весь Gemini-вызов заново (не пытаемся чинить частично битый
 *  JSON по кусочкам). */
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
  // "wokwi" (Робототехника) в INSERT использует только description+config
  // (внешний сервис, слайды не рендерятся) — требовать slides для него было
  // багом: Gemini их часто не даёт (не нужны), и валидные ответы отбраковывались.
  const needsSlides = practiceKind !== "code" && practiceKind !== "wokwi";
  const practiceSlides = needsSlides ? normalizeSlides(parsed?.practice?.slides, 3) : null;
  if (needsSlides && !practiceSlides) return null;
  const questions = normalizeQuestions(parsed?.test?.questions);
  if (!questions) return null;
  const keyPoints = normalizeKeyPoints(parsed?.summary?.key_points);
  if (!keyPoints) return null;
  return { theorySlides, liveDemoDescription, liveDemoCode, practiceDescription, practiceStarterCode, practiceSlides, questions, keyPoints };
}

async function main() {
  console.log(`AI-этапы для 54 уроков 28-30 июля — демо-школа (${SCHOOL_ID})\n`);

  const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, topic, starts_at, group:groups(name), subject:subjects(name)")
    .eq("school_id", SCHOOL_ID)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndExclIso)
    .order("starts_at");
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  if (lessons.length !== 54) console.warn(`  !! Ожидалось 54 урока в диапазоне, найдено ${lessons.length}. Продолжаю с реальным числом.`);
  console.log(`Уроков в диапазоне 28-30 июля: ${lessons.length}\n`);

  // ── идемпотентность: уроки, у которых УЖЕ есть middle-этапы — пропускаем ──
  const lessonIds = lessons.map((l) => l.id);
  const { data: middleRows, error: mErr } = await db
    .from("lesson_stages").select("lesson_id").in("lesson_id", lessonIds).eq("stage_role", "middle");
  if (mErr) fail(`Ошибка проверки существующих middle-этапов: ${mErr.message}`);
  const hasMiddle = new Set(middleRows.map((r) => r.lesson_id));
  const log = loadLog();
  const queued = lessons.filter((l) => !hasMiddle.has(l.id) && !log.done[l.id]);
  const pending = queued.slice(0, LIMIT);
  console.log(`Уже с middle-этапами (пропуск): ${hasMiddle.size}. В очереди на генерацию: ${queued.length}. В этом запуске: ${pending.length}${Number.isFinite(LIMIT) ? ` (--limit=${LIMIT})` : ""}.\n`);
  if (pending.length === 0) { console.log("Нечего делать."); return; }

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let done = 0, errors = 0;
  for (const [i, lesson] of pending.entries()) {
    const subjectName = lesson.subject?.name ?? "—";
    const groupName = lesson.group?.name ?? "—";
    const topic = lesson.topic ?? subjectName;
    const practiceKind = practiceKindFor(subjectName, groupName);
    const programmingLanguage = practiceKind === "code" ? programmingLanguageFor(topic) : null;
    const logPrefix = `  [${i + 1}/${pending.length}] ${groupName} · ${subjectName} · "${topic}"`;

    const userPrompt = buildUserPrompt({ subjectName, groupName, topic, practiceKind });

    let response, parsed, v = null;
    for (let genAttempt = 0; genAttempt < 2 && !v; genAttempt++) {
      try {
        response = await callGeminiWithRetry(SYSTEM_PROMPT, userPrompt);
      } catch (e) {
        if (e.isDailyQuota) { console.warn(`${logPrefix} → ДНЕВНОЙ ЛИМИТ — чистая остановка.`); return; }
        console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
        continue;
      }
      try { parsed = JSON.parse(stripFences(response.text())); }
      catch { console.error(`${logPrefix} → ERROR (JSON parse, попытка ${genAttempt + 1})`); continue; }
      v = validate(parsed, practiceKind);
      if (!v) console.error(`${logPrefix} → ERROR (валидация не прошла, попытка ${genAttempt + 1})`);
    }
    if (!v) { errors++; continue; } // НЕ помечаем done — можно перезапустить скрипт для повторной попытки

    // ── 4 новых middle-этапа (position 1-4) ──
    const stagesToInsert = [
      { position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation", title: "Изучение материала", slides: v.theorySlides, difficulty: "medium", duration_min: 15 },
      practiceKind === "code"
        ? { position: 2, stage_role: "middle", stage_type: "theory", content_type: "code", title: "Демонстрация учителя", description: v.liveDemoDescription, starter_code: v.liveDemoCode, programming_language: programmingLanguage, difficulty: "medium", duration_min: 10 }
        : { position: 2, stage_role: "middle", stage_type: "theory", content_type: practiceKind === "wokwi" ? "wokwi" : "presentation", title: "Демонстрация учителя", description: v.liveDemoDescription, ...(practiceKind === "wokwi" ? { config: { url: "", requires_link: true, requires_screenshot: false } } : { slides: [{ layout: "default", title: "Демонстрация", content: v.liveDemoDescription }] }), difficulty: "medium", duration_min: 10 },
      practiceKind === "code"
        ? { position: 3, stage_role: "middle", stage_type: "task", content_type: "code", title: "Практическая работа", description: v.practiceDescription, starter_code: v.practiceStarterCode, programming_language: programmingLanguage, difficulty: "medium", duration_min: 12 }
        : { position: 3, stage_role: "middle", stage_type: "task", content_type: practiceKind === "wokwi" ? "wokwi" : "presentation", title: "Практическая работа", description: v.practiceDescription, ...(practiceKind === "wokwi" ? { config: { url: "", requires_link: true, requires_screenshot: false } } : { slides: v.practiceSlides }), difficulty: "medium", duration_min: 12 },
      { position: 4, stage_role: "middle", stage_type: "task", content_type: "quiz_qia", title: "Проверка знаний", config: { time_limit_minutes: null, points_per_question: 1 }, difficulty: "medium", duration_min: 8 },
    ];

    let quizStageId = null, writeOk = true;
    for (const stage of stagesToInsert) {
      const { data: inserted, error: insErr } = await db
        .from("lesson_stages").insert({ lesson_id: lesson.id, school_id: SCHOOL_ID, ...stage }).select("id, content_type").single();
      if (insErr) { console.error(`  !! stage insert failed (${stage.title}): ${insErr.message}`); writeOk = false; continue; }
      if (inserted.content_type === "quiz_qia") quizStageId = inserted.id;
    }
    if (quizStageId) {
      const rows = v.questions.map((q, qi) => ({
        stage_id: quizStageId, school_id: SCHOOL_ID, position: qi,
        question_text: q.question_text, options: q.options, correct_option_index: q.correct_option_index,
        points: 1, time_per_question_seconds: 20,
      }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    }

    // ── обновляем существующий "Итог" (position 9999), не создаём дубликат ──
    const { error: sumErr } = await db
      .from("lesson_stages")
      .update({
        title: "Итог урока",
        content_type: "presentation",
        stage_type: "theory",
        slides: [{ layout: "default", title: "Итог урока", content: v.keyPoints.map((p) => `- ${p}`).join("\n") }],
      })
      .eq("lesson_id", lesson.id).eq("position", 9999);
    if (sumErr) { console.error(`  !! summary update failed: ${sumErr.message}`); writeOk = false; }

    log.done[lesson.id] = true;
    saveLog(log);
    console.log(`${logPrefix} → ${writeOk ? "OK" : "PARTIAL"} (5 этапов + итог обновлён)`);
    done++;
  }

  console.log(`\nГотово: сгенерировано ${done}, ошибок ${errors}.`);

  const { count: stagesTotal } = await db.from("lesson_stages").select("*", { count: "exact", head: true }).in("lesson_id", lessonIds);
  console.log(`Проверка: lesson_stages для уроков 28-30 июля — ${stagesTotal} (ожидание ~324 = 54×6, включая Старт/Итог).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
