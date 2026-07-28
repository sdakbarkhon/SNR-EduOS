#!/usr/bin/env node
// Очистка БД 7-26 июля — ЗАХОД 2 (финальные правки): регенерация и
// пополнение пробелов 27 июля - 2 августа 2026. Переименован из
// regenerate-jul20-aug2.mjs — предыдущая версия покрывала 20 июля-2
// августа; финальная граница пользователя оставляет 20-26 июля ПОД
// ПОЛНОЕ удаление (регенерируется отдельно, не этим файлом — 20-26 больше
// НЕ в скоупе регенерации), а 27-31 июля СОХРАНЯЕТСЯ как есть (уроки уже
// созданы и наполнены AI-этапами вручную в предыдущих заходах — не
// теряем эту работу) и только ДОПОЛНЯЕТСЯ там, где пусто.
// Написан и закоммичен, НЕ запускался на проде. Запускает менеджер
// вручную (dry-run сначала), ПОСЛЕ cleanup-jul7-jul26.mjs --confirm.
//
// ЖИВАЯ РАЗВЕДКА ЭТОЙ СЕССИИ (числа на момент написания, до чистки):
//   - 27-31 июля: 90 уроков (18/день = 5+6+7 по трём группам), ВСЕ 90 уже
//     имеют middle-этапы (AI-контент). lesson_materials: 195 строк.
//   - 1-2 августа: 0 уроков — создаются с нуля этим скриптом.
//   - attendance за неделю: 70 строк (частично, не пусто и не полно).
//   - lesson_grades за неделю: 26 строк (частично).
//   - homework на неделе: 18 строк, но только 5 из 15 пар группа×предмет
//     покрыты — 10 пар БЕЗ homework вообще.
//   - homework_submissions/test_submissions для этих 18: 80 + 50 = 130.
//   - chat_messages за неделю: 1 (не 0 — см. Фазу H про это расхождение).
//   - announcements за неделю: 0.
//   - direct-тредов (учитель↔ученик) в системе: 180.
//
// СТРУКТУРА РАСПИСАНИЯ (источник истины — apps/web/scripts/create-lesson-
// slots-jul18-31.mjs, подтверждена действующей на 27-31 июля живым
// запросом): 7 слотов по 45 мин с 09:00 Ташкент (04:00 UTC), 10-мин
// перемены. 3-А класс — 5 уроков/день, 7-А — 6/день, 10-А — 7/день.
// Кабинет — всем урокам "Кабинет 101".
//
// ПРАВИЛО СЕССИИ: без выходных — ВСЕ дни недели полный слот (5/6/7).
//
// РОТАЦИЯ ПРЕДМЕТОВ: детерминированный (seeded) шаффл — повторный запуск
// без изменений входа даёт тот же план (важно для dry-run→--confirm
// согласованности). Реально сработает только для 1-2 августа — на 27-31
// уроки уже есть, Фаза A их не тронет (идемпотентность по group_id+
// starts_at), какой бы план ротация ни предложила для этих дат.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/regenerate-jul27-aug2.mjs --dry-run
//   node --env-file=.env.local scripts/regenerate-jul27-aug2.mjs --confirm
//   node --env-file=.env.local scripts/regenerate-jul27-aug2.mjs --confirm --limit-per-run=15
//   node --env-file=.env.local scripts/regenerate-jul27-aug2.mjs --confirm --skip-lessons --skip-content --skip-materials   (только D-H)
//
// Аргументы:
//   --confirm                обязателен для боевого запуска; без него — dry-run
//   --start-date/--end-date  диапазон уроков A/B/C (default 2026-07-27/2026-08-02)
//   --backfill-start/--backfill-end  диапазон D/E/F/H (default 2026-07-27/2026-07-28 — "прошедшее относительно сегодня")
//   --limit-per-run=N        максимум Gemini-генераций за один запуск (default 40)
//   --skip-lessons             пропустить Фазу A
//   --skip-content              пропустить Фазу B
//   --skip-materials             пропустить Фазу C
//   --skip-backfill                пропустить Фазы D/E/F/G/H целиком

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  attachBooksToLesson, SCHOOL_ID, REAL_STUDENT_USERNAMES,
  HOMEWORK_PROFILES, DEMO_HOMEWORK_PROFILE, GRADE_PROFILES, DEMO_GRADE_PROFILE,
  weightedPick, randomInt, randomTimeBetween, addMinutes, pick,
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
const SKIP_MATERIALS = flag("skip-materials");
const SKIP_BACKFILL = flag("skip-backfill");

const START_DATE = opt("start-date", "2026-07-27");
const END_DATE = opt("end-date", "2026-08-02"); // inclusive
const BACKFILL_START = opt("backfill-start", "2026-07-27");
const BACKFILL_END = opt("backfill-end", "2026-07-28"); // inclusive — "прошедшее относительно сегодня"
const TZ_OFFSET = "+05:00";
const BF_START_ISO = `${BACKFILL_START}T00:00:00${TZ_OFFSET}`;
const BF_END_EXCL_ISO = new Date(new Date(`${BACKFILL_END}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(74));
console.log(`Регенерация уроков ${START_DATE}..${END_DATE} + пополнение пробелов ${BACKFILL_START}..${BACKFILL_END}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем, Gemini не вызываем)" : "БОЕВОЙ (--confirm)"}`);
console.log(`Фазы: A(уроки)=${!SKIP_LESSONS} B(AI-контент)=${!SKIP_CONTENT} C(материалы БЗ)=${!SKIP_MATERIALS} D-H(бэкфилл)=${!SKIP_BACKFILL} · limit-per-run=${LIMIT_PER_RUN}`);
console.log("═".repeat(74));

// ── общие пагинированные helpers (см. cleanup-jul7-jul26.mjs — тот же
//    найденный в этой сессии баг: PostgREST по умолчанию режет ЛЮБОЙ
//    .select(), возвращающий строки, на 1000 без .range(), даже если
//    .in()-фильтр применён к маленькому чанку id. Здесь риск ниже (недельные
//    диапазоны, не 20-дневные), но пагинация применена везде, где чтение
//    потенциально не ограничено маленьким known-small диапазоном.) ────────
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
async function selectAllIn(table, col, ids, selectCol, extraFilter) {
  if (ids.length === 0) return [];
  let out = [];
  for (const c of chunk(ids, 300)) {
    let from = 0;
    for (;;) {
      let q = db.from(table).select(selectCol).in(col, c).range(from, from + 999);
      if (extraFilter) q = extraFilter(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table}.${col} select failed: ${error.message}`);
      out = out.concat(data ?? []);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }
  return out;
}

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

// ── детерминированный PRNG (mulberry32) — тот же паттерн, что был в
//    regenerate-jul20-aug2.mjs (сохранён без изменений). ─────────────────
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
  const extra = [P, R].filter((_, i) => n - 5 > i);
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
// ФАЗА A — insert уроков. Идемпотентно по (group_id, starts_at) — 27-31
// июля УЖЕ существуют, поэтому этот шаг их НЕ ТРОГАЕТ (пропускает), реально
// создаёт только недостающие слоты (на практике — только 1-2 августа).
// ═══════════════════════════════════════════════════════════════════════
async function phaseA_insertLessons() {
  console.log("\n[Фаза A] Создание уроков (27 июля-31 не трогаем — уже есть; довставляем недостающее)…");
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
  // Нормализуем ОБЕ стороны через Date().toISOString() — PostgREST отдаёт
  // "...+00:00", new Date(...).toISOString() даёт "...Z"; без нормализации
  // сравнение никогда не матчит (найдено и исправлено в этой же сессии).
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
    // Старт/Итог (position 0/9999) НЕ вставляем вручную — БД-триггер
    // trg_lesson_default_stages/fn_create_default_stages() (миграция 35)
    // сам создаёт их AFTER INSERT ON lessons. Найдено адверсариальной
    // проверкой этой сессии: ручной scaffold-insert здесь гарантированно
    // упал бы на UNIQUE(lesson_id, position) на КАЖДОМ созданном уроке
    // (live-подтверждено: lesson_stages с position∈{0,9999} = 2×lessons
    // ровно, без единого исключения) — тот же (безвредный по данным, но
    // портящий отчётность "ошибок") паттерн, что и в устаревших
    // create-lesson-slots-jul18-31.mjs/generate-lessons-jul19-25.mjs.
    // 20260707000070_three_grade_demo_students.sql — пример в этом же
    // репозитории, который уже НЕ делает ручной scaffold по этой причине.
    const { error: insErr } = await db.from("lessons").insert({
      group_id: groupId, subject_id: subjectId, school_id: SCHOOL_ID,
      starts_at: startsAt, ends_at: endsAt, status: "scheduled",
      topic: slot.subject, title: slot.subject, duration_minutes: 45, room: ROOM,
    });
    if (insErr) { console.error(`${logPrefix} → ERROR (${insErr.message})`); errors++; continue; }

    existingKeys.add(key);
    created++;
  }
  console.log(`  Итог Фазы A: создано ${created}, пропущено (уже было) ${skipped}, ошибок ${errors}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА B — AI-генерация этапов для пустых уроков диапазона. Для 27-31 июля
// это НИЧЕГО не найдёт (90/90 уже заполнены живым запросом) — сработает
// только для новых уроков 1-2 августа.
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
const LOG_PATH = path.resolve(process.cwd(), "scripts/.lessons-progress-jul27-aug2.json");
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

  const lessonIdsInRange = allLessons.map((l) => l.id);
  const middleStageRows = await selectAllIn("lesson_stages", "lesson_id", lessonIdsInRange, "lesson_id", (q) => q.eq("stage_role", "middle"));
  const hasMiddle = new Set(middleStageRows.map((r) => r.lesson_id));
  const emptyLessons = (allLessons ?? []).filter((l) => !hasMiddle.has(l.id));
  console.log(`  Пусто в диапазоне: ${emptyLessons.length} из ${allLessons.length} (27-31 июля должны быть уже заполнены и сюда не попасть).`);

  const filledIds = [...hasMiddle];
  const filledWithStages = await selectAllIn("lessons", "id", filledIds, "id, topic, group:groups(name), subject:subjects(name)");
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
    catch { console.error(`${logPrefix} → ERROR (JSON parse)`); log.done[lessonSpec.id] = true; saveLog(log); errors++; continue; }

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

    log.done[lessonSpec.id] = true;
    saveLog(log);
    console.log(`${logPrefix} [${isFull ? "FULL" : "SIMPLE"}] → ${writeOk ? "OK" : "PARTIAL"}: "${topic}"`);
    done++;
  }
  console.log(`  Итог Фазы B: сгенерировано ${done}, ошибок ${errors}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА C — материалы из БЗ. Отдельная явная фаза (раньше это было побочным
// эффектом Фазы B только для НОВОсгенерированных уроков) — теперь проходит
// по ВСЕМ урокам диапазона, включая уже заполненные 27-31 июля, у которых
// может не быть материалов (живой счёт: 195 материалов на 90 уроков — не
// у каждого). attachBooksToLesson САМ идемпотентен (пропускает урок, если
// у него уже есть хоть один kb_bucket='books' материал).
// ═══════════════════════════════════════════════════════════════════════
async function phaseC_attachMaterials() {
  console.log("\n[Фаза C] Материалы из БЗ для уроков без материалов…");
  if (SKIP_MATERIALS) { console.log("  --skip-materials — пропуск."); return; }

  const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const { data: lessons, error } = await db
    .from("lessons").select("id, subject:subjects(name, teacher_id)")
    .gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclIso);
  if (error) throw new Error(`lessons for materials: ${error.message}`);

  if (DRY_RUN) {
    // Dry-run: посчитать, у скольких уроков ВООБЩЕ нет kb_bucket='books' материала (без реального вызова attachBooksToLesson).
    const lessonIds = lessons.map((l) => l.id);
    const withMaterials = await selectAllIn("lesson_materials", "lesson_id", lessonIds, "lesson_id", (q) => q.eq("kb_bucket", "books"));
    const haveSet = new Set(withMaterials.map((r) => r.lesson_id));
    const missing = lessons.filter((l) => !haveSet.has(l.id));
    console.log(`  Уроков без материалов из БЗ: ${missing.length} из ${lessons.length}.`);
    console.log(`  [DRY-RUN] attachBooksToLesson не вызывается.`);
    return;
  }

  let attached = 0, skipped = 0, noMapping = 0;
  for (const l of lessons) {
    const subjectName = l.subject?.name;
    const res = await attachBooksToLesson(db, { lessonId: l.id, subjectName, teacherId: l.subject?.teacher_id ?? null, maxBooks: 3 });
    if (res.reason === "already_has_materials") skipped++;
    else if (res.reason === "no_slug_mapping" || res.reason === "no_books_for_subject") noMapping++;
    else attached += res.attached;
  }
  console.log(`  Итог Фазы C: материалы добавлены ${attached}, уже были ${skipped}, нет БЗ для предмета ${noMapping}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА D — посещаемость для 27-28 июля (ends_at<now). Gap-fill по паре
// (lesson,student) — существующие 70 строк не трогаем, добавляем только
// недостающие пары. 90% present / 8% absent_unexcused / 2% absent_excused
// ("sick" из задачи — в схеме это absent_excused, тот же маппинг, что и в
// прошлых заходах этого проекта).
// ═══════════════════════════════════════════════════════════════════════
function pickAttStatus(r) { if (r < 0.9) return "present"; if (r < 0.98) return "absent_unexcused"; return "absent_excused"; }
function pickGrade(r) { if (r < 0.3) return 5; if (r < 0.7) return 4; if (r < 0.95) return 3; return 2; }

async function loadPastLessonsAndRoster() {
  const { data: pastLessons, error: plErr } = await db
    .from("lessons").select("id, group_id, starts_at, ends_at")
    .gte("starts_at", BF_START_ISO).lt("starts_at", BF_END_EXCL_ISO).lt("ends_at", new Date().toISOString());
  if (plErr) throw new Error(`lessons: ${plErr.message}`);
  if (pastLessons.length === 0) return null;

  const lessonIds = pastLessons.map((l) => l.id);
  const groupIds = [...new Set(pastLessons.map((l) => l.group_id))];
  const sgRows = await selectAllIn("student_groups", "group_id", groupIds, "group_id, student_id");
  const studentIds = [...new Set(sgRows.map((r) => r.student_id))];
  const studentRows = await selectAllIn("students", "id", studentIds, "id, school_id");
  const schoolByStudent = new Map(studentRows.map((s) => [s.id, s.school_id]));
  const studentsByGroup = new Map();
  for (const r of sgRows) { const a = studentsByGroup.get(r.group_id) ?? []; a.push(r.student_id); studentsByGroup.set(r.group_id, a); }
  const { data: groupRows } = await db.from("groups").select("id, teacher_id").in("id", groupIds);
  const teacherByGroup = new Map((groupRows ?? []).map((g) => [g.id, g.teacher_id]));

  const existAtt = await selectAllIn("attendance", "lesson_id", lessonIds, "lesson_id, student_id, status");
  const attByLesson = new Map();
  for (const r of existAtt) { if (!attByLesson.has(r.lesson_id)) attByLesson.set(r.lesson_id, new Map()); attByLesson.get(r.lesson_id).set(r.student_id, r.status); }
  const existLg = await selectAllIn("lesson_grades", "lesson_id", lessonIds, "lesson_id, student_id");
  const lgByLesson = new Map();
  for (const r of existLg) { if (!lgByLesson.has(r.lesson_id)) lgByLesson.set(r.lesson_id, new Set()); lgByLesson.get(r.lesson_id).add(r.student_id); }

  return { pastLessons, studentsByGroup, schoolByStudent, teacherByGroup, attByLesson, lgByLesson };
}

async function phaseD_backfillAttendance(ctx) {
  console.log(`\n[Фаза D] Посещаемость для ${BACKFILL_START}..${BACKFILL_END} (ends_at<now, gap-fill)…`);
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return ctx; }
  if (!ctx) { console.log("  Прошедших уроков в диапазоне нет — нечего заполнять."); return ctx; }

  const { pastLessons, studentsByGroup, schoolByStudent, attByLesson } = ctx;
  console.log(`  Прошедших уроков: ${pastLessons.length}`);
  const attRows = [];
  for (const lesson of pastLessons) {
    const students = studentsByGroup.get(lesson.group_id) ?? [];
    // ?? new Map() создаёт НОВЫЙ Map, если урок раньше не имел ни одной
    // отметки — если его не положить обратно в attByLesson, Фаза E ниже
    // (которая делит тот же ctx) снова получит undefined и увидит 0
    // присутствовавших для этого урока, хотя Фаза D секундой раньше
    // реально записала их в БД (найдено адверсариальной проверкой этой
    // сессии, live-подтверждено: 29 из 36 уроков диапазона стартовали без
    // единой отметки — баг задевал бы именно их).
    let existing = attByLesson.get(lesson.id);
    if (!existing) { existing = new Map(); attByLesson.set(lesson.id, existing); }
    for (const sid of students) {
      if (existing.has(sid)) continue;
      const school = schoolByStudent.get(sid);
      if (!school) continue;
      const status = pickAttStatus(Math.random());
      attRows.push({ lesson_id: lesson.id, student_id: sid, status, school_id: school });
      existing.set(sid, status); // отражаем в контексте для Фазы E (present-набор)
    }
  }
  console.log(`  План: attendance +${attRows.length} (недостающие пары урок×ученик).`);
  if (DRY_RUN) { console.log("  [DRY-RUN] запись не выполнена."); return ctx; }

  let attAdded = 0;
  for (let i = 0; i < attRows.length; i += 500) {
    const batch = attRows.slice(i, i + 500);
    const { error } = await db.from("attendance").upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: true });
    if (error) throw new Error(`attendance insert: ${error.message}`);
    attAdded += batch.length;
  }
  console.log(`  Итог Фазы D: attendance +${attAdded}.`);
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА E — оценки для 27-28 июля. Gap-fill по (lesson,student) среди
// ПРИСУТСТВОВАВШИХ (учитывая и уже существовавшие, и только что добавленные
// Фазой D present-отметки), ~60% присутствовавших без уже существующей
// оценки получают новую (явно другое число, чем "35%" из прошлых заходов —
// пользователь в этой задаче явно указал ~60%). Распределение 5=30/4=40/
// 3=25/2=5 — то же самое, что везде в проекте (pickGrade выше).
// ═══════════════════════════════════════════════════════════════════════
async function phaseE_backfillGrades(ctx) {
  console.log(`\n[Фаза E] Оценки для ${BACKFILL_START}..${BACKFILL_END} (ends_at<now, ~60% присутствовавших, gap-fill)…`);
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }
  if (!ctx) { console.log("  Прошедших уроков в диапазоне нет — нечего заполнять."); return; }

  const { pastLessons, teacherByGroup, attByLesson, lgByLesson } = ctx;
  const gradeRows = [];
  let skippedNoTeacher = 0;
  for (const lesson of pastLessons) {
    const teacherId = teacherByGroup.get(lesson.group_id);
    if (!teacherId) { skippedNoTeacher++; continue; }
    const existing = attByLesson.get(lesson.id) ?? new Map();
    const presentStudents = [...existing.entries()].filter(([, status]) => status === "present").map(([sid]) => sid);
    const alreadyGraded = lgByLesson.get(lesson.id) ?? new Set();
    for (const sid of presentStudents) {
      if (alreadyGraded.has(sid) || Math.random() >= 0.60) continue;
      gradeRows.push({ lesson_id: lesson.id, student_id: sid, grade: pickGrade(Math.random()), graded_by: teacherId });
    }
  }
  // school_id — из students (не из ctx.schoolByStudent, чтобы не тащить лишний параметр — переиспользуем).
  const studentIds = [...new Set(gradeRows.map((r) => r.student_id))];
  const schoolByStudent = ctx.schoolByStudent;
  for (const r of gradeRows) r.school_id = schoolByStudent.get(r.student_id);
  const missingSchool = gradeRows.filter((r) => !r.school_id).length;

  console.log(`  План: lesson_grades +${gradeRows.length - missingSchool} (уроков без учителя, оценки пропущены: ${skippedNoTeacher}).`);
  if (DRY_RUN) { console.log("  [DRY-RUN] запись не выполнена."); return; }

  let lg = 0;
  const rowsToInsert = gradeRows.filter((r) => r.school_id);
  for (let i = 0; i < rowsToInsert.length; i += 500) {
    const batch = rowsToInsert.slice(i, i + 500);
    const { error } = await db.from("lesson_grades").upsert(batch, { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
    if (error) throw new Error(`lesson_grades insert: ${error.message}`);
    lg += batch.length;
  }
  console.log(`  Итог Фазы E: lesson_grades +${lg}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА F — домашние задания. (1) каждая пара группа×предмет, преподанная на
// неделе 27 июля-2 августа, должна иметь ≥1 homework — недостающим парам
// создаём по одному (content_type='file', due_date=конец недели/чуть
// позже). (2) для ДЗ этой недели генерируем сдачи (75% вовремя/15%
// поздно/10% не сдал) — ветвление по content_type: 'test' → test_
// submissions (счёт по количеству вопросов), остальные исполняемые типы
// ('file'/'programming'/'bundle') → homework_submissions; "внешние сервисы"
// (geogebra/wokwi/learningapps/codesandbox/desmos/...) НЕ сдаются в системе
// вообще (подтверждено паттерном reset-homework-generate-new.mjs) — пропускаем.
//
// ОКНО СДАЧИ: вместо буквального "created_at < now()-1 день" из задачи
// используется window(created_at→due_date для onTime, due_date→due_date+3д
// для late), капается на now(), пропуск если окно ещё не наступило — тот же
// проверенный паттерн, что backfill-homework.mjs. Причина отклонения от
// буквального гейта: у НОВОсозданных этой же фазой заданий created_at=now(),
// буквальный "< now()-1день" исключил бы их из сдач вообще, хотя цель явно
// была дать неделе сдачи, а не оставить их пустыми.
// ═══════════════════════════════════════════════════════════════════════
const SUBMITTABLE_TYPES = new Set(["file", "programming", "bundle"]);

async function phaseF_homework() {
  console.log("\n[Фаза F] Домашние задания — пары без ДЗ + сдачи за неделю…");
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }

  const weekStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const weekEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const dueDateIso = `${END_DATE}T20:00:00${TZ_OFFSET}`;

  const { data: weekLessons, error: wlErr } = await db
    .from("lessons").select("group_id, subject_id, subject:subjects(name, teacher_id)")
    .gte("starts_at", weekStartIso).lt("starts_at", weekEndExclIso);
  if (wlErr) throw new Error(`week lessons: ${wlErr.message}`);
  const pairs = new Map();
  for (const l of weekLessons ?? []) {
    const key = `${l.group_id}|${l.subject_id}`;
    if (!pairs.has(key)) pairs.set(key, { group_id: l.group_id, subject_id: l.subject_id, subjectName: l.subject?.name, teacherId: l.subject?.teacher_id ?? null });
  }
  console.log(`  Пар (группа×предмет), преподанных на неделе: ${pairs.size}`);

  const { data: existingHwFull } = await db.from("homework")
    .select("id, group_id, subject_id, content_type, due_date, created_at")
    .or(`and(due_date.gte.${weekStartIso},due_date.lt.${weekEndExclIso}),and(created_at.gte.${weekStartIso},created_at.lt.${weekEndExclIso})`);
  const existingPairKeys = new Set((existingHwFull ?? []).map((h) => `${h.group_id}|${h.subject_id}`));
  const plan = [...pairs.values()].filter((p) => !existingPairKeys.has(`${p.group_id}|${p.subject_id}`));
  console.log(`  К созданию новых homework (пары без единого ДЗ на неделе): ${plan.length} (уже покрыто: ${pairs.size - plan.length}).`);

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Создание/сдачи не выполнены.`);
    // Оценка объёма сдач без реальных вставок — по существующим + плановым homework.
    const allWeekHw = [...(existingHwFull ?? [])];
    const byType = {};
    for (const h of allWeekHw) byType[h.content_type] = (byType[h.content_type] ?? 0) + 1;
    console.log(`  Существующее ДЗ на неделе по типам: ${JSON.stringify(byType)}`);
    console.log(`  Новых ДЗ (все content_type='file'): ${plan.length}`);
    return;
  }

  const created = [];
  for (const p of plan) {
    // teacher_id обязателен для консистентности с остальным проектом
    // (найдено адверсариальной проверкой этой сессии) — без него
    // fn_homework_submission_notify() не найдёт учителя (JOIN teachers ON
    // t.id=h.teacher_id пуст) и не пришлёт уведомление о сдаче, а RLS
    // "teacher updates/deletes own homework" (фильтр по teacher_id) не
    // даст реальному учителю отредактировать/удалить это задание.
    const { data: hw, error } = await db.from("homework").insert({
      group_id: p.group_id, subject_id: p.subject_id, lesson_id: null, teacher_id: p.teacherId,
      title: `Домашнее задание: ${p.subjectName ?? "предмет"}`,
      description: "Повторить материал урока и выполнить практическое задание.",
      due_date: dueDateIso, content_type: "file", source: "curriculum", school_id: SCHOOL_ID,
    }).select("id, group_id, subject_id, content_type, due_date, created_at").single();
    if (error) { console.error(`  !! homework insert failed (${p.subjectName}): ${error.message}`); continue; }
    created.push({ ...hw, teacherId: p.teacherId });
  }
  console.log(`  Создано homework: ${created.length}`);

  const allWeekHw = [...(existingHwFull ?? []), ...created.map((h) => ({ ...h, teacherId: h.teacherId }))];
  const teacherByHwId = new Map();
  for (const p of pairs.values()) teacherByHwId.set(`${p.group_id}|${p.subject_id}`, p.teacherId);

  const submittable = allWeekHw.filter((h) => SUBMITTABLE_TYPES.has(h.content_type) || h.content_type === "test");
  const externalCount = allWeekHw.length - submittable.length;
  console.log(`  ДЗ этой недели: ${allWeekHw.length} (сдаваемых: ${submittable.length}, внешних сервисов — не сдаются: ${externalCount})`);

  const groupIds = [...new Set(allWeekHw.map((h) => h.group_id))];
  const sgRows = await selectAllIn("student_groups", "group_id", groupIds, "student_id, group_id");
  const { data: students } = await db.from("students").select("id, username, school_id").in("id", [...new Set(sgRows.map((r) => r.student_id))]);
  const usernameByStudent = new Map((students ?? []).map((s) => [s.id, s.username]));
  const schoolByStudentForTest = new Map((students ?? []).map((s) => [s.id, s.school_id]));
  const studentsByGroup = new Map();
  for (const r of sgRows) { const a = studentsByGroup.get(r.group_id) ?? []; a.push(r.student_id); studentsByGroup.set(r.group_id, a); }

  const nowMs = Date.now();
  const fileSubmissionRows = [];
  const testSubmissionPlans = []; // { homework_id, student_id, submitted_at, school_id, gradeStr }
  for (const hw of submittable) {
    const teacherId = teacherByHwId.get(`${hw.group_id}|${hw.subject_id}`) ?? null;
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
      const submittedAt = randomTimeBetween(windowStart, cappedEnd);

      if (hw.content_type === "test") {
        const gradeProfile = REAL_STUDENT_USERNAMES.includes(username) ? GRADE_PROFILES[username] : DEMO_GRADE_PROFILE;
        testSubmissionPlans.push({ homework_id: hw.id, student_id: studentId, submitted_at: submittedAt, gradeStr: weightedPick(gradeProfile), _teacherId: teacherId, _username: username });
      } else {
        // is_demo: колонка НЕ существует на homework_submissions — добавлена
        // миграцией 110, удалена миграцией 132 (найдено адверсариальной
        // проверкой этой сессии живым запросом к схеме; писать её сюда
        // означало бы 42703 на КАЖДОМ upsert-чанке ниже — молча
        // проглатывается catch-логом, ноль сдач file/programming/bundle
        // создалось бы никогда).
        // school_id NOT NULL (миграция 71) — под service-role DEFAULT
        // current_school_id() резолвится в NULL (нет auth.uid()); без явного
        // значения каждая вставка упала бы с NOT NULL violation (найдено
        // самопроверкой сразу вслед за фиксом is_demo выше — тот же класс
        // ошибки, до которого дошли бы следующим).
        fileSubmissionRows.push({
          homework_id: hw.id, student_id: studentId, answer_text: "Готово, задание выполнено.", file_url: null,
          status: "submitted", submitted_at: submittedAt, school_id: schoolByStudentForTest.get(studentId) ?? SCHOOL_ID,
          _teacherId: teacherId, _username: username,
        });
      }
    }
  }
  console.log(`  Кандидатов на сдачу: file/programming/bundle=${fileSubmissionRows.length}, test=${testSubmissionPlans.length}`);

  // ── homework_submissions (file/programming/bundle) — та же логика, что backfill-homework.mjs ──
  let fileSubmitted = 0;
  const insertedFileIds = [];
  for (let i = 0; i < fileSubmissionRows.length; i += 500) {
    const chunkRows = fileSubmissionRows.slice(i, i + 500).map(({ _teacherId, _username, ...row }) => row);
    const { data, error } = await db.from("homework_submissions").upsert(chunkRows, { onConflict: "homework_id,student_id", ignoreDuplicates: true }).select("id, homework_id, student_id");
    if (error) { console.error(`  чанк file-сдачи упал: ${error.message}`); continue; }
    fileSubmitted += data?.length ?? 0;
    insertedFileIds.push(...(data ?? []));
  }
  const teacherByPair = new Map(fileSubmissionRows.map((r) => [`${r.homework_id}:${r.student_id}`, { teacherId: r._teacherId, username: r._username }]));
  let fileGraded = 0;
  for (const row of insertedFileIds) {
    if (Math.random() >= 0.90) continue;
    const meta = teacherByPair.get(`${row.homework_id}:${row.student_id}`);
    if (!meta?.teacherId) continue;
    const profile = REAL_STUDENT_USERNAMES.includes(meta.username) ? GRADE_PROFILES[meta.username] : DEMO_GRADE_PROFILE;
    const grade = Number(weightedPick(profile));
    const { data: subRow } = await db.from("homework_submissions").select("submitted_at").eq("id", row.id).single();
    if (!subRow) continue;
    const proposedGradedAt = addMinutes(subRow.submitted_at, randomInt(60, 48 * 60));
    const gradedAt = new Date(proposedGradedAt).getTime() > Date.now() ? new Date().toISOString() : proposedGradedAt;
    const { error: e1 } = await db.from("homework_submissions").update({ grade, status: "graded" }).eq("id", row.id);
    if (e1) continue;
    const { error: e2 } = await db.from("homework_submissions").update({ graded_by: meta.teacherId, graded_at: gradedAt }).eq("id", row.id);
    if (e2) continue;
    fileGraded++;
  }

  // ── test_submissions (score/max_score из числа вопросов теста) ──
  const testHwIds = [...new Set(testSubmissionPlans.map((p) => p.homework_id))];
  const questionCountByHw = new Map();
  if (testHwIds.length) {
    const qRows = await selectAllIn("test_questions", "homework_id", testHwIds, "homework_id");
    for (const r of qRows) questionCountByHw.set(r.homework_id, (questionCountByHw.get(r.homework_id) ?? 0) + 1);
  }
  // school_id — homework_submissions.school_id тоже NOT NULL под service-role
  // (DEFAULT current_school_id() резолвится в NULL без auth.uid()); те же
  // NOT NULL live-подтверждены на test_submissions.school_id/grade/graded_at
  // (найдено адверсариальной проверкой этой сессии, сверено с
  // reset-homework-generate-new.mjs — тот же паттерн вставки).
  const GRADE_TO_FRACTION = { 5: 1.0, 4: 0.8, 3: 0.6, 2: 0.4 };
  const testRows = testSubmissionPlans.map((p) => {
    const qCount = questionCountByHw.get(p.homework_id) ?? 0;
    const gradeNum = Number(p.gradeStr);
    const fraction = GRADE_TO_FRACTION[gradeNum] ?? 0.6;
    return {
      homework_id: p.homework_id, student_id: p.student_id, submitted_at: p.submitted_at, started_at: p.submitted_at,
      score: Math.round(fraction * qCount), max_score: qCount, grade: gradeNum, graded_at: p.submitted_at,
      school_id: schoolByStudentForTest.get(p.student_id) ?? SCHOOL_ID,
    };
  });
  let testSubmitted = 0;
  for (let i = 0; i < testRows.length; i += 500) {
    const batch = testRows.slice(i, i + 500);
    const { data, error } = await db.from("test_submissions").upsert(batch, { onConflict: "homework_id,student_id", ignoreDuplicates: true }).select("id");
    if (error) { console.error(`  чанк test-сдачи упал: ${error.message}`); continue; }
    testSubmitted += data?.length ?? 0;
  }

  console.log(`  Итог Фазы F: homework создано ${created.length}; сдач file/programming/bundle=${fileSubmitted} (проверено ${fileGraded}), test_submissions=${testSubmitted}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА G — объявления. Если за неделю 0 — добавить 1-2 общешкольных.
// Шаблоны — те же, что backfill-announcements.mjs (проверенная форма).
// ═══════════════════════════════════════════════════════════════════════
const SCHOOL_TEMPLATES = [
  "Внимание! Завтра в 8:00 общее собрание в актовом зале",
  "Родительское собрание переносится на пятницу",
  "Не забудьте про экскурсию в понедельник",
  "Открыта запись в кружки на новый семестр",
  "Библиотека работает до 17:00 всю неделю",
  "Уважаемые родители, напоминаем: до конца недели необходимо сдать документы для оформления пропусков",
  "Уважаемые родители, напоминаем о плановой генеральной уборке классов в субботу — просьба одеть детей по погоде",
];

async function phaseG_announcements() {
  console.log("\n[Фаза G] Объявления за неделю…");
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }

  const weekStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const weekEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const { count, error } = await db.from("announcements").select("*", { count: "exact", head: true }).gte("created_at", weekStartIso).lt("created_at", weekEndExclIso);
  if (error) throw new Error(`announcements count: ${error.message}`);
  console.log(`  announcements за неделю сейчас: ${count ?? 0}.`);
  if ((count ?? 0) > 0) { console.log("  Уже не пусто — пропуск (правило: добавляем только если пусто)."); return; }

  const { data: adminRow, error: adminErr } = await db.from("admins").select("id").limit(1).maybeSingle();
  if (adminErr) throw new Error(`admins: ${adminErr.message}`);
  if (!adminRow) { console.warn("  Нет ни одной строки admins — не могу создать школьное объявление (admin_id обязателен)."); return; }

  const n = 1 + (Math.random() < 0.5 ? 1 : 0); // 1 или 2
  const chosen = [...SCHOOL_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, n);
  console.log(`  План: ${n} школьных объявлений.`);
  if (DRY_RUN) { console.log("  [DRY-RUN] вставка не выполнена."); return; }

  const now = new Date();
  const rows = chosen.map((text, i) => ({
    scope: "all_my_groups", created_by: null, admin_id: adminRow.id, group_id: null, target_student_id: null,
    title: text.length > 60 ? text.slice(0, 57) + "..." : text, body: text, is_pinned: false, category: "general",
    is_ticker: false, school_id: SCHOOL_ID,
    created_at: new Date(now.getTime() - i * 3600000).toISOString(),
  }));
  const { data: inserted, error: insErr } = await db.from("announcements").insert(rows).select("id");
  if (insErr) throw new Error(`announcements insert: ${insErr.message}`);
  console.log(`  Итог Фазы G: announcements +${inserted?.length ?? 0}.`);
}

// ═══════════════════════════════════════════════════════════════════════
// ФАЗА H — чаты. Если за неделю СОВСЕМ 0 сообщений — добавить 1-2 в 10-15
// случайных direct-тредов учитель↔ученик. ВАЖНО: живой запрос этой сессии
// показал 1 (не 0) сообщение за неделю — гейт буквально "0" НЕ сработает.
// Оставлено буквально по формулировке задачи (не самовольно снижен порог)
// — dry-run это явно печатает, решение за пользователем (см. отчёт).
// ═══════════════════════════════════════════════════════════════════════
const CHAT_DIALOGS = [
  [{ s: "student", t: "Здравствуйте, как проходит подготовка к контрольной?" }, { s: "teacher", t: "Идёт хорошо, на следующем уроке разберём последние вопросы" }],
  [{ s: "student", t: "Спасибо, всё понятно" }, { s: "teacher", t: "Рад слышать, обращайся если что" }],
  [{ s: "student", t: "Можно узнать, когда будет следующая контрольная?" }, { s: "teacher", t: "На следующей неделе, точную дату сообщу дополнительно" }],
  [{ s: "teacher", t: "Не забудь принести тетрадь на следующий урок" }, { s: "student", t: "Хорошо, спасибо за напоминание" }],
  [{ s: "student", t: "Я не успел доделать домашнее задание, можно чуть позже сдать?" }, { s: "teacher", t: "Хорошо, сдай в течение двух дней" }],
  [{ s: "teacher", t: "Отличная работа на уроке сегодня!" }, { s: "student", t: "Спасибо большое!" }],
  [{ s: "student", t: "У меня вопрос по последнему заданию, можно уточнить?" }, { s: "teacher", t: "Конечно, пиши свой вопрос" }],
  [{ s: "student", t: "Здравствуйте, я заболел и не смогу прийти завтра" }, { s: "teacher", t: "Выздоравливай, материал урока пришлю отдельно" }],
  [{ s: "teacher", t: "Напоминаю про родительское собрание в пятницу" }, { s: "student", t: "Передам родителям, спасибо" }],
  [{ s: "student", t: "Спасибо за подробное объяснение на уроке" }, { s: "teacher", t: "Пожалуйста, обращайся если будут ещё вопросы" }],
];

async function phaseH_chatMessages() {
  console.log("\n[Фаза H] Чаты за неделю…");
  if (SKIP_BACKFILL) { console.log("  --skip-backfill — пропуск."); return; }

  const weekStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const weekEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();
  const { count, error } = await db.from("chat_messages").select("*", { count: "exact", head: true }).gte("created_at", weekStartIso).lt("created_at", weekEndExclIso);
  if (error) throw new Error(`chat_messages count: ${error.message}`);
  console.log(`  chat_messages за неделю сейчас: ${count ?? 0}.`);
  if (count !== 0) {
    console.log(`  ГЕЙТ ПО ЗАДАЧЕ БУКВАЛЬНО "0 сообщений" НЕ СРАБОТАЛ (сейчас ${count}, не 0) — фаза пропущена без записи.`);
    console.log(`  Если цель — "не выглядит пустым" (а не буквально ==0), нужно явное решение пользователя поднять порог.`);
    return;
  }

  const { data: directThreads, error: dtErr } = await db.from("chat_threads").select("id, group_id, school_id").eq("kind", "direct");
  if (dtErr) throw new Error(`chat_threads: ${dtErr.message}`);
  const nThreads = Math.min(10 + Math.floor(Math.random() * 6), directThreads.length); // 10-15
  const chosenThreads = [...directThreads].sort(() => Math.random() - 0.5).slice(0, nThreads);
  console.log(`  План: сообщения в ${chosenThreads.length} из ${directThreads.length} direct-тредов.`);
  if (DRY_RUN) { console.log("  [DRY-RUN] вставка не выполнена."); return; }

  const todayEnd = new Date();
  let inserted = 0;
  for (const t of chosenThreads) {
    const { data: participants, error: pErr } = await db.from("chat_participants").select("user_id, role_in_thread").eq("thread_id", t.id);
    if (pErr) { console.error(`  !! chat_participants read failed for ${t.id}: ${pErr.message}`); continue; }
    const teacherP = (participants ?? []).find((p) => p.role_in_thread === "teacher");
    const studentP = (participants ?? []).find((p) => p.role_in_thread === "student");
    if (!teacherP || !studentP) continue; // не teacher-student direct — пропуск

    const dialog = pick(CHAT_DIALOGS);
    const stamps = [...Array(dialog.length)].map(() => randomTimeBetween(weekStartIso, todayEnd.toISOString())).sort();
    const rows = dialog.map((m, i) => ({
      thread_id: t.id, sender_id: m.s === "teacher" ? teacherP.user_id : studentP.user_id,
      body: m.t, created_at: stamps[i], school_id: t.school_id ?? SCHOOL_ID,
    }));
    const { error: insErr } = await db.from("chat_messages").insert(rows);
    if (insErr) { console.error(`  !! chat_messages insert failed for ${t.id}: ${insErr.message}`); continue; }
    inserted += rows.length;
  }
  console.log(`  Итог Фазы H: chat_messages +${inserted}.`);
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  await phaseA_insertLessons();
  await phaseB_generateContent();
  await phaseC_attachMaterials();
  const ctx = SKIP_BACKFILL ? null : await loadPastLessonsAndRoster();
  await phaseD_backfillAttendance(ctx);
  await phaseE_backfillGrades(ctx);
  await phaseF_homework();
  await phaseG_announcements();
  await phaseH_chatMessages();
  console.log("\n" + "═".repeat(74));
  console.log(`ГОТОВО за ${((Date.now() - startedAt) / 1000).toFixed(1)}с. Режим: ${DRY_RUN ? "DRY-RUN — БД не менялась" : "БОЕВОЙ"}.`);
  console.log("═".repeat(74));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
