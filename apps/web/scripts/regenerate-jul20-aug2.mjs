#!/usr/bin/env node
// Очистка БД 7-26 июля — ЗАХОД 1: регенерация 20 июля - 2 августа 2026.
// Написан и закоммичен, НЕ запускался на проде. Запускает менеджер вручную
// (dry-run сначала), ПОСЛЕ cleanup-jul7-jul26.mjs --confirm.
//
// ЦЕЛЬ (см. cleanup-jul7-jul26.mjs для симметричного описания удаления):
//   - 20-26 июля — после чистки в БД пусто; этот скрипт создаёт уроки
//     заново (Фаза A), генерирует контент этапов через Gemini (Фаза B) и
//     бэкфиллит посещаемость/оценки/ДЗ (Фазы C/D) — ТОЛЬКО для этой недели,
//     т.к. на момент выполнения все её уроки уже в прошлом (ends_at < now).
//   - 27 июля - 2 августа — ЖИВОЙ запрос к БД в этой сессии подтвердил: 27-31
//     июля УЖЕ существуют (90 уроков, 18/день = 5+6+7 по трём группам) и УЖЕ
//     полностью заполнены контентом (90/90 с middle-этапами) — обычным ходом
//     работы приложения, cleanup их не трогает (диапазон чистки — только
//     7-26). Единственный пробел — 1-2 августа: уроков там СЕЙЧАС НЕТ ВООБЩЕ
//     (0 строк на момент разведки). Фаза A идемпотентна (пропускает уже
//     существующие (group_id, starts_at)), поэтому реально что-то создаст
//     только для 20-26 июля (после чистки) и 1-2 августа — 27-31 июля будут
//     молча пропущены как "уже есть". Фазы C/D (бэкфилл) СОЗНАТЕЛЬНО
//     ограничены явным диапазоном 20-26 июля (не глобальным ends_at<now()),
//     чтобы не трогать уже корректно заполненные 27-28 июля.
//
// СТРУКТУРА РАСПИСАНИЯ (источник истины — apps/web/scripts/create-lesson-
// slots-jul18-31.mjs, живой запрос подтвердил её действующей на 27-31 июля):
// 7 слотов по 45 мин с 09:00 Ташкент (04:00 UTC), 10-мин перемены. 3-А класс
// — 5 уроков/день, 7-А класс — 6/день, 10-А класс — 7/день. Кабинет — ВСЕМ
// урокам "Кабинет 101" (по прямому указанию задачи).
//
// ПРАВИЛО СЕССИИ: без выходных — ВСЕ 7 дней недели учебные, полный слот
// (5/6/7), БЕЗ урезанного "выходного" варианта, который использовал старый
// create-lesson-slots-jul18-31.mjs для 18/19/25/26 июля (тот вариант здесь
// сознательно НЕ воспроизводится — противоречит прямому указанию задачи).
//
// РОТАЦИЯ ПРЕДМЕТОВ: детерминированный (seeded, не Math.random — повторный
// запуск даёт тот же план) шаффл [Прог,Робот,Мат,Рус,Англ] на каждый
// (дата,группа), с добивкой Прог/Робот до нужного числа слотов группы —
// тот же принцип, что ручная таблица ротации в create-lesson-slots-jul18-31
// (Прог+Робот есть в каждом дне у каждой группы, Мат/Рус/Англ — минимум раз),
// но без ручного набора 14 дневных таблиц.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/regenerate-jul20-aug2.mjs --dry-run
//   node --env-file=.env.local scripts/regenerate-jul20-aug2.mjs --confirm
//   node --env-file=.env.local scripts/regenerate-jul20-aug2.mjs --confirm --limit-per-run=15
//   node --env-file=.env.local scripts/regenerate-jul20-aug2.mjs --confirm --skip-lessons --skip-backfill   (только контент)
//
// Аргументы:
//   --confirm            обязателен для боевого запуска; без него — dry-run
//   --start-date/--end-date  переопределить диапазон (default 2026-07-20/2026-08-02, включительно)
//   --backfill-start/--backfill-end  диапазон бэкфилла C/D (default 2026-07-20/2026-07-26)
//   --limit-per-run=N    максимум Gemini-генераций за один запуск (default 40)
//   --skip-lessons        пропустить Фазу A (insert уроков)
//   --skip-content         пропустить Фазу B (AI-этапы)
//   --skip-backfill        пропустить Фазы C/D (посещаемость/оценки/ДЗ)

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  attachBooksToLesson, SCHOOL_ID, REAL_STUDENT_USERNAMES,
  HOMEWORK_PROFILES, DEMO_HOMEWORK_PROFILE, GRADE_PROFILES, DEMO_GRADE_PROFILE,
  weightedPick, randomInt, randomTimeBetween, addMinutes, pick, maybeComment,
  HOMEWORK_SUBMISSION_TEXTS, HOMEWORK_TEACHER_COMMENTS,
} from "./_backfill-shared.mjs";

// ── env + clients ───────────────────────────────────────────────────────
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
const LIMIT_PER_RUN = Number(opt("limit-per-run", "40")) || 40;
const SKIP_LESSONS = flag("skip-lessons");
const SKIP_CONTENT = flag("skip-content");
const SKIP_BACKFILL = flag("skip-backfill");

const START_DATE = opt("start-date", "2026-07-20");
const END_DATE = opt("end-date", "2026-08-02"); // inclusive
const BACKFILL_START = opt("backfill-start", "2026-07-20");
const BACKFILL_END = opt("backfill-end", "2026-07-26"); // inclusive — "прошлая неделя" only
const TZ_OFFSET = "+05:00";

console.log("═".repeat(74));
console.log(`Регенерация уроков ${START_DATE}..${END_DATE} + бэкфилл ${BACKFILL_START}..${BACKFILL_END}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем, Gemini не вызываем)" : "БОЕВОЙ (--confirm)"}`);
console.log(`Фазы: A(уроки)=${!SKIP_LESSONS} B(AI-контент)=${!SKIP_CONTENT} C/D(бэкфилл)=${!SKIP_BACKFILL} · limit-per-run=${LIMIT_PER_RUN}`);
console.log("═".repeat(74));

function dateRangeInclusive(startStr, endStr) {
  const out = [];
  let d = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

// ── детерминированный PRNG (mulberry32), seed по строке — повторный запуск
//    без изменений входа даёт идентичный план (важно для dry-run→--confirm
//    согласованности и идемпотентных повторов). ──────────────────────────
function seedFromString(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── предметы / группы / слоты ──────────────────────────────────────────
const P = "Программирование", R = "Робототехника", M = "Математика", RU = "Русский язык", EN = "Английский язык";
const SLOTS_PER_GROUP = { "3-А класс": 5, "7-А класс": 6, "10-А класс": 7 };
const GROUPS = Object.keys(SLOTS_PER_GROUP);
const SLOT_TIMES_UTC = ["04:00", "04:55", "05:50", "06:55", "07:50", "08:45", "09:40"];
const ROOM = "Кабинет 101";
const FULL_SUBJECTS = new Set([P, R]);

function subjectsForDay(date, group) {
  const rng = mulberry32(seedFromString(`${date}|${group}`));
  const base = seededShuffle([P, R, M, RU, EN], rng);
  const n = SLOTS_PER_GROUP[group];
  const extra = [P, R].filter((_, i) => n - 5 > i); // n=5→+0, 6→+[P], 7→+[P,R]
  return seededShuffle([...base, ...extra], rng).slice(0, n);
}

function buildLessonPlan() {
  const plan = [];
  for (const date of dateRangeInclusive(START_DATE, END_DATE)) {
    for (const group of GROUPS) {
      subjectsForDay(date, group).forEach((subject, i) => {
        plan.push({ date, group, time: SLOT_TIMES_UTC[i], subject });
      });
    }
  }
  return plan;
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА A — insert уроков (идемпотентно: пропускает уже существующие
// (group_id, starts_at) — это то, что автоматически "оставляет в покое"
// уже заполненные 27-31 июля).
// ═══════════════════════════════════════════════════════════════════════
async function phaseA_insertLessons() {
  console.log("\n[Фаза A] Создание уроков…");
  if (SKIP_LESSONS) { console.log("  --skip-lessons — пропуск."); return; }

  const plan = buildLessonPlan();
  console.log(`  План: ${plan.length} слотов (${dateRangeInclusive(START_DATE, END_DATE).length} дней × 3 группы).`);

  const { data: groups, error: gErr } = await db.from("groups").select("id, name");
  if (gErr) throw new Error(`groups: ${gErr.message}`);
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

  const { data: subjects, error: sErr } = await db.from("subjects").select("id, name, group_id").eq("is_stub", false);
  if (sErr) throw new Error(`subjects: ${sErr.message}`);
  const subjectIdByKey = new Map(subjects.map((s) => [`${s.name}|${s.group_id}`, s.id]));

  const { data: existingLessons, error: exErr } = await db
    .from("lessons").select("group_id, starts_at")
    .gte("starts_at", `${START_DATE}T00:00:00${TZ_OFFSET}`)
    .lt("starts_at", new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString());
  if (exErr) throw new Error(`existing lessons: ${exErr.message}`);
  // Нормализуем ОБЕ стороны через Date().toISOString() перед сравнением —
  // PostgREST отдаёт starts_at как "...+00:00", а new Date(startsAt from
  // plan).toISOString() даёт "...Z" — разные строки для одного и того же
  // момента времени. Сравнение "как есть" (без нормализации) НИКОГДА не
  // матчит и ломает идемпотентность — этот же баг живёт непочиненным в
  // прежнем create-lesson-slots-jul18-31.mjs (тот скрипт уже отработал
  // один раз и не перезапускается, поэтому не трогаем его отдельно; но
  // раз баг найден именно при подготовке этого скрипта — стоит знать).
  const existingKeys = new Set((existingLessons ?? []).map((l) => `${l.group_id}|${new Date(l.starts_at).toISOString()}`));

  let created = 0, skipped = 0, errors = 0;
  for (const [i, slot] of plan.entries()) {
    const groupId = groupIdByName.get(slot.group);
    const subjectId = subjectIdByKey.get(`${slot.subject}|${groupId}`);
    const logPrefix = `  [${i + 1}/${plan.length}] ${slot.group} · ${slot.date} · ${slot.time} · ${slot.subject}`;
    if (!groupId || !subjectId) { console.error(`${logPrefix} → ERROR (нет group/subject)`); errors++; continue; }

    const startsAt = `${slot.date}T${slot.time}:00+00:00`;
    const key = `${groupId}|${new Date(startsAt).toISOString()}`;
    if (existingKeys.has(key)) { skipped++; continue; }

    if (DRY_RUN) { console.log(`${logPrefix} → [DRY-RUN] would CREATE`); created++; continue; }

    const endsAt = new Date(new Date(startsAt).getTime() + 45 * 60000).toISOString();
    const { data: inserted, error: insErr } = await db.from("lessons").insert({
      group_id: groupId, subject_id: subjectId, school_id: SCHOOL_ID,
      starts_at: startsAt, ends_at: endsAt, status: "scheduled",
      topic: slot.subject, title: slot.subject, duration_minutes: 45, room: ROOM,
    }).select("id").single();
    if (insErr) { console.error(`${logPrefix} → ERROR (${insErr.message})`); errors++; continue; }

    const { error: scaffoldErr } = await db.from("lesson_stages").insert([
      { lesson_id: inserted.id, school_id: SCHOOL_ID, position: 0, stage_role: "start", title: "Старт", config: {} },
      { lesson_id: inserted.id, school_id: SCHOOL_ID, position: 9999, stage_role: "summary", title: "Итог", config: {} },
    ]);
    if (scaffoldErr) { console.error(`${logPrefix} → PARTIAL (scaffold: ${scaffoldErr.message})`); errors++; continue; }

    existingKeys.add(key);
    created++;
  }
  console.log(`  Итог Фазы A: создано ${created}, пропущено (уже было) ${skipped}, ошибок ${errors}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА B — AI-генерация контента для пустых уроков диапазона (1:1 логика
// generate-lessons-jul19-25.mjs — FULL/SIMPLE промпты, throttle, retry,
// checkpoint, attachBooksToLesson).
// ═══════════════════════════════════════════════════════════════════════
const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}
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
      console.log(`  Используем модель: ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${(e.message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}

const GRADE_BY_GROUP = { "3-А класс": 3, "7-А класс": 7, "10-А класс": 10 };
const PRACTICE_KIND_BY_SUBJECT = {
  [P]: (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  [R]: () => "wokwi",
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

ПРАВИЛА ДЛЯ topic: логичное продолжение программы, НЕ дублирует пройденное. Короткое, конкретное.
ПРАВИЛА ДЛЯ theory.slides: 4-6 слайдов, суммарно 400-600 слов. Первый layout="title", остальные "default".
content — markdown. Адаптировано под класс (3/7/10). Без эмодзи.
ПРАВИЛА ДЛЯ practice: "code" → starter_code рабочий пример (Python); "wokwi"/"blockly_games" → starter_code пусто.
ПРАВИЛА ДЛЯ quiz.questions: ровно 5 вопросов, 4 варианта, один правильный (correct_index 0-based).
ЯЗЫК: весь текст на русском. Только валидный JSON.`;

const SIMPLE_SYSTEM_PROMPT = `Ты — методический ассистент для учителя в школе Узбекистана.

ЗАДАЧА: для заданного урока (предмет, класс, список уже пройденных тем) —
1) предложить СЛЕДУЮЩУЮ тему урока (не повторяя уже пройденное), 2)
сгенерировать КОРОТКИЙ теоретический блок и маленький quiz — используются
как middle-этапы урока (после "Старт" и перед "Итог"). БЕЗ practice-этапа.

ВЕРНИ СТРОГО JSON (без markdown, без пояснений вне JSON), формат:
{
  "topic": "название новой темы урока",
  "theory": { "title": "короткое название", "content": "1-2 коротких абзаца, markdown допустим" },
  "quiz": { "title": "короткое название", "questions": [ { "text": "вопрос", "options": ["1","2","3","4"], "correct_index": 0 } ] }
}

ПРАВИЛА ДЛЯ topic: логичное продолжение, не дублирует пройденное.
ПРАВИЛА ДЛЯ theory.content: РОВНО 100-150 слов. Адаптировано под класс.
ИСКЛЮЧЕНИЕ: для предмета "Английский язык" theory.content — НА АНГЛИЙСКОМ; для остальных — на русском.
ПРАВИЛА ДЛЯ quiz.questions: ровно 3 вопроса, 4 варианта, один правильный. ЯЗЫК QUIZ — ВСЕГДА РУССКИЙ.
Только валидный JSON.`;

function buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin }) {
  return `ВХОДНЫЕ ДАННЫЕ:
- Класс: ${grade}
- Предмет: ${subjectName}
- Уже пройденные темы (не повторять): ${usedTopics.length ? usedTopics.join("; ") : "(пока нет — это первая тема)"}
${practiceKind ? `- practice_kind: ${practiceKind}\n` : ""}- Длительность урока: ${durationMin} минут`;
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
const STAGE_DURATIONS_FULL = { theory: 70, practice: 90, quiz: 25 };
const STAGE_DURATIONS_SIMPLE = { theory: 20, quiz: 15 };
const LOG_PATH = path.resolve(process.cwd(), "scripts/.lessons-progress-jul20-aug2.json");
function loadLog() { return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {} }; }
function saveLog(log) { fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2)); }

async function phaseB_generateContent() {
  console.log("\n[Фаза B] Генерация AI-контента для пустых уроков…");
  if (SKIP_CONTENT) { console.log("  --skip-content — пропуск."); return; }

  const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

  const { data: allLessons, error: fetchErr } = await db
    .from("lessons")
    .select("id, starts_at, group:groups(name), subject:subjects(name, teacher_id)")
    .gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclIso)
    .order("starts_at", { ascending: true });
  if (fetchErr) throw new Error(`fetch lessons: ${fetchErr.message}`);

  const { data: stageRows, error: stageErr } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  if (stageErr) throw new Error(`fetch stages: ${stageErr.message}`);
  const hasMiddle = new Set((stageRows ?? []).map((r) => r.lesson_id));
  const emptyLessons = (allLessons ?? []).filter((l) => !hasMiddle.has(l.id));
  console.log(`  Пусто в диапазоне: ${emptyLessons.length} из ${allLessons.length} (27-31 июля должны быть уже заполнены и сюда не попасть).`);

  const { data: filledWithStages } = await db
    .from("lessons").select("id, topic, group:groups(name), subject:subjects(name)").in("id", [...hasMiddle]);
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
  console.log(`  В очереди: ${pending.length}. В этом запуске: ${batch.length} (limit-per-run=${LIMIT_PER_RUN}).`);
  if (batch.length === 0) { console.log("  Нечего делать."); return; }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Было бы сделано ${batch.length} Gemini-вызовов.`);
    return;
  }

  modelName = await pickWorkingModel();
  if (!modelName) { console.warn("  Ни одна модель недоступна (дневной лимит?). Повторите позже."); return; }

  let done = 0, errors = 0;
  for (const [i, lessonSpec] of batch.entries()) {
    const subjectName = lessonSpec.subject?.name;
    const groupName = lessonSpec.group?.name;
    const grade = GRADE_BY_GROUP[groupName];
    const isFull = FULL_SUBJECTS.has(subjectName);
    const logPrefix = `  [${i + 1}/${batch.length}] ${groupName} · ${subjectName} · ${lessonSpec.starts_at}`;

    const practiceKindFn = isFull ? PRACTICE_KIND_BY_SUBJECT[subjectName] : null;
    if (isFull && !practiceKindFn) { console.error(`${logPrefix} → ERROR (нет practice_kind)`); errors++; continue; }
    const practiceKind = practiceKindFn ? practiceKindFn(groupName) : null;
    const key = `${subjectName}|${groupName}`;
    const usedTopics = usedTopicsByKey.get(key) ?? [];
    const userPrompt = buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin: 45 });

    let response;
    try {
      response = await callGeminiWithRetry(isFull ? FULL_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT, userPrompt);
    } catch (e) {
      if (e.isDailyQuota) { console.warn(`${logPrefix} → ДНЕВНОЙ ЛИМИТ — чистая остановка.`); return; }
      console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
      errors++; continue;
    }

    let parsed;
    try { parsed = JSON.parse(stripFences(response.text())); }
    catch (e) { console.error(`${logPrefix} → ERROR (JSON parse)`); log.done[lessonSpec.id] = true; saveLog(log); errors++; continue; }

    const topic = parsed.topic ?? subjectName;
    usedTopicsByKey.set(key, [...usedTopics, topic]);
    await db.from("lessons").update({ topic, title: topic }).eq("id", lessonSpec.id);

    const stagesToInsert = isFull
      ? [
          { position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation", title: parsed.theory.title, slides: parsed.theory.slides, difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.theory },
          { position: 2, stage_role: "middle", stage_type: "task", content_type: practiceKind, title: parsed.practice.title, description: parsed.practice.description, teacher_notes: parsed.practice.teacher_notes, ...(practiceKind === "code" ? { starter_code: parsed.practice.starter_code, programming_language: "python" } : {}), config: practiceKind === "code" ? {} : { url: "", requires_link: true, requires_screenshot: false }, difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.practice },
          { position: 3, stage_role: "middle", stage_type: "task", content_type: "quiz_qia", title: parsed.quiz.title, config: { time_limit_minutes: null, points_per_question: 1 }, difficulty: "medium", duration_min: STAGE_DURATIONS_FULL.quiz },
        ]
      : [
          { position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation", title: parsed.theory.title, slides: [{ layout: "default", title: parsed.theory.title, content: parsed.theory.content }], difficulty: "medium", duration_min: STAGE_DURATIONS_SIMPLE.theory },
          { position: 2, stage_role: "middle", stage_type: "task", content_type: "quiz_qia", title: parsed.quiz.title, config: { time_limit_minutes: null, points_per_question: 1 }, difficulty: "medium", duration_min: STAGE_DURATIONS_SIMPLE.quiz },
        ];

    let quizStageId = null, writeOk = true;
    for (const stage of stagesToInsert) {
      const { data: insertedStage, error: insErr } = await db.from("lesson_stages").insert({ lesson_id: lessonSpec.id, school_id: SCHOOL_ID, ...stage }).select("id, content_type").single();
      if (insErr) { console.error(`  !! stage insert failed: ${insErr.message}`); writeOk = false; continue; }
      if (insertedStage.content_type === "quiz_qia") quizStageId = insertedStage.id;
    }
    if (quizStageId && parsed.quiz.questions?.length) {
      const rows = parsed.quiz.questions.map((q, qi) => ({ stage_id: quizStageId, school_id: SCHOOL_ID, position: qi, question_text: q.text, options: q.options, correct_option_index: q.correct_index, points: 1, time_per_question_seconds: 20 }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    }

    let materialsAttached = 0;
    try {
      const matResult = await attachBooksToLesson(db, { lessonId: lessonSpec.id, subjectName, teacherId: lessonSpec.subject?.teacher_id ?? null, maxBooks: 3 });
      materialsAttached = matResult.attached;
    } catch (e) { console.error(`  !! attachBooksToLesson failed: ${e.message}`); }

    log.done[lessonSpec.id] = true;
    saveLog(log);
    console.log(`${logPrefix} [${isFull ? "FULL" : "SIMPLE"}] → ${writeOk ? "OK" : "PARTIAL"}: "${topic}" (материалов: ${materialsAttached})`);
    done++;
  }
  console.log(`  Итог Фазы B: сгенерировано ${done}, ошибок ${errors}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА C — бэкфилл посещаемости + оценок за урок (Пачка 2.5: present 90% /
// absent_unexcused 8% / absent_excused 2%; grade 5=30% 4=40% 3=25% 2=5%) —
// pickAttStatus/pickGrade идентичны apps/web/app/api/cron/_lib/complete-
// lessons.ts. Гейт: ends_at < now() (по времени, не по статусу) И
// starts_at в [BACKFILL_START, BACKFILL_END] — сознательно НЕ трогает
// 27-28 июля (уже прошедшие к моменту запуска, но заполненные обычным
// ходом работы приложения, не этим скриптом).
// ═══════════════════════════════════════════════════════════════════════
function pickAttStatus(r) { if (r < 0.9) return "present"; if (r < 0.98) return "absent_unexcused"; return "absent_excused"; }
function pickGrade(r) { if (r < 0.3) return 5; if (r < 0.7) return 4; if (r < 0.95) return 3; return 2; }

async function phaseC_backfillAttendanceGrades() {
  console.log("\n[Фаза C] Бэкфилл посещаемости + оценок за урок…");
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }

  const rangeStartIso = `${BACKFILL_START}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${BACKFILL_END}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: pastLessons, error: plErr } = await db
    .from("lessons").select("id, group_id, starts_at, ends_at")
    .gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclIso).lt("ends_at", nowIso);
  if (plErr) throw new Error(`lessons: ${plErr.message}`);
  console.log(`  Прошедших уроков в ${BACKFILL_START}..${BACKFILL_END} (ends_at<now): ${pastLessons.length}`);
  if (pastLessons.length === 0) { console.log("  Нечего заполнять."); return; }

  const lessonIds = pastLessons.map((l) => l.id);
  const groupIds = [...new Set(pastLessons.map((l) => l.group_id))];
  const { data: sgRows } = await db.from("student_groups").select("group_id, student_id").in("group_id", groupIds);
  const studentIds = [...new Set((sgRows ?? []).map((r) => r.student_id))];
  const { data: studentRows } = await db.from("students").select("id, school_id").in("id", studentIds);
  const schoolByStudent = new Map((studentRows ?? []).map((s) => [s.id, s.school_id]));
  const studentsByGroup = new Map();
  for (const r of sgRows ?? []) { const a = studentsByGroup.get(r.group_id) ?? []; a.push(r.student_id); studentsByGroup.set(r.group_id, a); }
  const { data: groupRows } = await db.from("groups").select("id, teacher_id").in("id", groupIds);
  const teacherByGroup = new Map((groupRows ?? []).map((g) => [g.id, g.teacher_id]));

  const attByLesson = new Map(), lgByLesson = new Map();
  for (let i = 0; i < lessonIds.length; i += 200) {
    const chunk = lessonIds.slice(i, i + 200);
    const { data: aRows } = await db.from("attendance").select("lesson_id, student_id, status").in("lesson_id", chunk);
    for (const r of aRows ?? []) { if (!attByLesson.has(r.lesson_id)) attByLesson.set(r.lesson_id, new Map()); attByLesson.get(r.lesson_id).set(r.student_id, r.status); }
    const { data: lRows } = await db.from("lesson_grades").select("lesson_id, student_id").in("lesson_id", chunk);
    for (const r of lRows ?? []) { if (!lgByLesson.has(r.lesson_id)) lgByLesson.set(r.lesson_id, new Set()); lgByLesson.get(r.lesson_id).add(r.student_id); }
  }

  const attRows = [], gradeRows = [];
  let skippedNoTeacher = 0;
  for (const lesson of pastLessons) {
    const students = studentsByGroup.get(lesson.group_id) ?? [];
    const existing = attByLesson.get(lesson.id) ?? new Map();
    const presentStudents = [];
    for (const [sid, status] of existing) if (status === "present") presentStudents.push(sid);
    for (const sid of students) {
      if (existing.has(sid)) continue;
      const school = schoolByStudent.get(sid);
      if (!school) continue;
      const status = pickAttStatus(Math.random());
      attRows.push({ lesson_id: lesson.id, student_id: sid, status, school_id: school });
      if (status === "present") presentStudents.push(sid);
    }
    const teacherId = teacherByGroup.get(lesson.group_id);
    if (!teacherId) { skippedNoTeacher++; continue; }
    const alreadyGraded = lgByLesson.get(lesson.id) ?? new Set();
    for (const sid of presentStudents) {
      if (alreadyGraded.has(sid) || Math.random() >= 0.35) continue;
      const school = schoolByStudent.get(sid);
      if (!school) continue;
      gradeRows.push({ lesson_id: lesson.id, student_id: sid, grade: pickGrade(Math.random()), graded_by: teacherId, school_id: school });
    }
  }
  console.log(`  План: attendance +${attRows.length}, lesson_grades +${gradeRows.length}. Уроков без учителя (оценки пропущены): ${skippedNoTeacher}.`);
  if (DRY_RUN) { console.log("  [DRY-RUN] запись не выполнена."); return; }

  let attAdded = 0;
  for (let i = 0; i < attRows.length; i += 500) {
    const batch = attRows.slice(i, i + 500);
    const { error } = await db.from("attendance").upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: true });
    if (error) throw new Error(`attendance insert: ${error.message}`);
    attAdded += batch.length;
  }
  let lg = 0;
  for (let i = 0; i < gradeRows.length; i += 500) {
    const batch = gradeRows.slice(i, i + 500);
    const { error } = await db.from("lesson_grades").upsert(batch, { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
    if (error) throw new Error(`lesson_grades insert: ${error.message}`);
    lg += batch.length;
  }
  console.log(`  Итог Фазы C: attendance +${attAdded}, lesson_grades +${lg}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА D — ДЗ за прошлую неделю: (1) создать по одному homework на каждую
// пару (группа, предмет), реально преподанный на неделе BACKFILL_START..
// BACKFILL_END (due_date = последний день недели), (2) забэкфиллить сдачи
// тем же профилем, что backfill-homework.mjs (ДЗ вовремя 75% / поздно 15% /
// не сдал 10%; оценка 5=30%/4=40%/3=25%/2=5% — HOMEWORK_PROFILES/
// GRADE_PROFILES из _backfill-shared.mjs, идентично остальным бэкфиллам).
// ДОПУЩЕНИЕ (не в буквальной формулировке задачи, см. отчёт п.5): раз вся
// старая ДЗ 7-26 июля удаляется cleanup-скриптом по due_date∪created_at, и
// явного пункта "создать ДЗ" в задаче нет — но пункт "забэкфиллить... ДЗ"
// без единого существующего homework на неделе бэкфиллить нечего. Создаём
// минимальный набор (1 ДЗ на группу×предмет недели), чтобы было что
// бэкфиллить. Флагуется отдельно в отчёте — решение открыто для правки.
// ═══════════════════════════════════════════════════════════════════════
async function phaseD_backfillHomework() {
  console.log("\n[Фаза D] ДЗ за прошлую неделю (создание + бэкфилл сдач)…");
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }

  const rangeStartIso = `${BACKFILL_START}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${BACKFILL_END}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const dueDateIso = `${BACKFILL_END}T18:00:00${TZ_OFFSET}`; // конец последнего дня недели

  const { data: weekLessons, error: wlErr } = await db
    .from("lessons").select("group_id, subject_id, subject:subjects(name, teacher_id)")
    .gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclIso);
  if (wlErr) throw new Error(`week lessons: ${wlErr.message}`);

  const pairs = new Map(); // `${group_id}|${subject_id}` -> {group_id, subject_id, subjectName, teacherId}
  for (const l of weekLessons ?? []) {
    const key = `${l.group_id}|${l.subject_id}`;
    if (!pairs.has(key)) pairs.set(key, { group_id: l.group_id, subject_id: l.subject_id, subjectName: l.subject?.name, teacherId: l.subject?.teacher_id ?? null });
  }
  console.log(`  Пар (группа×предмет), преподанных на неделе: ${pairs.size}`);

  const { data: existingHw } = await db.from("homework")
    .select("id, group_id").gte("due_date", rangeStartIso).lt("due_date", new Date(new Date(dueDateIso).getTime() + 86400000).toISOString());
  const existingGroupIds = new Set((existingHw ?? []).map((h) => h.group_id));

  const toCreate = [...pairs.values()].filter((p) => !existingGroupIds.has(p.group_id) || true);
  // Идемпотентность на уровне (group_id,due_date) недостаточна — homework не
  // имеет unique-ограничения по (group_id,subject_id,due_date). Явная
  // проверка "уже есть homework этой группы с due_date в эту неделю И тем
  // же subject_id" — ниже, во избежание дублей при повторном запуске.
  const { data: existingHwFull } = await db.from("homework")
    .select("id, group_id, subject_id").gte("due_date", rangeStartIso).lt("due_date", new Date(new Date(dueDateIso).getTime() + 86400000).toISOString());
  const existingPairKeys = new Set((existingHwFull ?? []).map((h) => `${h.group_id}|${h.subject_id}`));

  const plan = [...pairs.values()].filter((p) => !existingPairKeys.has(`${p.group_id}|${p.subject_id}`));
  console.log(`  К созданию новых homework: ${plan.length} (пропущено — уже есть на эту неделю: ${pairs.size - plan.length}).`);

  if (DRY_RUN) { console.log("  [DRY-RUN] создание/бэкфилл не выполнены."); return; }

  const created = [];
  for (const p of plan) {
    const { data: hw, error } = await db.from("homework").insert({
      group_id: p.group_id, subject_id: p.subject_id, lesson_id: null,
      title: `Домашнее задание: ${p.subjectName ?? "предмет"}`,
      description: "Повторить материал урока и выполнить практическое задание.",
      due_date: dueDateIso, content_type: "file", source: "curriculum", school_id: SCHOOL_ID,
    }).select("id, group_id, due_date, created_at").single();
    if (error) { console.error(`  !! homework insert failed (${p.subjectName}): ${error.message}`); continue; }
    created.push({ ...hw, teacherId: p.teacherId });
  }
  console.log(`  Создано homework: ${created.length}`);

  // ── бэкфилл сдач (идентично backfill-homework.mjs) ──
  const groupIds = [...new Set(created.map((h) => h.group_id))];
  const { data: sgRows } = await db.from("student_groups").select("student_id, group_id").in("group_id", groupIds);
  const { data: students } = await db.from("students").select("id, username").in("id", (sgRows ?? []).map((r) => r.student_id));
  const usernameByStudent = new Map((students ?? []).map((s) => [s.id, s.username]));
  const studentsByGroup = new Map();
  for (const r of sgRows ?? []) { const a = studentsByGroup.get(r.group_id) ?? []; a.push(r.student_id); studentsByGroup.set(r.group_id, a); }

  const nowMs = Date.now();
  const submissionRows = [];
  for (const hw of created) {
    const studentIds = studentsByGroup.get(hw.group_id) ?? [];
    for (const studentId of studentIds) {
      const username = usernameByStudent.get(studentId);
      const profile = REAL_STUDENT_USERNAMES.includes(username) ? HOMEWORK_PROFILES[username] : DEMO_HOMEWORK_PROFILE;
      const outcome = weightedPick({ onTime: profile.onTime, late: profile.late, missed: profile.missed });
      if (outcome === "missed") continue;
      const windowStart = outcome === "onTime" ? hw.created_at : hw.due_date;
      const windowEnd = outcome === "onTime" ? hw.due_date : addMinutes(hw.due_date, 3 * 24 * 60);
      if (new Date(windowStart).getTime() > nowMs) continue; // окно ещё не наступило
      const cappedEnd = new Date(windowEnd).getTime() < nowMs ? windowEnd : new Date(nowMs).toISOString();
      submissionRows.push({
        homework_id: hw.id, student_id: studentId, answer_text: pick(HOMEWORK_SUBMISSION_TEXTS), file_url: null,
        status: "submitted", submitted_at: randomTimeBetween(windowStart, cappedEnd), school_id: SCHOOL_ID,
        is_demo: !REAL_STUDENT_USERNAMES.includes(username), _teacherId: hw.teacherId, _username: username,
      });
    }
  }
  console.log(`  Кандидатов на сдачу: ${submissionRows.length}`);

  const CHUNK = 500;
  let submittedCount = 0;
  const insertedIds = [];
  for (let i = 0; i < submissionRows.length; i += CHUNK) {
    const chunkRows = submissionRows.slice(i, i + CHUNK).map(({ _teacherId, _username, ...row }) => row);
    const { data, error } = await db.from("homework_submissions").upsert(chunkRows, { onConflict: "homework_id,student_id", ignoreDuplicates: true }).select("id, homework_id, student_id");
    if (error) { console.error(`  чанк сдачи упал: ${error.message}`); continue; }
    submittedCount += data?.length ?? 0;
    insertedIds.push(...(data ?? []));
  }
  console.log(`  homework_submissions вставлено: ${submittedCount}`);

  const teacherByPair = new Map(submissionRows.map((r) => [`${r.homework_id}:${r.student_id}`, { teacherId: r._teacherId, username: r._username }]));
  const toGrade = insertedIds.filter(() => Math.random() < 0.90);
  let gradedCount = 0;
  for (const row of toGrade) {
    const meta = teacherByPair.get(`${row.homework_id}:${row.student_id}`);
    if (!meta?.teacherId) continue;
    const profile = REAL_STUDENT_USERNAMES.includes(meta.username) ? GRADE_PROFILES[meta.username] : DEMO_GRADE_PROFILE;
    const grade = Number(weightedPick(profile));
    const comment = maybeComment(HOMEWORK_TEACHER_COMMENTS, 0.3) || null;
    const { data: subRow } = await db.from("homework_submissions").select("submitted_at").eq("id", row.id).single();
    if (!subRow) continue;
    const proposedGradedAt = addMinutes(subRow.submitted_at, randomInt(60, 48 * 60));
    const gradedAt = new Date(proposedGradedAt).getTime() > Date.now() ? new Date().toISOString() : proposedGradedAt;
    const { error: e1 } = await db.from("homework_submissions").update({ grade, status: "graded", teacher_comment: comment }).eq("id", row.id);
    if (e1) continue;
    const { error: e2 } = await db.from("homework_submissions").update({ graded_by: meta.teacherId, graded_at: gradedAt }).eq("id", row.id);
    if (e2) continue;
    gradedCount++;
  }
  console.log(`  Итог Фазы D: homework создано ${created.length}, сдач ${submittedCount}, проверено ${gradedCount}.`);
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  await phaseA_insertLessons();
  await phaseB_generateContent();
  await phaseC_backfillAttendanceGrades();
  await phaseD_backfillHomework();
  console.log("\n" + "═".repeat(74));
  console.log(`ГОТОВО за ${((Date.now() - startedAt) / 1000).toFixed(1)}с. Режим: ${DRY_RUN ? "DRY-RUN — БД не менялась" : "БОЕВОЙ"}.`);
  console.log("═".repeat(74));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
