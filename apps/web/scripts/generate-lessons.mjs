// Промт 7.4 Часть 2 — наполнение пустых уроков (13-24 июля) через Gemini
// free tier. Одноразовый скрипт, не деплоится с приложением.
//
// Переиспользует проверенный паттерн apps/web/generate-weekend.mjs:
// - авторизация РЕАЛЬНОЙ сессией teacher_karim (не service-role) — как
//   куратор всех 3 групп, is_my_teacher_group() пропускает его для ЛЮБОГО
//   предмета внутри его групп, поэтому RLS/notify-триггерные landmines
//   Промта 7.3 (auth.uid() NULL под service-role) здесь не актуальны.
// - тот же 3-этапный shape lesson_stages (theory/task-practice/task-quiz_qia).
//
// Отличие от generate-weekend.mjs: там темы брались из статического
// CURRICULUM-словаря (сейчас полностью исчерпан — все его темы уже в БД).
// Здесь тема НЕ хардкодится — читаем реально уже использованные темы по
// каждой паре (предмет,группа) прямо из БД (источник истины, не зависит от
// истории прошлых скриптов/логов) и просим Gemini предложить СЛЕДУЮЩУЮ,
// не повторяя уже пройденное — экономит отдельный вызов на "придумать тему".
//
// node generate-lessons.mjs [startIndex] [count] [fromDate] [toDate]

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SCRATCHPAD = "C:/Users/toiro/AppData/Local/Temp/claude/I--SNR-EduOS--claude-worktrees-prompt-3-demo-session-logic-456952/44f759f7-b423-4831-bf3f-a470f50c2ae4/scratchpad";
const LOG_PATH = path.join(SCRATCHPAD, "generate-lessons-progress-log.json");

function loadEnvLocal(p) {
  const text = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}
const env = loadEnvLocal(path.resolve(process.cwd(), ".env.local"));
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const MIN_INTERVAL_MS = 4200; // free tier 15 req/min
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
let modelName = null;
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      console.log(`Using model: ${candidate}`);
      return candidate;
    } catch (e) {
      const isDailyLimit = /quota|429/i.test(e.message ?? "") && /PerDay/i.test(e.message ?? "");
      console.warn(`  model ${candidate} unavailable: ${(e.message ?? "").split("\n")[0]}`);
      if (isDailyLimit) console.warn(`  (daily free-tier quota for ${candidate} appears exhausted)`);
    }
  }
  return null;
}

const GRADE_BY_GROUP = { "3-А класс": 3, "7-А класс": 7, "10-А класс": 10 };
const PRACTICE_KIND_BY_SUBJECT = {
  "Программирование": (group) => (group === "3-А класс" ? "blockly_games" : "code"),
  "Робототехника": () => "wokwi",
  "Математика": () => "geogebra",
  "Английский язык": () => "learningapps",
  "Русский язык": () => "learningapps",
};

const SYSTEM_PROMPT = `Ты — методический ассистент для учителя в школе Узбекистана.

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
- Логичное продолжение программы после уже пройденных тем (расширение/
  усложнение материала), НЕ дублирует ничего из списка уже пройденного.
- Короткое, конкретное название (как в уже пройденных темах).

ПРАВИЛА ДЛЯ theory.slides:
- 4-6 слайдов, суммарно 400-600 слов текста в content по всем слайдам.
- Первый слайд layout="title" (короткое вступление), остальные layout="default".
- content — markdown: заголовки ##, списки через "-", **жирный** для терминов.
- Академический стиль, СТРОГО адаптированный под указанный класс (возраст ученика).
  Для 3 класса — простые слова, короткие предложения, наглядные примеры.
  Для 7 класса — средний уровень сложности, больше терминов.
  Для 10 класса — академический стиль, формулы/код где уместно.
- Тема слайдов должна раскрывать ИМЕННО предложенную тему урока, с конкретными
  фактами/примерами — не общие фразы. Без эмодзи.

ПРАВИЛА ДЛЯ practice (тип practice_kind передаётся во входных данных):
- "code": starter_code — рабочий пример кода по теме (Python), description
  объясняет что ученик должен изменить/дополнить, teacher_notes — эталонное
  решение и типичные ошибки.
- "wokwi" / "learningapps" / "geogebra" / "blockly_games": starter_code НЕ
  заполнять; description — что именно ученик делает во внешнем редакторе
  (схема/упражнение/фигура), teacher_notes — на что учителю обратить внимание.

ПРАВИЛА ДЛЯ quiz.questions:
- Ровно 5 вопросов, проверяющих ПОНИМАНИЕ темы (не запоминание синтаксиса),
  сложность вопросов соответствует классу.
- correct_index — индекс правильного варианта в "options" (0-based), ровно один
  правильный вариант, 4 варианта на вопрос.

Заголовки и описания только на русском. Только валидный JSON, ничего больше.`;

function buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin }) {
  return `ВХОДНЫЕ ДАННЫЕ:
- Класс: ${grade}
- Предмет: ${subjectName}
- Уже пройденные темы (не повторять): ${usedTopics.length ? usedTopics.join("; ") : "(пока нет — это первая тема)"}
- practice_kind: ${practiceKind}
- Длительность урока: ${durationMin} минут`;
}

async function callGeminiWithRetry(userPrompt) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const result = await model.generateContent(userPrompt);
      return result.response;
    } catch (e) {
      const is429 = e.status === 429 || /429|rate.?limit|quota/i.test(e.message ?? "");
      if (is429 && attempt < MAX_RETRIES - 1) {
        const delay = 5000 * 2 ** attempt;
        console.warn(`  [retry] rate limited, waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Exhausted retries");
}

function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

const STAGE_DURATIONS = { theory: 70, practice: 90, quiz: 25 };

async function main() {
  const startIndex = parseInt(process.argv[2] ?? "0", 10);
  const count = parseInt(process.argv[3] ?? "9999", 10);
  const fromDate = process.argv[4] ?? "2026-07-13";
  const toDate = process.argv[5] ?? "2026-07-25"; // exclusive

  const { error: authError } = await db.auth.signInWithPassword({
    email: "teacher_karim@teachers.snr.local",
    password: "password123",
  });
  if (authError) throw authError;

  // ── 1. Fetch empty lessons (no middle stages) in range ──────────────────
  const { data: allLessons, error: fetchErr } = await db
    .from("lessons")
    .select("id, starts_at, group:groups(name), subject:subjects(name)")
    .gte("starts_at", `${fromDate}T00:00:00+05:00`)
    .lt("starts_at", `${toDate}T00:00:00+05:00`)
    .order("starts_at", { ascending: true });
  if (fetchErr) throw fetchErr;

  const { data: stageRows } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  const hasStages = new Set((stageRows ?? []).map((r) => r.lesson_id));
  const emptyLessons = (allLessons ?? []).filter((l) => !hasStages.has(l.id));
  console.log(`Пустых уроков в диапазоне ${fromDate}..${toDate}: ${emptyLessons.length}`);

  // ── 2. Already-used real topics per (subject,group), from DB (source of truth) ──
  // Signal for "this lesson's topic is a real generated one, not the bare
  // subject-name placeholder": it has middle stages.
  const { data: filledWithStages } = await db
    .from("lessons")
    .select("id, topic, group:groups(name), subject:subjects(name)")
    .in("id", [...hasStages]);
  const usedTopicsByKey = new Map();
  for (const l of filledWithStages ?? []) {
    if (!l.topic || !l.subject?.name || !l.group?.name) continue;
    const key = `${l.subject.name}|${l.group.name}`;
    const arr = usedTopicsByKey.get(key) ?? [];
    if (!arr.includes(l.topic)) arr.push(l.topic);
    usedTopicsByKey.set(key, arr);
  }

  // ── 3. Resumable progress log ────────────────────────────────────────────
  const log = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { done: {}, results: [] };
  const pending = emptyLessons.filter((l) => !log.done[l.id]);
  const batch = pending.slice(startIndex, startIndex + count);

  if (batch.length === 0) {
    console.log("Нечего делать в этом батче (всё сделано или диапазон пуст).");
    console.log(`Всего в очереди: ${pending.length}`);
    return;
  }
  console.log(`=== Батч: ${batch.length} уроков (в очереди всего: ${pending.length}) ===`);

  modelName = await pickWorkingModel();
  if (!modelName) {
    console.warn("Дневной бесплатный лимит Gemini исчерпан (или ни одна модель недоступна на этом ключе). Прогресс не потерян — 0 уроков помечено done. Повторите запуск позже (после сброса дневной квоты завтра).");
    process.exit(0);
  }

  let done = 0;
  for (const lessonSpec of batch) {
    const subjectName = lessonSpec.subject?.name;
    const groupName = lessonSpec.group?.name;
    const grade = GRADE_BY_GROUP[groupName];
    const practiceKindFn = PRACTICE_KIND_BY_SUBJECT[subjectName];
    if (!practiceKindFn) {
      console.error(`!! Нет practice_kind для предмета "${subjectName}" — пропуск урока ${lessonSpec.id}`);
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: "no_practice_kind" });
      continue;
    }
    const practiceKind = practiceKindFn(groupName);
    const key = `${subjectName}|${groupName}`;
    const usedTopics = usedTopicsByKey.get(key) ?? [];

    console.log(`\n[${subjectName} / ${groupName} / ${lessonSpec.starts_at}] (уже пройдено: ${usedTopics.length})`);

    const userPrompt = buildUserPrompt({ subjectName, usedTopics, practiceKind, grade, durationMin: 190 });

    let response;
    try {
      response = await callGeminiWithRetry(userPrompt);
    } catch (e) {
      const is429 = e.status === 429 || /429|rate.?limit|quota/i.test(e.message ?? "");
      console.error(`  !! API call failed after retries: ${e.message}`);
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, error: e.message });
      fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
      if (is429) {
        console.warn("Похоже, дневная квота закончилась в процессе батча. Завершаюсь чисто — прогресс сохранён, остальные уроки останутся в очереди на завтра.");
        break;
      }
      continue;
    }

    const usageMeta = response.usageMetadata ?? {};
    console.log(`  usage: in=${usageMeta.promptTokenCount ?? "?"} out=${usageMeta.candidatesTokenCount ?? "?"}`);

    const text = response.text();
    let parsed;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch (e) {
      console.error(`  !! JSON parse failed: ${e.message}`);
      log.done[lessonSpec.id] = true;
      log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, usage: usageMeta, error: "parse_failed" });
      fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
      continue;
    }

    const topic = parsed.topic ?? subjectName;
    usedTopicsByKey.set(key, [...usedTopics, topic]);

    const { error: topicErr } = await db.from("lessons").update({ topic, title: topic }).eq("id", lessonSpec.id);
    if (topicErr) console.error(`  !! lesson topic update failed: ${topicErr.message}`);

    const stagesToInsert = [
      {
        position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation",
        title: parsed.theory.title, description: null, slides: parsed.theory.slides,
        difficulty: "medium", duration_min: STAGE_DURATIONS.theory,
      },
      {
        position: 2, stage_role: "middle", stage_type: "task", content_type: practiceKind,
        title: parsed.practice.title, description: parsed.practice.description, teacher_notes: parsed.practice.teacher_notes,
        ...(practiceKind === "code" ? { starter_code: parsed.practice.starter_code, programming_language: "python" } : {}),
        config: practiceKind === "code" ? {} : { url: "", requires_link: true, requires_screenshot: false },
        difficulty: "medium", duration_min: STAGE_DURATIONS.practice,
      },
      {
        position: 3, stage_role: "middle", stage_type: "task", content_type: "quiz_qia",
        title: parsed.quiz.title, description: null,
        config: { time_limit_minutes: null, points_per_question: 1 },
        difficulty: "medium", duration_min: STAGE_DURATIONS.quiz,
      },
    ];

    let quizStageId = null;
    let writeOk = true;
    for (const stage of stagesToInsert) {
      const { data: inserted, error: insErr } = await db
        .from("lesson_stages")
        .insert({ lesson_id: lessonSpec.id, ...stage })
        .select("id, content_type")
        .single();
      if (insErr) {
        console.error(`  !! stage insert failed (${stage.content_type}): ${insErr.message}`);
        writeOk = false;
        continue;
      }
      if (stage.content_type === "quiz_qia") quizStageId = inserted.id;
    }

    if (quizStageId && parsed.quiz.questions?.length) {
      const rows = parsed.quiz.questions.map((q, i) => ({
        stage_id: quizStageId, position: i, question_text: q.text, options: q.options,
        correct_option_index: q.correct_index, points: 1, time_per_question_seconds: 20,
      }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    }

    log.done[lessonSpec.id] = true;
    log.results.push({ id: lessonSpec.id, starts_at: lessonSpec.starts_at, subject: subjectName, group: groupName, topic, usage: usageMeta, writeOk });
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    console.log(`  ${writeOk ? "OK" : "PARTIAL"}: "${topic}"`);
    done++;
  }

  console.log(`\n=== БАТЧ ЗАВЕРШЁН. В этом запуске сгенерировано: ${done}. Осталось в очереди: ${pending.length - done} ===`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
