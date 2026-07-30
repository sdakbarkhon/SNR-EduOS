#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 7 — домашние задания на неделю (программирование/
// робототехника/математика/английский/русский) + сдачи всех 10 учеников
// группы + комментарии учителя + оценки. Демо-показ 30.07 — заказчик
// должен увидеть реально работающую школу.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки схемы — packages/core/src/database.types.ts,
// supabase/migrations/*, packages/core/src/queries/index.ts):
//
//   1) Нет колонки "kind"/"type" — дискриминатор homework.content_type (text +
//      CHECK homework_content_type_check, миграция 95): file, test,
//      programming, bundle, wokwi, codesandbox, geogebra, phet, desmos,
//      blockly_games, visualgo, p5js, excalidraw, learningapps, sqlonline,
//      h5p. "Кодинг ДЗ" → content_type='programming' (starter_code,
//      programming_language, expected_output). "Тест ДЗ" → content_type=
//      'test' (test_duration_seconds, test_auto_grade — отдельные колонки
//      прямо на homework). "Обычные"/"шаблонные" ДЗ (Математика/Английский/
//      Русский) → content_type='file' (просто description). Внешний Wokwi →
//      content_type='wokwi' (external_url).
//
//   2) НЕТ time_limit_minutes — реальная колонка test_duration_seconds
//      (int, СЕКУНДЫ, не минуты). "15 мин" → 900.
//
//   3) НЕТ max_attempts И НЕ МОЖЕТ БЫТЬ РЕАЛИЗОВАН: такой колонки нет нигде
//      в схеме. Одна попытка на тест структурно гарантирована UNIQUE
//      (homework_id, student_id) на test_submissions (и на homework_submissions
//      для остальных типов) — т.е. ровно ОДНА запись сдачи на ученика на
//      ДЗ, попыток "2" физически негде хранить. Этот пункт промта НЕ
//      реализован — не выдумываю несуществующую колонку.
//
//   4) КЛЮЧЕВОЕ РАСХОЖДЕНИЕ: "Тест ДЗ" сдаются НЕ через homework_submissions,
//      а через ОТДЕЛЬНУЮ пару test_submissions (homework_id, student_id,
//      submitted_at, score, max_score, grade, graded_at, graded_by —
//      UNIQUE(homework_id,student_id)) + test_answers (submission_id,
//      question_id, selected_option_id, open_text, is_correct). Учительский
//      компонент (TeacherHomeworkDetailView) читает getHomeworkSubmissions
//      И getTestSubmissionsForHomework РАЗДЕЛЬНО — тестовые ДЗ в
//      homework_submissions вообще не появляются в реальном приложении.
//      Промт просил "INSERT homework_submissions для всех учеников группы
//      (кроме внешних Wokwi)" — для тестовых ДЗ это было бы записью в
//      таблицу, которую тестовый UI не читает. Пишу в test_submissions/
//      test_answers вместо homework_submissions для content_type='test'.
//
//   5) СЛЕДСТВИЕ (4): test_submissions НЕ ИМЕЕТ колонки teacher_comment —
//      только grade/score/max_score (авто-проверка по правильным ответам).
//      "Комментарий учителя на ВСЕ сданные" физически невозможен для
//      тестовых ДЗ — комментарий пишется только для programming/file типов
//      (через homework_submissions.teacher_comment).
//
//   6) test_questions.question_type — 'single_choice' | 'open' (CHECK).
//      Все вопросы генерируются как 'single_choice' (4 варианта, 1
//      правильный, через is_correct на test_question_options) — 'open'
//      не используется (упрощает авто-проверку и совпадает с форматом,
//      который просил промт для "Тест ДЗ").
//
//   7) description — обычный text (НЕ jsonb/markdown-typed), UI показывает
//      его в <textarea>/как есть без выделенного markdown-рендера — но
//      ничего не мешает хранить в нём markdown-разметку (как и в
//      предыдущих этапах: lesson_stages.slides[].content уже хранит
//      markdown без выделенного рендерера). Матеша: Gemini возвращает
//      отдельно tasks[] — колонки для списка задач нет, склеиваю в
//      description как нумерованный список.
//
//   8) "Arduino код" для Робототехники — programming_language CHECK
//      допускает только python/javascript/cpp/java/html (нет "arduino"/
//      "ino") — использую 'cpp' (реальный синтаксис .ino — это C++).
//
//   9) Идемпотентность — НЕ по точному совпадению title (Gemini не
//      детерминирован между запусками, точное совпадение не защитит от
//      дублей при повторном запуске). Вместо этого: для каждой связки
//      (группа, предмет, content_type) считаем, сколько уже есть в БД —
//      если >= целевого количества для этой связки, пропускаем её
//      целиком; иначе генерируем недостающее, начиная с темы по индексу
//      "уже есть" (что уже есть — не трогаем, дубли новых не создаём).
//      Та же идиома, что и в generate-template-stages-remaining.mjs
//      (Этап 5) — проверка по факту наличия артефакта, а не по JSON-
//      чекпоинту (у AI-шагов Этапа 4 чекпоинт был нужен из-за 54 units
//      генерации ОДНОГО типа; здесь юнитов меньше и типов несколько —
//      состояние в БД надёжнее и проще).
//
//  10) СРОК СДАЧИ — важный пограничный случай: due_date = 2 августа 23:59,
//      "сегодня" (реальное время выполнения скрипта) — 30 июля, т.е. ДО
//      дедлайна. "Сдал с опозданием" (submitted_at > due_date) поэтому
//      структурно означает дату ПОЗЖЕ 2 августа — т.е. в "будущем"
//      относительно реального "сейчас". Это НЕ баг: та же условность уже
//      принята в Этапе 3 (расписание на всю неделю 27.07-02.08 создано
//      заранее, будущие дни помечены status='scheduled') — вся демо-неделя
//      строится как заранее заполненный период, а не строгий журнал
//      прошлых событий. "Опоздавшие" сдачи получают submitted_at = 3-4
//      августа (условно "будущее" для соответствия факту сдачи ПОСЛЕ
//      дедлайна).
//
// РАСПРЕДЕЛЕНИЕ ДЗ ПО ПРЕДМЕТАМ×ГРУППАМ (см. PLAN ниже) — подобрано так,
// чтобы попасть в диапазоны промта (5-6 Прог/Робот, 1-2 Матеша/Англ/Рус) и
// итог ~45: реально 46 ДЗ, 35 вызовов Gemini (в границах "30-40" промта).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-homework-week.mjs                — полный запуск
//   node --env-file=.env.local scripts/create-homework-week.mjs --limit=5      — тест на 5 ДЗ (порядок PLAN: первым идёт
//     Программирование/3-А класс — 3 coding + 2 test, --limit=5 покрывает оба Gemini-промпта до полного прогона)

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID, pick, randomInt, weightedPick, addMinutes, randomTimeBetween } from "./_backfill-shared.mjs";

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

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.slice("--limit=".length), 10) : Infinity;

const TZ = "+05:00";
const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];
const DUE_DATE_ISO = `2026-08-02T23:59:00${TZ}`;
const CREATED_DATES = ["2026-07-27", "2026-07-28", "2026-07-29"];
const CREATED_HOURS = ["09:00:00", "12:30:00", "15:00:00"];
function createdAtFor(indexWithinGroupSubject) {
  const d = CREATED_DATES[indexWithinGroupSubject % 3];
  const h = CREATED_HOURS[indexWithinGroupSubject % 3];
  return `${d}T${h}${TZ}`;
}

// ── план ДЗ по предмету×группе (см. правки к промту, п. «РАСПРЕДЕЛЕНИЕ») ──
const PLAN = {
  "Программирование": [
    { kind: "coding", contentType: "programming", counts: { "3-А класс": 3, "7-А класс": 4, "10-А класс": 4 } },
    { kind: "test", contentType: "test", counts: { "3-А класс": 2, "7-А класс": 2, "10-А класс": 2 } },
  ],
  "Робототехника": [
    { kind: "coding", contentType: "programming", counts: { "3-А класс": 2, "7-А класс": 3, "10-А класс": 2 } },
    { kind: "test", contentType: "test", counts: { "3-А класс": 2, "7-А класс": 2, "10-А класс": 2 } },
    { kind: "wokwi", contentType: "wokwi", counts: { "3-А класс": 1, "7-А класс": 1, "10-А класс": 1 } },
  ],
  "Математика": [
    { kind: "math", contentType: "file", counts: { "3-А класс": 2, "7-А класс": 1, "10-А класс": 2 } },
  ],
  "Английский язык": [
    { kind: "english", contentType: "file", counts: { "3-А класс": 1, "7-А класс": 2, "10-А класс": 1 } },
  ],
  "Русский язык": [
    { kind: "russian", contentType: "file", counts: { "3-А класс": 2, "7-А класс": 1, "10-А класс": 1 } },
  ],
};

const TEACHER_COMMENTS = [
  "Хорошая работа! Обрати внимание на комментарии в коде.",
  "Отлично справился, но постарайся оптимизировать решение.",
  "Правильно, только форматирование можно улучшить.",
  "Хорошо, но проверь ещё раз тестовые случаи.",
  "Молодец! Продолжай в том же духе.",
  "Отличная работа, всё сделано аккуратно.",
  "Неплохо, но в следующий раз добавь больше комментариев к коду.",
  "Задание выполнено верно, разбор ошибок — на уроке.",
  "Хороший подход к решению, есть небольшие недочёты.",
  "Сделано старательно, продолжай в том же духе.",
  "Всё правильно, но обрати внимание на сроки сдачи.",
  "Хорошая попытка, вместе разберём сложные моменты на уроке.",
];
const ANSWER_TEXTS = [
  "Выполнил все задания, могу объяснить на уроке.",
  "Решил все задачи, ответы приложены.",
  "Сделал упражнения, было интересно!",
  "Готово, самостоятельно проверил ответы.",
  "Выполнил, но есть вопрос по одному из заданий.",
];

const ON_TIME_GRADE_WEIGHTS = { 5: 0.8, 4: 0.15, 3: 0.05 };
const LATE_GRADE_WEIGHTS = { 5: 0.2, 4: 0.5, 3: 0.2, 2: 0.1 };
const CORRECTNESS_BY_GRADE = { 5: 0.95, 4: 0.8, 3: 0.62, 2: 0.45 };

// ── throttle + модель + retry (зеркалит generate-stages-jul28-30.mjs) ──────
const MIN_INTERVAL_MS = 6500;
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

// ── Gemini промпты + валидация ──────────────────────────────────────────────
const CODING_SYSTEM_PROMPT = `Ты учитель информатики/робототехники. Тебе даётся предмет, класс, тема
урока и язык программирования. Создай домашнее задание по программированию.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{
  "title": "название задания, 3-6 слов",
  "description": "описание задачи в формате Markdown: заголовки ##, списки -, **жирный**, примеры кода в тройных обратных кавычках. 200-400 слов. Включи: цель, требования, пример ввода/вывода, подсказки.",
  "starter_code": "код-заготовка (10-30 строк) с комментариями TODO, где ученик должен дописать решение",
  "solution_hint": "короткая подсказка для проверки решения учителем (1-2 предложения)"
}

ПРАВИЛА:
- Код и синтаксис — точно для указанного языка программирования.
- Тема отражена в задаче конкретно, не общими словами.
- Сложность и словарь — под класс (3 = начальная школа, простые задачи; 7 = средняя; 10 = старшая, продвинуто).
- Язык текста — русский.
- Только валидный JSON.`;

const TEST_SYSTEM_PROMPT = `Ты учитель, создающий тест для проверки знаний по теме урока.

ВЕРНИ СТРОГО JSON:
{
  "title": "название теста, 3-6 слов",
  "description": "краткое описание в Markdown (2-4 предложения) — цель теста",
  "questions": [ { "question_text": "...", "options": ["...","...","...","..."], "correct_option_index": 0 }, ... ]
}

ПРАВИЛА:
- questions: РОВНО 12 вопросов, ровно 4 варианта на каждый, один правильный (correct_option_index 0-based).
- Вопросы конкретные по теме, не общие.
- Сложность и словарь — под класс.
- Язык — русский.
- Только валидный JSON.`;

const MATH_SYSTEM_PROMPT = `Ты учитель математики. Создай домашнее задание по теме урока.

ВЕРНИ СТРОГО JSON:
{
  "title": "название, 3-5 слов",
  "description": "вводная часть в Markdown — цель, что нужно вспомнить перед решением (2-4 предложения). Формулы через $...$ (inline) или $$...$$ (блок), если уместно.",
  "tasks": [ "задача 1", "задача 2", "..." ]
}

ПРАВИЛА:
- tasks: 5-7 задач, каждая — самостоятельная формулировка (без своей нумерации — нумерация добавится при выводе), формулы через $...$/$$...$$.
- Сложность — под класс (3 = начальная школа: простые числа; 7 = средняя: дроби/проценты/уравнения; 10 = старшая: по фактической теме — производные/интегралы/тригонометрия).
- Язык — русский.
- Только валидный JSON.`;

function programmingLanguageFor(subjectName, topic) {
  if (subjectName === "Робототехника") return "cpp"; // Arduino/.ino — синтаксис C++, нет отдельного enum-значения
  return /c\+\+/i.test(topic) ? "cpp" : "python";
}
function languageLabelFor(programmingLanguage) {
  return programmingLanguage === "cpp" ? "C++ (Arduino)" : "Python";
}

function validateCoding(parsed) {
  const title = typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
  const description = typeof parsed?.description === "string" && parsed.description.trim().length >= 80 ? parsed.description.trim() : null;
  const starterCode = typeof parsed?.starter_code === "string" && parsed.starter_code.trim() ? parsed.starter_code.trim() : null;
  const hint = typeof parsed?.solution_hint === "string" && parsed.solution_hint.trim() ? parsed.solution_hint.trim() : null;
  if (!title || !description || !starterCode || !hint) return null;
  return { title, description, starterCode, hint };
}
function validateTest(parsed) {
  const title = typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
  const description = typeof parsed?.description === "string" && parsed.description.trim() ? parsed.description.trim() : null;
  if (!title || !description) return null;
  const raw = Array.isArray(parsed?.questions) ? parsed.questions : null;
  if (!raw) return null;
  const questions = raw
    .filter((q) => q && typeof q.question_text === "string" && q.question_text.trim()
      && Array.isArray(q.options) && q.options.filter((o) => typeof o === "string" && o.trim()).length === 4
      && Number.isInteger(q.correct_option_index) && q.correct_option_index >= 0 && q.correct_option_index < 4)
    .map((q) => ({ question_text: q.question_text.trim(), options: q.options.map((o) => String(o).trim()), correct_option_index: q.correct_option_index }))
    .slice(0, 15);
  if (questions.length < 10) return null;
  return { title, description, questions };
}
function validateMath(parsed) {
  const title = typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
  const description = typeof parsed?.description === "string" && parsed.description.trim() ? parsed.description.trim() : null;
  if (!title || !description) return null;
  const raw = Array.isArray(parsed?.tasks) ? parsed.tasks : null;
  if (!raw) return null;
  const tasks = raw.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim());
  if (tasks.length < 5) return null;
  return { title, description, tasks: tasks.slice(0, 7) };
}

async function callAndValidate(systemPrompt, userPrompt, validate, logPrefix) {
  let v = null;
  for (let attempt = 0; attempt < 2 && !v; attempt++) {
    let response;
    try {
      response = await callGeminiWithRetry(systemPrompt, userPrompt);
    } catch (e) {
      if (e.isDailyQuota) throw e;
      console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
      continue;
    }
    let parsed;
    try { parsed = JSON.parse(stripFences(response.text())); }
    catch { console.error(`${logPrefix} → ERROR (JSON parse, попытка ${attempt + 1})`); continue; }
    v = validate(parsed);
    if (!v) console.error(`${logPrefix} → ERROR (валидация не прошла, попытка ${attempt + 1})`);
  }
  return v;
}

// ── шаблоны (Английский/Русский/Wokwi — без Gemini) ─────────────────────────
const LEVEL_BY_GROUP = { "3-А класс": "elementary", "7-А класс": "middle", "10-А класс": "advanced" };

function englishTemplate(topic, groupName) {
  const level = LEVEL_BY_GROUP[groupName];
  const title = `Practice: ${topic}`;
  const bodies = {
    elementary: `## Упражнение: ${topic}\n\n**Задание 1.** Переведи слова на английский язык по теме «${topic}».\n\n**Задание 2.** Вставь пропущенное слово: "I ___ a student." (am / is / are)\n\n**Задание 3.** Ответь на вопрос простым предложением по теме «${topic}».`,
    middle: `## Practice: ${topic}\n\n**Упражнение 1. Перевод.** Переведи 2-3 предложения на английский язык по теме «${topic}».\n\n**Упражнение 2. Вставь слово.** Заполни пропуски правильной формой глагола по теме «${topic}».\n\n**Упражнение 3. Ответь на вопросы.** Напиши 3-4 предложения по теме «${topic}», используя изученную грамматику.`,
    advanced: `## Practice: ${topic}\n\n**Exercise 1. Translation.** Translate 2-3 sentences into English on the topic "${topic}".\n\n**Exercise 2. Grammar.** Rewrite the sentences using the structures studied in "${topic}".\n\n**Exercise 3. Writing.** Write a short paragraph (80-120 words) on "${topic}".`,
  };
  return { title, description: bodies[level] };
}
function russianTemplate(topic, groupName) {
  const level = LEVEL_BY_GROUP[groupName];
  const title = `Упражнение по теме «${topic}»`;
  const bodies = {
    elementary: `## Упражнение по теме «${topic}»\n\n**Задание 1.** Спиши предложение по теме «${topic}» и подчеркни главные члены.\n\n**Задание 2.** Укажи часть речи выделенных слов.\n\n**Задание 3.** Составь своё предложение по теме «${topic}».`,
    middle: `## Упражнение по теме «${topic}»\n\n**Задание 1.** Разберите предложение по членам (по теме «${topic}»).\n\n**Задание 2.** Укажите часть речи каждого слова в предложении.\n\n**Задание 3.** Расставьте знаки препинания в предложениях с однородными членами.`,
    advanced: `## Упражнение по теме «${topic}»\n\n**Задание 1.** Проведите синтаксический разбор сложного предложения (по теме «${topic}»).\n\n**Задание 2.** Определите стилистические средства выразительности в приведённом отрывке.\n\n**Задание 3.** Напишите мини-сочинение-рассуждение (5-7 предложений) по теме «${topic}».`,
  };
  return { title, description: bodies[level] };
}
function wokwiTemplate(topic) {
  return {
    title: `Внешний проект: ${topic}`,
    description: `## Внешний проект (Wokwi): ${topic}\n\nСоберите схему и код в симуляторе Wokwi по теме «${topic}».\n\n**Что нужно сделать:**\n- Собрать схему в Wokwi согласно теме урока.\n- Написать и протестировать код в симуляторе.\n- Прислать учителю ссылку на готовый проект (обсуждается на уроке).`,
    externalUrl: "https://wokwi.com/projects/new/arduino-uno",
  };
}

function deriveSubmissionCode(starterCode, programmingLanguage) {
  const marker = programmingLanguage === "cpp" ? "// решение ученика (сдано)" : "# решение ученика (сдано)";
  return `${starterCode}\n\n${marker}`;
}

// ── распределение сдач по студентам ─────────────────────────────────────────
function assignBuckets(students, azizId) {
  const forced = students.find((s) => s.id === azizId);
  const rest = students.filter((s) => s.id !== azizId);
  const shuffled = [...rest].sort(() => Math.random() - 0.5);
  const onTime = forced ? [forced] : [];
  const missedCount = 1, lateCount = 1;
  const onTimeCount = shuffled.length - missedCount - lateCount;
  onTime.push(...shuffled.slice(0, onTimeCount));
  const late = shuffled.slice(onTimeCount, onTimeCount + lateCount);
  const missed = shuffled.slice(onTimeCount + lateCount);
  return { onTime, late, missed };
}

async function main() {
  console.log(`ДЗ на неделю — демо-школа (${SCHOOL_ID})\n`);

  // ── разведка live-состояния (перед генерацией) ──
  for (const tbl of ["homework", "homework_submissions", "test_questions", "test_question_options", "test_submissions", "test_answers"]) {
    const { count } = await db.from(tbl).select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
    console.log(`  ${tbl}: ${count} (текущее состояние)`);
  }
  console.log("");

  // ── резолв групп/предметов/учителей/планов/тем/учеников ──
  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);
  const groupByName = new Map(groups.map((g) => [g.name, g]));

  const SUBJECT_NAMES = Object.keys(PLAN);
  const { data: subjects, error: sErr } = await db
    .from("subjects").select("id, name, group_id, teacher_id")
    .in("name", SUBJECT_NAMES).in("group_id", groups.map((g) => g.id)).eq("is_active", true);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const subjectByGroupAndName = new Map(subjects.map((s) => [`${s.group_id}|${s.name}`, s]));

  const { data: plans, error: pErr } = await db
    .from("curriculum_plans").select("id, group_id, subject_id").eq("school_id", SCHOOL_ID);
  if (pErr) fail(`Ошибка запроса curriculum_plans: ${pErr.message}`);
  const planByGroupAndSubject = new Map(plans.map((p) => [`${p.group_id}|${p.subject_id}`, p.id]));

  const { data: topics, error: tErr } = await db
    .from("curriculum_plan_topics").select("id, plan_id, order_index, title")
    .in("plan_id", plans.map((p) => p.id)).order("order_index");
  if (tErr) fail(`Ошибка запроса curriculum_plan_topics: ${tErr.message}`);
  const topicsByPlan = new Map();
  for (const t of topics) {
    if (!topicsByPlan.has(t.plan_id)) topicsByPlan.set(t.plan_id, []);
    topicsByPlan.get(t.plan_id).push(t);
  }

  const { data: students, error: stErr } = await db
    .from("students").select("id, username, full_name, student_groups(group_id, groups(name))")
    .eq("school_id", SCHOOL_ID);
  if (stErr) fail(`Ошибка запроса students: ${stErr.message}`);
  const studentsByGroupName = new Map();
  for (const s of students) {
    const gName = s.student_groups?.[0]?.groups?.name;
    if (!gName) continue;
    if (!studentsByGroupName.has(gName)) studentsByGroupName.set(gName, []);
    studentsByGroupName.get(gName).push({ id: s.id, username: s.username });
  }
  for (const className of CLASS_NAMES) {
    const arr = studentsByGroupName.get(className) ?? [];
    if (arr.length !== 10) console.warn(`  !! В группе "${className}" учеников: ${arr.length} (ожидание 10).`);
  }
  const azizStudent = students.find((s) => s.username === "aziz_03");
  if (!azizStudent) fail(`Ученик aziz_03 не найден в демо-школе.`);
  const azizId = azizStudent.id;
  console.log(`aziz_03 (${azizStudent.full_name}) найден, id=${azizId}.\n`);

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let totalPlanned = 0, totalCreated = 0, totalSkippedExisting = 0, geminiCalls = 0;
  let hwSubmissionsInserted = 0, testSubmissionsInserted = 0, missedCount = 0;
  let limitRemaining = LIMIT;

  outer:
  for (const [subjectName, kindsForSubject] of Object.entries(PLAN)) {
    for (const groupName of CLASS_NAMES) {
      const group = groupByName.get(groupName);
      const subject = subjectByGroupAndName.get(`${group.id}|${subjectName}`);
      if (!subject) { console.warn(`  !! Предмет "${subjectName}" не найден для "${groupName}" — пропуск.`); continue; }
      const planId = planByGroupAndSubject.get(`${group.id}|${subject.id}`);
      const planTopics = planId ? (topicsByPlan.get(planId) ?? []) : [];
      const students10 = studentsByGroupName.get(groupName) ?? [];

      let topicCursor = 0;
      for (const kindPlan of kindsForSubject) {
        const targetCount = kindPlan.counts[groupName] ?? 0;
        if (targetCount === 0) continue;

        const { count: existingCount, error: exErr } = await db
          .from("homework").select("*", { count: "exact", head: true })
          .eq("group_id", group.id).eq("subject_id", subject.id).eq("content_type", kindPlan.contentType);
        if (exErr) fail(`Ошибка проверки существующих ДЗ: ${exErr.message}`);

        totalPlanned += targetCount;
        const alreadyHave = Math.min(existingCount ?? 0, targetCount);
        if (alreadyHave > 0) { totalSkippedExisting += alreadyHave; topicCursor += alreadyHave; }
        const toCreate = targetCount - alreadyHave;

        for (let i = 0; i < toCreate; i++) {
          if (limitRemaining <= 0) { console.log("\n--limit достигнут, останавливаюсь."); break outer; }
          const topic = planTopics[topicCursor % Math.max(planTopics.length, 1)]?.title ?? subjectName;
          const globalIndex = alreadyHave + i;
          const createdAt = createdAtFor(globalIndex);
          const logPrefix = `  [${subjectName} · ${groupName} · ${kindPlan.kind}] "${topic}"`;

          let content = null, programmingLanguage = null, externalUrl = null;
          if (kindPlan.kind === "coding") {
            programmingLanguage = programmingLanguageFor(subjectName, topic);
            const userPrompt = `Класс: ${groupName}\nПредмет: ${subjectName}\nТема: "${topic}"\nЯзык программирования: ${languageLabelFor(programmingLanguage)}`;
            geminiCalls++;
            const v = await callAndValidate(CODING_SYSTEM_PROMPT, userPrompt, validateCoding, logPrefix);
            if (!v) { console.error(`${logPrefix} → ПРОПУСК (не удалось сгенерировать)`); topicCursor++; continue; }
            content = v;
          } else if (kindPlan.kind === "test") {
            const userPrompt = `Класс: ${groupName}\nПредмет: ${subjectName}\nТема: "${topic}"`;
            geminiCalls++;
            const v = await callAndValidate(TEST_SYSTEM_PROMPT, userPrompt, validateTest, logPrefix);
            if (!v) { console.error(`${logPrefix} → ПРОПУСК (не удалось сгенерировать)`); topicCursor++; continue; }
            content = v;
          } else if (kindPlan.kind === "math") {
            const userPrompt = `Класс: ${groupName}\nТема: "${topic}"`;
            geminiCalls++;
            const v = await callAndValidate(MATH_SYSTEM_PROMPT, userPrompt, validateMath, logPrefix);
            if (!v) { console.error(`${logPrefix} → ПРОПУСК (не удалось сгенерировать)`); topicCursor++; continue; }
            const description = `${v.description}\n\n## Задачи\n${v.tasks.map((t, idx) => `${idx + 1}. ${t}`).join("\n\n")}`;
            content = { title: v.title, description };
          } else if (kindPlan.kind === "english") {
            content = englishTemplate(topic, groupName);
          } else if (kindPlan.kind === "russian") {
            content = russianTemplate(topic, groupName);
          } else if (kindPlan.kind === "wokwi") {
            const w = wokwiTemplate(topic);
            content = { title: w.title, description: w.description };
            externalUrl = w.externalUrl;
          }

          const homeworkRow = {
            school_id: SCHOOL_ID,
            group_id: group.id,
            subject_id: subject.id,
            teacher_id: subject.teacher_id ?? null,
            title: content.title,
            description: content.description,
            due_date: DUE_DATE_ISO,
            created_at: createdAt,
            content_type: kindPlan.contentType,
            source: "teacher",
            ...(kindPlan.kind === "coding" ? {
              programming_language: programmingLanguage,
              starter_code: content.starterCode,
              expected_output: content.hint,
            } : {}),
            ...(kindPlan.kind === "test" ? {
              test_duration_seconds: 900,
              test_auto_grade: true,
            } : {}),
            ...(kindPlan.kind === "wokwi" ? { external_url: externalUrl } : {}),
          };
          const { data: hw, error: hwErr } = await db.from("homework").insert(homeworkRow).select("id").single();
          if (hwErr) { console.error(`${logPrefix} → ОШИБКА insert homework: ${hwErr.message}`); topicCursor++; continue; }

          let subOk = "";
          if (kindPlan.kind === "test") {
            const qRows = content.questions.map((q, qi) => ({
              homework_id: hw.id, school_id: SCHOOL_ID, question_text: q.question_text, question_type: "single_choice", order_index: qi,
            }));
            const { data: qIds, error: qErr } = await db.from("test_questions").insert(qRows).select("id");
            if (qErr) { console.error(`${logPrefix} → ОШИБКА insert test_questions: ${qErr.message}`); }
            else {
              const optRows = content.questions.flatMap((q, qi) =>
                q.options.map((optText, oi) => ({
                  question_id: qIds[qi].id, school_id: SCHOOL_ID, option_text: optText,
                  is_correct: oi === q.correct_option_index, order_index: oi,
                })),
              );
              const { data: optRowsInserted, error: oErr } = await db.from("test_question_options").insert(optRows).select("id, question_id, is_correct");
              if (oErr) console.error(`${logPrefix} → ОШИБКА insert test_question_options: ${oErr.message}`);
              else {
                const optionsByQuestion = new Map();
                for (const o of optRowsInserted) {
                  if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
                  optionsByQuestion.get(o.question_id).push(o);
                }
                const questionIds = qIds.map((q) => q.id);
                const { onTime, late, missed } = assignBuckets(students10, azizId);
                missedCount += missed.length;
                const testSubRows = [];
                for (const bucketName of ["onTime", "late"]) {
                  const bucket = bucketName === "onTime" ? onTime : late;
                  for (const student of bucket) {
                    const isAziz = student.id === azizId;
                    const grade = isAziz ? 5 : weightedPick(bucketName === "onTime" ? ON_TIME_GRADE_WEIGHTS : LATE_GRADE_WEIGHTS);
                    const correctness = isAziz ? 0.97 : CORRECTNESS_BY_GRADE[Number(grade)];
                    const submittedAt = bucketName === "onTime"
                      ? randomTimeBetween(createdAt, now.toISOString())
                      : addMinutes(DUE_DATE_ISO, randomInt(60, 3 * 24 * 60));
                    testSubRows.push({ homeworkId: hw.id, student, grade: Number(grade), correctness, submittedAt, questionIds, optionsByQuestion });
                  }
                }
                for (const row of testSubRows) {
                  let correctCount = 0;
                  const answerRows = row.questionIds.map((qId) => {
                    const opts = row.optionsByQuestion.get(qId) ?? [];
                    const correctOpt = opts.find((o) => o.is_correct);
                    const isCorrectRoll = Math.random() < row.correctness;
                    const chosen = isCorrectRoll ? correctOpt : (pick(opts.filter((o) => !o.is_correct)) ?? correctOpt);
                    if (chosen?.is_correct) correctCount++;
                    return { question_id: qId, school_id: SCHOOL_ID, selected_option_id: chosen?.id ?? null, is_correct: !!chosen?.is_correct };
                  });
                  const { data: tsub, error: tsErr } = await db.from("test_submissions").insert({
                    homework_id: row.homeworkId, student_id: row.student.id, school_id: SCHOOL_ID,
                    submitted_at: row.submittedAt, started_at: addMinutes(row.submittedAt, -randomInt(5, 15)),
                    score: correctCount, max_score: row.questionIds.length, grade: row.grade,
                    graded_at: row.submittedAt, graded_by: subject.teacher_id ?? null,
                  }).select("id").single();
                  if (tsErr) { console.error(`  !! test_submissions insert failed (${row.student.username}): ${tsErr.message}`); continue; }
                  const answersWithSubmission = answerRows.map((a) => ({ ...a, submission_id: tsub.id }));
                  const { error: taErr } = await db.from("test_answers").insert(answersWithSubmission);
                  if (taErr) console.error(`  !! test_answers insert failed (${row.student.username}): ${taErr.message}`);
                  testSubmissionsInserted++;
                }
                subOk = `${testSubRows.length} test_submissions, ${missed.length} not_submitted`;
              }
            }
          } else if (kindPlan.kind !== "wokwi") {
            const { onTime, late, missed } = assignBuckets(students10, azizId);
            missedCount += missed.length;
            const rows = [];
            for (const bucketName of ["onTime", "late"]) {
              const bucket = bucketName === "onTime" ? onTime : late;
              for (const student of bucket) {
                const isAziz = student.id === azizId;
                const grade = isAziz ? 5 : weightedPick(bucketName === "onTime" ? ON_TIME_GRADE_WEIGHTS : LATE_GRADE_WEIGHTS);
                const submittedAt = bucketName === "onTime"
                  ? randomTimeBetween(createdAt, now.toISOString())
                  : addMinutes(DUE_DATE_ISO, randomInt(60, 3 * 24 * 60));
                const row = {
                  homework_id: hw.id, student_id: student.id, school_id: SCHOOL_ID,
                  submitted_at: submittedAt, status: "graded",
                  grade: Number(grade), teacher_comment: pick(TEACHER_COMMENTS),
                  graded_at: addMinutes(submittedAt, randomInt(120, 2160)), graded_by: subject.teacher_id ?? null,
                };
                if (kindPlan.kind === "coding") row.code_text = deriveSubmissionCode(content.starterCode, programmingLanguage);
                else row.answer_text = pick(ANSWER_TEXTS);
                rows.push(row);
              }
            }
            const { error: hsErr } = await db.from("homework_submissions").insert(rows);
            if (hsErr) console.error(`  !! homework_submissions insert failed: ${hsErr.message}`);
            else hwSubmissionsInserted += rows.length;
            subOk = `${rows.length} homework_submissions, ${missed.length} not_submitted`;
          } else {
            subOk = "внешний Wokwi — сдачи не создаются";
          }

          console.log(`${logPrefix} → OK (${subOk})`);
          totalCreated++;
          topicCursor++;
          limitRemaining--;
        }
      }
    }
  }

  console.log(`\nГотово: запланировано ${totalPlanned}, уже существовало ${totalSkippedExisting}, создано ${totalCreated}, вызовов Gemini ${geminiCalls}.`);
  console.log(`homework_submissions вставлено: ${hwSubmissionsInserted}. test_submissions вставлено: ${testSubmissionsInserted}. Пропусков (not_submitted): ${missedCount}.`);

  const { count: hwTotal } = await db.from("homework").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: hsTotal } = await db.from("homework_submissions").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: tsTotal } = await db.from("test_submissions").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  console.log(`\nПроверка: homework — ${hwTotal} (ожидание 40-50). homework_submissions — ${hsTotal}. test_submissions — ${tsTotal}. Вместе — ${hsTotal + tsTotal} (ожидание ~400).`);

  const { data: azizHw, error: azErr } = await db.from("homework_submissions").select("grade, teacher_comment, status").eq("student_id", azizId).eq("school_id", SCHOOL_ID);
  const { data: azizTest, error: azErr2 } = await db.from("test_submissions").select("grade, score, max_score").eq("student_id", azizId).eq("school_id", SCHOOL_ID);
  if (azErr || azErr2) console.error(`Ошибка проверки aziz_03: ${(azErr ?? azErr2).message}`);
  const azizAllFive = [...(azizHw ?? []), ...(azizTest ?? [])].every((r) => Number(r.grade) === 5);
  console.log(`Проверка aziz_03: ${azizHw?.length ?? 0} homework_submissions + ${azizTest?.length ?? 0} test_submissions, все оценки = 5: ${azizAllFive ? "ДА" : "НЕТ — ПРОВЕРИТЬ"}.`);
}

const now = new Date();
main().catch((e) => fail(e.stack ?? String(e)));
