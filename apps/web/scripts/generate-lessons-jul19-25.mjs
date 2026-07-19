#!/usr/bin/env node
// Пачка 4 — генерация контента уроков 19-25 июля 2026 (окно демо-подготовки,
// ВСЕ 7 дней учебные, включая субботу 25.07 — выходных в этом окне нет).
//
// Новый файл, НЕ замена apps/web/scripts/generate-lessons.mjs (тот не трогаем,
// остаётся рядом как образец паттерна для старого диапазона 13-24 июля).
// Переиспользует:
//   - auth/CLI-arg/batching паттерн apps/web/scripts/backfill-historical.mjs
//     (service-role client — куратор через anon-ключ после миграции 131
//     может писать lesson_stages только для is_demo=true уроков; наши уроки
//     не demo, значит anon+teacher_karim упадёт по RLS)
//   - Gemini-вызов/ретраи/выбор модели apps/web/scripts/generate-lessons.mjs
//     (один JSON-вызов на урок, topic+контент разом — экономит отдельный
//     вызов на "придумать тему", как в оригинале)
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/generate-lessons-jul19-25.mjs --dry-run
//   node --env-file=.env.local scripts/generate-lessons-jul19-25.mjs --confirm
//   node --env-file=.env.local scripts/generate-lessons-jul19-25.mjs --confirm --limit-per-run=15
//
// Аргументы:
//   --confirm            обязателен для боевого запуска; без него — dry-run
//   --dry-run             явный dry-run (тоже работает без --confirm)
//   --limit-per-run=N     максимум Gemini-генераций за один запуск (default 40,
//                         с запасом от 250 RPD free tier)
//   --skip-inserts        пропустить Этап A (insert 9 уроков на 25.07),
//                         сразу Этап B на уже существующих empty-уроках
//
// СХЕМА / ДОПУЩЕНИЯ (подтверждены live-запросами к hosted БД в этой сессии):
//   - lessons: НЕТ updated_at, НЕТ teacher_id (учитель выводится через
//     subject_id -> subjects.teacher_id). status='scheduled' для будущих
//     уроков (как во всех существующих empty-уроках 19-24).
//   - lesson_stages: КАЖДЫЙ урок уже имеет scaffolding
//     position=0/stage_role='start'/title='Старт' и
//     position=9999/stage_role='summary'/title='Итог' — не создаётся этим
//     скриптом для существующих уроков (уже есть), но ОБЯЗАТЕЛЬНО создаётся
//     для 9 новых уроков 25.07 в Этапе A (иначе они останутся без базовой
//     разметки, которую обычный flow создания урока добавляет сам).
//   - "Пусто" = нет lesson_stages со stage_role='middle' (то же определение,
//     что в generate-lessons.mjs).
//   - FULL (Программирование/Робототехника): 3 middle-этапа, position 1-3 —
//     theory(presentation)/practice/quiz_qia, 5 вопросов — 1:1 формат
//     generate-lessons.mjs.
//   - SIMPLE (Математика/Русский/Английский): 2 middle-этапа, position 1-2 —
//     theory(presentation, ОДИН короткий слайд)/quiz_qia (3 вопроса), БЕЗ
//     practice-этапа вообще.
//   - Язык: весь текст на русском, ВКЛЮЧАЯ quiz для урока Английского
//     (чтобы Gemini не путала языки в оценке ответов). Theory-контент для
//     самого предмета "Английский язык" — на английском (тема/примеры),
//     ровно как ведётся реальный урок английского; для "Русский язык" и
//     "Математика" — на русском.

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { attachBooksToLesson } from "./_backfill-shared.mjs";

// ── env + clients (service-role — паттерн backfill-historical.mjs) ────────
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
  console.error("Запускай так: node --env-file=.env.local scripts/generate-lessons-jul19-25.mjs [--dry-run|--confirm]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

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
const SKIP_INSERTS = flag("skip-inserts");

// ── date scope — по умолчанию 19-25 июля (как было), переопределяемо
//    флагами --start-date/--end-date (Пачка «18-23», без правки констант
//    внутри файла — тот же паттерн CLI-опций, что limit-per-run). Этап A
//    (insert 9 уроков на 25.07) НЕ зависит от этого диапазона — он всегда
//    про конкретно 25.07, поэтому для диапазонов, не включающих 25.07,
//    запускать с --skip-inserts. ────────────────────────────────────────
const START_DATE = opt("start-date", "2026-07-19");
const END_DATE = opt("end-date", "2026-07-25"); // inclusive
const TZ_OFFSET = "+05:00";
const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
const rangeEndExclusiveIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(70));
console.log(`Пачка 4 — генерация уроков ${START_DATE}..${END_DATE} (7 дней, без выходных)`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД, Gemini не вызываем)" : "БОЕВОЙ (пишем в БД + вызываем Gemini)"}`);
console.log(`limit-per-run: ${LIMIT_PER_RUN}${SKIP_INSERTS ? " | --skip-inserts: Этап A пропущен" : ""}`);
console.log("═".repeat(70));

// ── rate limiting: 6.5с между Gemini-вызовами, запас над 10 RPM ──────────
const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ── выбор рабочей модели (тот же паттерн, что generate-lessons.mjs) ──────
// Находка «защиты от лимита»: ОДИН короткий "ping" в начале запуска НЕ
// гарантирует, что модель останется доступна для всей пачки — при живом
// проде GEMINI_API_KEY общий на ВСЕ AI-фичи приложения (чат-ассистент,
// проверка ДЗ, RAG, встроенный AI-генератор этапов, cron-очереди), и
// конкурентный трафик может исчерпать RPD именно в промежутке между
// удачным ping и первым реальным вызовом. exhaustedModels — модели,
// которые callGeminiWithRetry уже пометил RPD-исчерпанными В ЭТОМ запуске
// (независимо от ping) — pickWorkingModel их больше не предлагает.
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
let modelName = null;
const exhaustedModels = new Set();
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    if (exhaustedModels.has(candidate)) continue;
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

// ── системные промпты: FULL и SIMPLE ──────────────────────────────────────

const GRADE_BY_GROUP = { "3-А класс": 3, "7-А класс": 7, "10-А класс": 10 };
const FULL_SUBJECTS = new Set(["Программирование", "Робототехника"]);
const PRACTICE_KIND_BY_SUBJECT = {
  "Программирование": (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  "Робототехника": () => "wokwi",
};

// FULL — 1:1 формат generate-lessons.mjs: theory(4-6 слайдов)+practice+quiz(5).
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

// SIMPLE — короткий theory-слайд (100-150 слов) + quiz из 3 вопросов, БЕЗ
// practice-этапа вообще (Математика/Русский/Английский — экономим Gemini-
// бюджет и объём контента, задача не требует полного формата для этих
// предметов).
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

// ── Gemini-вызов с ретраями (п.8: 429 → 5с/15с/45с, макс 3; другое → 1 ретрай 3с) ──
// Защита от лимита: реальный RPD free-tier у gemini-2.5-flash оказался
// намного ниже, чем 250 (см. прошлый прогон — quotaId
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue 20).
// Backoff 5с/15с/45с осмыслен только для ПОМИНУТНОГО (RPM) лимита — для
// ДНЕВНОГО (RPD) ретраи заведомо бесполезны (та же ошибка повторится и
// после 45с, и на следующем уроке, и на следующем после него — очередь из
// N оставшихся уроков впустую сожгла бы N×~65с на гарантированно
// провальные ретраи). quotaId в теле 429-ошибки различает RPD от RPM —
// при обнаружении RPD бросаем ОСОБУЮ ошибку с isDailyQuota=true СРАЗУ,
// без единого ретрая, чтобы вызывающий цикл (stageB_generateContent) мог
// остановиться чисто, а не перемалывать всю оставшуюся очередь.
function isDailyQuotaError(e) {
  return /GenerateRequestsPerDay/i.test(e.message ?? "");
}
// Внешний for(;;) пересоздаёт `model` при смене modelName (см.
// exhaustedModels-ветку ниже) и просто зацикливается заново — выход из
// функции всегда через return (успех) или throw (все модели исчерпаны /
// не-квотная ошибка), явного "конца" у внешнего цикла нет и не нужно.
async function callGeminiWithRetry(systemPrompt, userPrompt) {
  for (;;) {
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
        if (isDailyQuotaError(e)) {
          // RPD для ТЕКУЩЕЙ модели исчерпан — ретраить бесполезно (см.
          // комментарий выше). Пробуем следующую модель-кандидат ПРЯМО
          // СЕЙЧАС (ping из pickWorkingModel сам по себе не гарантирует,
          // что реальный вызов пройдёт — конкурентный прод-трафик на тот
          // же GEMINI_API_KEY может исчерпать RPD в промежутке между
          // удачным ping и этим вызовом; живое наблюдение этой сессии).
          exhaustedModels.add(modelName);
          console.warn(`  [daily quota] "${modelName}" исчерпана на сегодня, пробуем следующую модель...`);
          const next = await pickWorkingModel();
          if (!next) {
            e.isDailyQuota = true; // все кандидаты исчерпаны — наверх, чистая остановка батча
            throw e;
          }
          modelName = next;
          break; // выходим из inner-ретрай-цикла, внешний for(;;) пересоздаст model с новым modelName
        }
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
        throw e;
      }
    }
  }
}

function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

const STAGE_DURATIONS_FULL = { theory: 70, practice: 90, quiz: 25 };
const STAGE_DURATIONS_SIMPLE = { theory: 20, quiz: 15 };

// ── чекпоинт (резюмируемый, как в generate-lessons.mjs) ────────────────────
const LOG_PATH = path.resolve(process.cwd(), "scripts/.lessons-progress-jul19-25.json");
function loadLog() {
  return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {}, results: [] };
}
function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// ── Этап A — insert 9 уроков на 25.07 (если их ещё нет) ────────────────────
// Ротация: определена ЯВНО (не алгоритмически) — продолжает наблюдаемый
// на 19-24 июля паттерн "3 разных предмета на группу за день, разные
// комбинации между группами". Даёт ровно 4 FULL + 5 SIMPLE слотов, как и
// в среднем на других днях этого окна.
const JULY25_PLAN = [
  { time: "03:30", group: "3-А класс", subject: "Робототехника" },
  { time: "06:55", group: "3-А класс", subject: "Математика" },
  { time: "10:20", group: "3-А класс", subject: "Английский язык" },
  { time: "03:30", group: "7-А класс", subject: "Программирование" },
  { time: "06:55", group: "7-А класс", subject: "Русский язык" },
  { time: "10:20", group: "7-А класс", subject: "Робототехника" },
  { time: "03:30", group: "10-А класс", subject: "Математика" },
  { time: "06:55", group: "10-А класс", subject: "Программирование" },
  { time: "10:20", group: "10-А класс", subject: "Русский язык" },
];

async function stageA_insertJuly25() {
  console.log("\n[Этап A] Проверка/создание 9 уроков на 25.07.2026...");
  if (SKIP_INSERTS) {
    console.log("  --skip-inserts указан — пропускаем Этап A целиком.");
    return;
  }

  const { count, error: countErr } = await db
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .gte("starts_at", "2026-07-25T00:00:00+05:00")
    .lt("starts_at", "2026-07-26T00:00:00+05:00");
  if (countErr) throw new Error(`stageA count check: ${countErr.message}`);
  if (count > 0) {
    console.log(`  На 25.07 уже есть ${count} уроков — идемпотентность: пропускаем insert.`);
    return;
  }

  const { data: groups, error: gErr } = await db.from("groups").select("id, name");
  if (gErr) throw new Error(`stageA groups: ${gErr.message}`);
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

  const { data: subjects, error: sErr } = await db.from("subjects").select("id, name, group_id").eq("is_stub", false);
  if (sErr) throw new Error(`stageA subjects: ${sErr.message}`);
  const subjectIdByKey = new Map(subjects.map((s) => [`${s.name}|${s.group_id}`, s.id]));

  const rows = JULY25_PLAN.map((p) => {
    const groupId = groupIdByName.get(p.group);
    const subjectId = subjectIdByKey.get(`${p.subject}|${groupId}`);
    if (!groupId || !subjectId) throw new Error(`stageA: не нашли group/subject для ${JSON.stringify(p)}`);
    const startsAt = `2026-07-25T${p.time}:00+00:00`;
    const endsAt = new Date(new Date(startsAt).getTime() + 45 * 60000).toISOString();
    return {
      group_id: groupId,
      subject_id: subjectId,
      school_id: SCHOOL_ID,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "scheduled",
      topic: p.subject,
      title: p.subject,
      duration_minutes: 45,
    };
  });

  const fullCount = JULY25_PLAN.filter((p) => FULL_SUBJECTS.has(p.subject)).length;
  console.log(`  План: 9 новых уроков (${fullCount} FULL + ${9 - fullCount} SIMPLE).`);
  for (const p of JULY25_PLAN) console.log(`    ${p.time} UTC · ${p.group} · ${p.subject} [${FULL_SUBJECTS.has(p.subject) ? "FULL" : "SIMPLE"}]`);

  if (DRY_RUN) {
    console.log("  [DRY-RUN] insert НЕ выполнен.");
    return;
  }

  const { data: inserted, error: insErr } = await db.from("lessons").insert(rows).select("id");
  if (insErr) throw new Error(`stageA insert lessons: ${insErr.message}`);
  console.log(`  Создано ${inserted.length} уроков.`);

  // Базовый scaffolding (start/summary) — каждый существующий урок в системе
  // его уже имеет (создаётся обычным flow планирования, не этим скриптом);
  // для новых строк, вставленных напрямую, создаём вручную.
  const scaffoldRows = inserted.flatMap((l) => [
    { lesson_id: l.id, school_id: SCHOOL_ID, position: 0, stage_role: "start", title: "Старт", config: {} },
    { lesson_id: l.id, school_id: SCHOOL_ID, position: 9999, stage_role: "summary", title: "Итог", config: {} },
  ]);
  const { error: scaffoldErr } = await db.from("lesson_stages").insert(scaffoldRows);
  if (scaffoldErr) throw new Error(`stageA scaffold stages: ${scaffoldErr.message}`);
  console.log(`  Создан scaffolding (Старт/Итог) для ${inserted.length} уроков.`);
}

// ── Этап B — генерация контента для всех empty-уроков 19-25.07 ─────────────
async function stageB_generateContent() {
  console.log("\n[Этап B] Генерация контента для empty-уроков 19-25.07...");

  const { data: allLessons, error: fetchErr } = await db
    .from("lessons")
    .select("id, starts_at, group:groups(name), subject:subjects(name, teacher_id)")
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });
  if (fetchErr) throw new Error(`stageB fetch lessons: ${fetchErr.message}`);

  const { data: stageRows, error: stageErr } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  if (stageErr) throw new Error(`stageB fetch stages: ${stageErr.message}`);
  const hasMiddle = new Set((stageRows ?? []).map((r) => r.lesson_id));
  const emptyLessons = (allLessons ?? []).filter((l) => !hasMiddle.has(l.id));

  const fullEmpty = emptyLessons.filter((l) => FULL_SUBJECTS.has(l.subject?.name));
  const simpleEmpty = emptyLessons.filter((l) => !FULL_SUBJECTS.has(l.subject?.name));
  console.log(`  Пусто в 19-25.07: ${emptyLessons.length} (FULL=${fullEmpty.length}, SIMPLE=${simpleEmpty.length})`);

  // Уже использованные темы по (предмет,группа) — источник: ЛЮБОЙ урок с
  // middle-этапами (не только в этом окне), чтобы не повторять тему,
  // пройденную 7-16 или 17-18 июля.
  const { data: filledWithStages, error: filledErr } = await db
    .from("lessons")
    .select("id, topic, group:groups(name), subject:subjects(name)")
    .in("id", [...hasMiddle]);
  if (filledErr) throw new Error(`stageB fetch used topics: ${filledErr.message}`);
  const usedTopicsByKey = new Map();
  for (const l of filledWithStages ?? []) {
    if (!l.topic || !l.subject?.name || !l.group?.name) continue;
    const key = `${l.subject.name}|${l.group.name}`;
    const arr = usedTopicsByKey.get(key) ?? [];
    if (!arr.includes(l.topic)) arr.push(l.topic);
    usedTopicsByKey.set(key, arr);
  }

  const log = loadLog();
  const pending = emptyLessons.filter((l) => !log.done[l.id]);
  const batch = pending.slice(0, LIMIT_PER_RUN);
  console.log(`  В очереди (не done в чекпоинте): ${pending.length}. В этом запуске: ${batch.length} (limit-per-run=${LIMIT_PER_RUN}).`);

  if (batch.length === 0) {
    console.log("  Нечего делать — либо всё сгенерировано, либо всё в чекпоинте done.");
    return { done: 0, skipped: 0, errors: 0, total: emptyLessons.length };
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Было бы сделано ${batch.length} Gemini-вызовов:`);
    let i = 0;
    for (const l of batch) {
      i++;
      const subjectName = l.subject?.name;
      const cat = FULL_SUBJECTS.has(subjectName) ? "FULL" : "SIMPLE";
      console.log(`    [${i}/${batch.length}] ${l.group?.name} · ${subjectName} · ${l.starts_at} [${cat}]`);
    }
    return { done: 0, skipped: 0, errors: 0, total: emptyLessons.length, wouldCall: batch.length };
  }

  modelName = await pickWorkingModel();
  if (!modelName) {
    console.warn("Ни одна модель недоступна (дневной лимит исчерпан?). Прогресс не потерян — повторите позже.");
    return { done: 0, skipped: 0, errors: 0, total: emptyLessons.length };
  }

  let done = 0, errors = 0;
  let i = 0;
  for (const lessonSpec of batch) {
    i++;
    const subjectName = lessonSpec.subject?.name;
    const groupName = lessonSpec.group?.name;
    const grade = GRADE_BY_GROUP[groupName];
    const isFull = FULL_SUBJECTS.has(subjectName);
    const logPrefix = `[${i}/${batch.length}] ${groupName} · ${subjectName} · ${lessonSpec.starts_at}`;

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
    const userPrompt = buildUserPrompt({
      subjectName, usedTopics, practiceKind, grade,
      durationMin: isFull ? 45 : 45,
    });

    let response;
    try {
      response = await callGeminiWithRetry(isFull ? FULL_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT, userPrompt);
    } catch (e) {
      if (e.isDailyQuota) {
        // Дневной (RPD) лимит исчерпан — чистая остановка, БЕЗ попытки
        // прогнать остаток очереди (все они гарантированно 429 тем же
        // способом). Прогресс уже сохранён построчно (saveLog после
        // каждого урока) — повторный запуск подхватит с этого места.
        console.warn(`${logPrefix} → ДНЕВНОЙ ЛИМИТ ИСЧЕРПАН (RPD) — чистая остановка, оставшиеся ${batch.length - i} урок(ов) в этом запуске не тронуты.`);
        return { done, skipped: pending.length - i, errors, total: emptyLessons.length, stoppedOnDailyQuota: true, stoppedAt: { id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName } };
      }
      console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: e.message });
      saveLog(log);
      errors++;
      continue;
    }

    const usageMeta = response.usageMetadata ?? {};
    const text = response.text();
    let parsed;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch (e) {
      console.error(`${logPrefix} → ERROR (JSON parse: ${e.message})`);
      log.done[lessonSpec.id] = true; // не повторяем бесконечно один и тот же кривой ответ
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

    // Пачка «240 пустых уроков», ЧАСТЬ 3 — финальный шаг: прицепить до 3
    // книг БЗ того же предмета (без Gemini, чистое сопоставление). Best-
    // effort — не влияет на writeOk/done, этапы уже успешно записаны.
    let materialsAttached = 0;
    try {
      const matResult = await attachBooksToLesson(db, {
        lessonId: lessonSpec.id, subjectName, teacherId: lessonSpec.subject?.teacher_id ?? null, maxBooks: 3,
      });
      materialsAttached = matResult.attached;
    } catch (e) {
      console.error(`  !! attachBooksToLesson failed: ${e.message}`);
    }

    log.done[lessonSpec.id] = true;
    log.results.push({
      id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName,
      format: isFull ? "FULL" : "SIMPLE", topic, usage: usageMeta, writeOk, materialsAttached,
    });
    saveLog(log);
    console.log(`${logPrefix} [${isFull ? "FULL" : "SIMPLE"}] → ${writeOk ? "OK" : "PARTIAL"}: "${topic}" (материалов: ${materialsAttached})`);
    done++;
  }

  return { done, skipped: pending.length - batch.length, errors, total: emptyLessons.length };
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  await stageA_insertJuly25();
  const result = await stageB_generateContent();

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  if (DRY_RUN) {
    console.log(`  Режим: DRY-RUN — БД не менялась, Gemini не вызывался.`);
    console.log(`  Было бы сгенерировано: ${result.wouldCall ?? 0} уроков.`);
  } else {
    console.log(`  Сгенерировано в этом запуске: ${result.done}`);
    console.log(`  Осталось в очереди (вне limit-per-run): ${result.skipped}`);
    console.log(`  Ошибок: ${result.errors}`);
    console.log(`  Всего empty на момент запуска: ${result.total}`);
    if (result.stoppedOnDailyQuota) {
      console.log(`  ⚠ ОСТАНОВЛЕНО: дневной лимит (RPD) исчерпан.`);
      console.log(`    Последний урок в очереди на момент остановки: ${result.stoppedAt.subject} · ${result.stoppedAt.group} · ${result.stoppedAt.starts_at} (id ${result.stoppedAt.id})`);
      console.log(`    Прогресс сохранён в чекпоинте — повторный запуск продолжит с этого места (или со следующей доступной модели-фолбэка).`);
    }
    const { data: usageToday } = await db.rpc("get_ai_usage_today");
    // Реальный RPD free-tier у gemini-2.5-flash оказался НЕ 250 (см.
    // комментарий у isDailyQuotaError) — печатаем сырое число без
    // вводящего в заблуждение "/250".
    console.log(`  ai_usage_log сегодня: ${usageToday ?? "?"}`);
  }
  console.log(`  Время выполнения: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
