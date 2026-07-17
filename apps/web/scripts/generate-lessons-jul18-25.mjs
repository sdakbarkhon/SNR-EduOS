#!/usr/bin/env node
// Пачка 4 — генератор контента для уроков 18-25 июля 2026 (8 дней, все
// учебные, без пропусков). Работает НАД УЖЕ СУЩЕСТВУЮЩЕЙ структурой
// (apps/web/scripts/create-lesson-slots-jul18-31.mjs уже создал 240 пустых
// уроков со scaffolding — этот скрипт их НЕ создаёт, только заполняет
// контентом те, что ещё пустые).
//
// Новый файл, НЕ замена apps/web/scripts/generate-lessons-jul19-25.mjs (тот
// писан под старый скоуп/структуру 19-25 — устарел, оставлен как есть).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/generate-lessons-jul18-25.mjs --dry-run
//   node --env-file=.env.local scripts/generate-lessons-jul18-25.mjs --confirm
//   node --env-file=.env.local scripts/generate-lessons-jul18-25.mjs --confirm --limit-per-run=40
//
// Аргументы:
//   --confirm              обязателен для боевого запуска; без него — dry-run
//   --dry-run               явный dry-run (тоже работает без --confirm)
//   --limit-per-run=N       максимум РЕАЛЬНЫХ Gemini-вызовов за один запуск
//                           (default 40) — уже пропущенные (SKIPPED) в счёт
//                           лимита не идут, их логируем все за один прогон.
//   --date-from=YYYY-MM-DD  default 2026-07-18
//   --date-to=YYYY-MM-DD    default 2026-07-25 (включительно)
//
// ЖИВАЯ ПРОВЕРКА ПЕРЕД НАПИСАНИЕМ (эта сессия, hosted БД):
//   - 18-25 июля: 135 уроков (НЕ 132 — расхождение с изначальной оценкой,
//     видимо чуть занижена; live-подсчёт авторитетнее). FULL=66, SIMPLE=69.
//   - У ВСЕХ 135 уже есть scaffolding (position=0/'start' И position=9999/
//     'summary') — 135/135 на оба. У НИ ОДНОГО нет 'middle'-этапов (0/135) —
//     все реально пустые. Подтверждает: инсертить lessons/scaffold не нужно,
//     идемпотентность по 'middle' достаточна и корректна.
//   - ai_usage_log на момент проверки: 4/250 использовано сегодня.

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// ── env + clients (service-role) ────────────────────────────────────────
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
const envFallback = loadEnvFallback();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFallback.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFallback.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? envFallback.GEMINI_API_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и GEMINI_API_KEY в .env.local.");
  console.error("Запускай так: node --env-file=.env.local scripts/generate-lessons-jul18-25.mjs [--dry-run|--confirm]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, def) {
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
console.log(`limit-per-run: ${LIMIT_PER_RUN}`);
console.log("═".repeat(70));

// ── rate limiting: 6.5с между Gemini-вызовами ────────────────────────────
const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ── выбор рабочей модели ──────────────────────────────────────────────────
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
let modelName = null;
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      console.log(`Используем модель: ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${(e.message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}

// ── системные промпты: FULL и SIMPLE (идентичны generate-lessons-jul19-25.mjs) ──
const GRADE_BY_GROUP = { "3-А класс": 3, "7-А класс": 7, "10-А класс": 10 };
const FULL_SUBJECTS = new Set(["Программирование", "Робототехника"]);
const PRACTICE_KIND_BY_SUBJECT = {
  "Программирование": (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  "Робототехника": () => "wokwi",
};

const FULL_SYSTEM_PROMPT = `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: для заданного урока (предмет, класс, список уже пройденных тем) —
1) предложить СЛЕДУЮЩУЮ тему урока в естественной программе обучения (не
   повторяя ничего из уже пройденного списка), 2) сгенерировать содержимое
   ДВУХ практических этапов и одного теоретического — используются как
   middle-этапы урока (после этапа "Старт" и перед этапом "Итог", которые
   уже существуют).

ВЕРНИ СТРОГО JSON (без markdown, без пояснений вне JSON), формат:
{
  "topic": "название новой темы урока",
  "theory": {
    "title": "короткое название теоретического этапа",
    "slides": [
      { "layout": "title", "title": "...", "content": "..." },
      { "layout": "default", "title": "...", "content": "## заголовок\\n\\nпараграф текста\\n\\n- пункт\\n- пункт" }
    ]
  },
  "practice": {
    "title": "короткое название практического этапа",
    "description": "что конкретно делает ученик (2-3 предложения)",
    "teacher_notes": "методические подсказки учителю",
    "starter_code": "код (ТОЛЬКО если practice_kind=code, иначе не заполнять)"
  },
  "quiz": {
    "title": "короткое название этапа теста",
    "questions": [
      { "text": "вопрос", "options": ["вариант 1","вариант 2","вариант 3","вариант 4"], "correct_index": 0 }
    ]
  }
}

ПРАВИЛА ДЛЯ topic:
- Логичное продолжение программы после уже пройденных тем, НЕ дублирует
  ничего из списка уже пройденного. Короткое, конкретное название.

ПРАВИЛА ДЛЯ theory.slides:
- 4-6 слайдов, суммарно 400-600 слов текста в content по всем слайдам.
- Первый слайд layout="title" (короткое вступление), остальные layout="default".
- content — markdown: заголовки ##, списки через "-", **жирный** для терминов.
- СТРОГО адаптировано под класс (возраст ученика): 3 класс — простые слова,
  короткие предложения; 7 класс — средний уровень; 10 класс — академический
  стиль, формулы/код где уместно.
- Раскрывает ИМЕННО предложенную тему, с конкретными фактами/примерами.
  Без эмодзи.

ПРАВИЛА ДЛЯ practice (тип practice_kind передаётся во входных данных):
- "code": starter_code — рабочий пример кода по теме (Python), description
  объясняет что ученик должен изменить/дополнить, teacher_notes — эталонное
  решение и типичные ошибки.
- "wokwi" / "blockly_games": starter_code НЕ заполнять; description — что
  именно ученик делает во внешнем редакторе, teacher_notes — на что
  учителю обратить внимание.

ПРАВИЛА ДЛЯ quiz.questions:
- Ровно 5 вопросов, проверяющих ПОНИМАНИЕ темы, сложность соответствует
  классу. correct_index — индекс правильного варианта (0-based), ровно
  один правильный вариант, 4 варианта на вопрос.

ЯЗЫК: весь текст (theory, practice, quiz) — на русском, независимо от
предмета. Только валидный JSON, ничего больше.`;

const SIMPLE_SYSTEM_PROMPT = `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: для заданного урока (предмет, класс, список уже пройденных тем) —
1) предложить СЛЕДУЮЩУЮ тему урока (не повторяя уже пройденное), 2)
сгенерировать КОРОТКИЙ теоретический блок и маленький quiz — используются
как middle-этапы урока (после "Старт" и перед "Итог", которые уже существуют).
БЕЗ практического этапа — только теория и тест.

ВЕРНИ СТРОГО JSON (без markdown, без пояснений вне JSON), формат:
{
  "topic": "название новой темы урока",
  "theory": {
    "title": "короткое название теоретического этапа",
    "content": "1-2 коротких абзаца текста, markdown допустим (## заголовок, **жирный**)"
  },
  "quiz": {
    "title": "короткое название этапа теста",
    "questions": [
      { "text": "вопрос", "options": ["вариант 1","вариант 2","вариант 3","вариант 4"], "correct_index": 0 }
    ]
  }
}

ПРАВИЛА ДЛЯ topic:
- Логичное продолжение программы после уже пройденных тем, не дублирует
  список пройденного. Короткое, конкретное название.

ПРАВИЛА ДЛЯ theory.content:
- РОВНО 100-150 слов суммарно (это короткий формат, не полная презентация).
- СТРОГО адаптировано под класс: 3 класс — простые слова; 7 класс — средний
  уровень; 10 класс — академический стиль.
- Раскрывает конкретно предложенную тему, без эмодзи.
- ИСКЛЮЧЕНИЕ ПО ЯЗЫКУ для предмета "Английский язык": theory.content
  пишется НА АНГЛИЙСКОМ (тема, примеры, разбор — как в реальном уроке
  английского). Для всех остальных предметов (в том числе "Русский язык")
  — content на русском.

ПРАВИЛА ДЛЯ quiz.questions:
- Ровно 3 вопроса, проверяющих понимание темы, сложность по классу.
  correct_index — индекс правильного варианта (0-based), 4 варианта на
  вопрос, один правильный.
- ЯЗЫК QUIZ — ВСЕГДА РУССКИЙ, включая quiz для урока "Английский язык"
  (вопрос и все варианты ответа на русском, даже если theory.content был
  на английском) — чтобы не путать язык вопроса с языком темы.

Только валидный JSON, ничего больше.`;

function buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin }) {
  return `ВХОДНЫЕ ДАННЫЕ:
- Класс: ${grade}
- Предмет: ${subjectName}
- Уже пройденные темы (не повторять): ${usedTopics.length ? usedTopics.join("; ") : "(пока нет — это первая тема)"}
${practiceKind ? `- practice_kind: ${practiceKind}\n` : ""}- Длительность урока: ${durationMin} минут`;
}

// ── Gemini-вызов с ретраями + аварийный exit при 3+ подряд 429 ────────────
// (счётчик consecutive429Fails — глобальный, между РАЗНЫМИ уроками, не
// путать с внутренним backoff ОДНОГО урока: там до 3 попыток на 429 перед
// тем как урок считается провалившимся; если 3 УРОКА ПОДРЯД так провалились
// — квота явно исчерпана на сегодня, продолжать бессмысленно.)
let consecutive429Fails = 0;
const MAX_CONSECUTIVE_429_LESSONS = 3;

async function callGeminiWithRetry(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
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
      const is429 = e.status === 429 || /429|rate.?limit|quota/i.test(e.message ?? "");
      if (is429 && attempt < BACKOFF_429_MS.length) {
        const delay = BACKOFF_429_MS[attempt];
        console.warn(`  [retry 429] попытка ${attempt + 1}/${BACKOFF_429_MS.length}, пауза ${delay}мс`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!is429 && !otherErrorRetried) {
        otherErrorRetried = true;
        console.warn(`  [retry] ошибка "${(e.message ?? "").split("\n")[0]}", 1 ретрай через 3с`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      const err = e;
      err.__is429Exhausted = is429;
      throw err;
    }
  }
}

function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

const STAGE_DURATIONS_FULL = { theory: 70, practice: 90, quiz: 25 };
const STAGE_DURATIONS_SIMPLE = { theory: 20, quiz: 15 };
const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

// ── чекпоинт (резюмируемый) ────────────────────────────────────────────────
const LOG_PATH = path.resolve(process.cwd(), "scripts/.lessons-progress-jul18-25.json");
function loadLog() {
  return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {}, results: [] };
}
function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
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

  // Идемпотентность: урок уже с контентом = у него ЕСТЬ lesson_stages со
  // stage_role='middle' (create-lesson-slots-jul18-31.mjs создал ТОЛЬКО
  // start/summary — middle появляется только после генерации).
  const { data: stageRows, error: stageErr } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  if (stageErr) throw new Error(`fetch stages: ${stageErr.message}`);
  const hasMiddle = new Set((stageRows ?? []).map((r) => r.lesson_id));

  // Уже использованные темы по (предмет,группа) — источник: ЛЮБОЙ урок с
  // middle-этапами во ВСЕЙ БД (не только в этом диапазоне дат), чтобы не
  // повторять тему, пройденную 7-16/17 июля или уже сгенерированную здесь.
  const { data: filledWithStages, error: filledErr } = await db
    .from("lessons")
    .select("id, topic, group:groups(name), subject:subjects(name)")
    .in("id", [...hasMiddle]);
  if (filledErr) throw new Error(`fetch used topics: ${filledErr.message}`);
  const usedTopicsByKey = new Map();
  for (const l of filledWithStages ?? []) {
    if (!l.topic || !l.subject?.name || !l.group?.name) continue;
    const key = `${l.subject.name}|${l.group.name}`;
    const arr = usedTopicsByKey.get(key) ?? [];
    if (!arr.includes(l.topic)) arr.push(l.topic);
    usedTopicsByKey.set(key, arr);
  }

  const log = loadLog();
  console.log(`Уроков в диапазоне ${DATE_FROM}..${DATE_TO}: ${allLessons.length}`);

  if (!DRY_RUN) {
    modelName = await pickWorkingModel();
    if (!modelName) {
      console.warn("Ни одна модель недоступна (дневной лимит исчерпан?). Прогресс не потерян — повторите позже.");
      return;
    }
  }

  let geminiCallsThisRun = 0;
  let done = 0, skipped = 0, errors = 0;
  let abortedOn429 = false;

  for (let i = 0; i < allLessons.length; i++) {
    const lessonSpec = allLessons[i];
    const n = i + 1;
    const subjectName = lessonSpec.subject?.name;
    const groupName = lessonSpec.group?.name;
    const isFull = FULL_SUBJECTS.has(subjectName);
    const logPrefix = `[${n}/${allLessons.length}] ${groupName} · ${lessonSpec.starts_at.slice(0, 10)} · ${lessonSpec.starts_at.slice(11, 16)} · ${subjectName} [${isFull ? "FULL" : "SIMPLE"}]`;

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

    if (geminiCallsThisRun >= LIMIT_PER_RUN) {
      console.log(`${logPrefix} → SKIPPED (limit-per-run=${LIMIT_PER_RUN} достигнут в этом запуске, останется на следующий)`);
      skipped++;
      continue;
    }

    const grade = GRADE_BY_GROUP[groupName];
    const practiceKindFn = isFull ? PRACTICE_KIND_BY_SUBJECT[subjectName] : null;
    if (isFull && !practiceKindFn) {
      console.error(`${logPrefix} → ERROR (нет practice_kind для "${subjectName}")`);
      log.results.push({ id: lessonSpec.id, error: "no_practice_kind" });
      errors++;
      continue;
    }
    const practiceKind = practiceKindFn ? practiceKindFn(groupName) : null;
    const key = `${subjectName}|${groupName}`;
    const usedTopics = usedTopicsByKey.get(key) ?? [];
    const userPrompt = buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin: 45 });

    geminiCallsThisRun++;
    let response;
    try {
      response = await callGeminiWithRetry(isFull ? FULL_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT, userPrompt);
      consecutive429Fails = 0;
    } catch (e) {
      console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: e.message });
      saveLog(log);
      errors++;
      if (e.__is429Exhausted) {
        consecutive429Fails++;
        console.warn(`  consecutive 429-провалов подряд: ${consecutive429Fails}/${MAX_CONSECUTIVE_429_LESSONS}`);
        if (consecutive429Fails >= MAX_CONSECUTIVE_429_LESSONS) {
          console.error(`\n!!! АВАРИЙНОЕ ЗАВЕРШЕНИЕ: ${MAX_CONSECUTIVE_429_LESSONS} урока подряд провалились на 429 — похоже, дневная квота Gemini исчерпана. Прогресс сохранён в чекпоинте, остальное — следующим запуском (после сброса квоты).`);
          abortedOn429 = true;
          break;
        }
      }
      continue;
    }

    const usageMeta = response.usageMetadata ?? {};
    const text = response.text();
    let parsed;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch (e) {
      console.error(`${logPrefix} → ERROR (JSON parse: ${e.message})`);
      log.done[lessonSpec.id] = true;
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: "parse_failed" });
      saveLog(log);
      errors++;
      continue;
    }

    const topic = parsed.topic ?? subjectName;
    usedTopicsByKey.set(key, [...usedTopics, topic]);

    const { error: topicErr } = await db.from("lessons").update({ topic, title: topic }).eq("id", lessonSpec.id);
    if (topicErr) console.error(`  !! lesson topic update failed: ${topicErr.message}`);

    const stagesToInsert = isFull
      ? [
          {
            position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation",
            title: parsed.theory.title, description: null, slides: parsed.theory.slides,
            difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.theory,
          },
          {
            position: 2, stage_role: "middle", stage_type: "task", content_type: practiceKind,
            title: parsed.practice.title, description: parsed.practice.description, teacher_notes: parsed.practice.teacher_notes,
            ...(practiceKind === "code" ? { starter_code: parsed.practice.starter_code, programming_language: "python" } : {}),
            config: practiceKind === "code" ? {} : { url: "", requires_link: true, requires_screenshot: false },
            difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.practice,
          },
          {
            position: 3, stage_role: "middle", stage_type: "task", content_type: "quiz_qia",
            title: parsed.quiz.title, description: null,
            config: { time_limit_minutes: null, points_per_question: 1 },
            difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.quiz,
          },
        ]
      : [
          {
            position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation",
            title: parsed.theory.title, description: null,
            slides: [{ layout: "default", title: parsed.theory.title, content: parsed.theory.content }],
            difficulty: "medium", duration_min: STAGE_DURATIONS_SIMPLE.theory,
          },
          {
            position: 2, stage_role: "middle", stage_type: "task", content_type: "quiz_qia",
            title: parsed.quiz.title, description: null,
            config: { time_limit_minutes: null, points_per_question: 1 },
            difficulty: "medium", duration_min: STAGE_DURATIONS_SIMPLE.quiz,
          },
        ];

    let quizStageId = null;
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

    if (quizStageId && parsed.quiz.questions?.length) {
      const rows = parsed.quiz.questions.map((q, qi) => ({
        stage_id: quizStageId, school_id: SCHOOL_ID, position: qi, question_text: q.text, options: q.options,
        correct_option_index: q.correct_index, points: 1, time_per_question_seconds: 20,
      }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    }

    log.done[lessonSpec.id] = true;
    log.results.push({
      id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName,
      format: isFull ? "FULL" : "SIMPLE", topic, usage: usageMeta, writeOk,
    });
    saveLog(log);
    console.log(`${logPrefix} → OK: "${topic}"`);
    done++;
  }

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  console.log(`  ${DRY_RUN ? "Было бы сгенерировано" : "Сгенерировано"}: ${done}`);
  console.log(`  Пропущено (уже готово / вне лимита): ${skipped}`);
  console.log(`  Ошибок: ${errors}`);
  if (abortedOn429) {
    console.log(`  !!! АВАРИЙНО ЗАВЕРШЕНО — ${MAX_CONSECUTIVE_429_LESSONS} урока подряд на 429 (квота исчерпана).`);
  }
  if (!DRY_RUN) {
    const { data: usageAfter } = await db.rpc("get_ai_usage_today");
    console.log(`  ai_usage_log до запуска: ${usageBefore ?? "?"} / 250`);
    console.log(`  ai_usage_log после запуска: ${usageAfter ?? "?"} / 250`);
  }
  console.log(`  Время выполнения: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);
  const stillPending = allLessons.filter((l) => !(hasMiddle.has(l.id) || log.done[l.id])).length;
  if (!DRY_RUN && stillPending > 0) {
    console.log(`\n  Осталось необработанных: ${stillPending}. Для добивания — тот же запуск ещё раз:`);
    console.log(`  node --env-file=.env.local scripts/generate-lessons-jul18-25.mjs --confirm --limit-per-run=${LIMIT_PER_RUN}`);
  }
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
