#!/usr/bin/env node
// Большой фикс, Блок 6.5, ЧАСТЬ B (окончание) — 5 новых ДЗ "code_completion"
// на класс (15 всего), плюс сдачи всех учеников по стандартному
// распределению.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
//
//   1) На homework НЕТ generic jsonb-колонки под тип (в отличие от
//      lesson_stages.config) — данные упражнения (code_template/gaps/
//      language) идут в новую выделенную колонку code_completion_data
//      (миграция 159). Ответы ученика — в новую homework_submissions.
//      code_completion_answers (та же миграция); ai_feedback НЕ
//      переиспользован — та колонка под другую фичу (ИИ-проверка,
//      миграция 140).
//
//   2) Учитель — читается ЖИВЬЁМ из subjects.teacher_id для каждого
//      класса (не хардкод) — на деле один и тот же учитель
//      (teacher_prog) ведёт "Программирование" во всех 3 классах.
//
//   3) "Стандартное распределение" — зеркалит fix-homework-uniform.mjs
//      (актуальная живая конвенция этой сессии, не GRADE_PROFILES из
//      _backfill-shared.mjs, которые используются только для 6 именных
//      "реальных" учеников в других скриптах): ВСЕ ученики сдают, ВСЕ
//      сразу оценены (status='graded'). В отличие от того скрипта, здесь
//      ответы/оценка не произвольны — они РЕАЛЬНО согласованы: 80%
//      учеников получают все пропуски верно (grade 5), 20% — часть
//      пропусков неверно (grade согласно фактическому score/total, той же
//      формулой, что submitCodeCompletionHomework() в packages/core).
//
//   4) Требуется миграция 159 — без неё INSERT в homework с
//      content_type='code_completion' упадёт на CHECK constraint; скрипт
//      это обнаруживает и останавливается с понятным сообщением.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-code-completion-homework.mjs

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID, pick } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

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

const DUE_DATE_ISO = "2026-08-02T23:59:00+05:00"; // тот же due_date, что у остального демо-набора ДЗ (create-homework-week.mjs)

const TOPICS_BY_CLASS = {
  "3-А класс": ["Вывод текста на экран", "Простые вычисления", "Переменные и типы данных", "Первая программа на Python", "Работа с числами"],
  "7-А класс": ["Циклы и повторения", "Функции с параметрами", "Списки и их обработка", "Условные операторы", "Строки и их методы"],
  "10-А класс": ["Классы и объекты", "Наследование классов", "Декораторы функций", "Обработка исключений", "Магические методы класса"],
};
const LEVEL_SPEC = {
  "3-А класс": { lines: "8-12", gaps: "4-6", extra: "Только простейшие конструкции: print(), переменные, простая арифметика. НЕ используй классы/декораторы." },
  "7-А класс": { lines: "12-18", gaps: "6-9", extra: "Операторы, циклы, функции с аргументами, списки, условия — сложнее, чем базовый уровень." },
  "10-А класс": { lines: "15-20", gaps: "8-10", extra: "Продвинутый уровень: классы, self, def, return, наследование, декораторы, обработка исключений — сложнее простых примеров." },
};

// ── throttle + модель + retry (зеркалит fill-grade-comments.mjs) ──
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

function systemPromptFor(className, topic, spec) {
  return `Ты школьный учитель Python. Создай домашнее задание "заполни пропуск в
коде" по теме "${topic}" для класса "${className}". Сложнее, чем упражнение
на уроке — это ДОМАШНЕЕ задание.

Код должен быть ${spec.lines} строк, ${spec.gaps} пропусков. Каждый пропуск имеет
4 варианта (1 правильный + 3 правдоподобных ошибочных). ${spec.extra}

ЯЗЫК В КОДЕ (строго):
- Имена переменных, функций и любые идентификаторы — ТОЛЬКО НА АНГЛИЙСКОМ
  (name, sum, num1, num2, total, count, result, teacher_name...). Никакой
  кириллицы в идентификаторах — ни в коде, ни в вариантах ответов.
- Строковые литералы внутри "..." — МОЖНО и НУЖНО на русском.
- Комментарии после # — можно на русском.
Пример правильного стиля:
    teacher_name = "Марина"
    print("Меня зовут", teacher_name)
    num1 = 10
    total = num1 + num2
    print("Сумма чисел:", total)  # выводим результат

Пропуски обозначай литерально как __GAP1__, __GAP2__ и т.д.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{
  "title": "короткое название задания без кавычек",
  "code_template": "код с __GAP1__, __GAP2__ и т.д.",
  "gaps": [
    { "id": "GAP1", "correct": "...", "options": ["...", "...", "...", "..."] }
  ],
  "language": "python",
  "task_description": "инструкция ученику, 1-2 предложения"
}`;
}

const CYRILLIC = /[Ѐ-ӿ]/;

/** Код без строковых литералов и комментариев — там кириллицы быть не должно
 *  (идентификаторы только английские). Внутри "..." и после # — можно. */
function codeWithoutTextLiterals(code) {
  return code
    .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, "")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "")
    .replace(/#[^\n]*/g, "")
    .replace(/\/\/[^\n]*/g, "");
}

/** Промт может не послушаться — проверяем фактически, а не на доверии.
 *  ВАЖНО: к вариантам ответа применяется та же логика, что к коду. Вариант
 *  вроде "пять" (строковый литерал с русским текстом) — ЛЕГИТИМЕН, это не
 *  имя переменной. Первая версия проверки резала такие варианты и
 *  забраковала половину сгенерированного — отсюда отдельный strip. */
function hasCyrillicIdentifiers(payload) {
  if (CYRILLIC.test(codeWithoutTextLiterals(payload.code_template))) return true;
  return payload.gaps.some((g) => g.options.some((o) => CYRILLIC.test(codeWithoutTextLiterals(String(o)))));
}

function validate(parsed) {
  if (typeof parsed?.title !== "string" || !parsed.title.trim()) return null;
  if (typeof parsed?.code_template !== "string" || !parsed.code_template.trim()) return null;
  if (!Array.isArray(parsed?.gaps) || parsed.gaps.length < 3) return null;
  for (const g of parsed.gaps) {
    if (typeof g?.id !== "string" || typeof g?.correct !== "string") return null;
    if (!Array.isArray(g?.options) || g.options.length < 2) return null;
    if (!g.options.includes(g.correct)) return null;
    if (!parsed.code_template.includes(`__${g.id}__`)) return null;
  }
  if (hasCyrillicIdentifiers(parsed)) return null;
  return {
    title: parsed.title.trim(),
    code_template: parsed.code_template.trim(),
    gaps: parsed.gaps.map((g) => ({ id: g.id, correct: g.correct, options: g.options })),
    language: typeof parsed.language === "string" && parsed.language.trim() ? parsed.language.trim() : "python",
    task_description: typeof parsed.task_description === "string" ? parsed.task_description.trim() : undefined,
  };
}

function autoGradeFromRatio(score, total) {
  if (total === 0) return null;
  const ratio = score / total;
  if (ratio >= 0.85) return 5;
  if (ratio >= 0.70) return 4;
  if (ratio >= 0.50) return 3;
  return 2;
}

// 80% ученика решают всё верно, 20% — часть пропусков неверно (реально
// согласовано с оценкой, не произвольные числа).
function pickAnswersAndGrade(gaps) {
  const total = gaps.length;
  const excellent = Math.random() < 0.8;
  const wrongCount = excellent ? 0 : Math.max(1, Math.round(total * 0.25));
  const wrongIdx = new Set();
  while (wrongIdx.size < wrongCount) wrongIdx.add(Math.floor(Math.random() * total));
  const answers = {};
  gaps.forEach((g, i) => {
    if (wrongIdx.has(i)) {
      const wrongOpts = g.options.filter((o) => o !== g.correct);
      answers[g.id] = wrongOpts.length ? pick(wrongOpts) : g.correct;
    } else {
      answers[g.id] = g.correct;
    }
  });
  const score = gaps.filter((g) => answers[g.id] === g.correct).length;
  return { answers, score, total, grade: autoGradeFromRatio(score, total) };
}

async function main() {
  console.log(`ДЗ code_completion — 5 на класс — демо-школа (${SCHOOL_ID})\n`);

  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", Object.keys(TOPICS_BY_CLASS));
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);

  const { data: subjects, error: sErr } = await db.from("subjects")
    .select("id, group_id, teacher_id").eq("name", "Программирование").eq("school_id", SCHOOL_ID);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const subjectByGroupId = new Map(subjects.map((s) => [s.group_id, s]));

  const { data: sgRows, error: sgErr } = await db.from("student_groups").select("student_id, group_id").in("group_id", groups.map((g) => g.id));
  if (sgErr) fail(`Ошибка запроса student_groups: ${sgErr.message}`);
  const studentsByGroup = new Map();
  for (const r of sgRows) {
    if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []);
    studentsByGroup.get(r.group_id).push(r.student_id);
  }

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let geminiCalls = 0, homeworkCreated = 0, homeworkSkipped = 0, submissionsCreated = 0, migrationBlocked = false;

  for (const group of groups) {
    const subject = subjectByGroupId.get(group.id);
    if (!subject) { console.warn(`  !! "${group.name}": не найден предмет "Программирование" — пропуск.`); continue; }
    const spec = LEVEL_SPEC[group.name];
    const topics = TOPICS_BY_CLASS[group.name];
    const studentIds = studentsByGroup.get(group.id) ?? [];

    const { count: existingCount } = await db.from("homework").select("*", { count: "exact", head: true })
      .eq("group_id", group.id).eq("content_type", "code_completion");
    if ((existingCount ?? 0) >= topics.length) {
      console.log(`  ["${group.name}"] → ПРОПУСК (уже есть ${existingCount} ДЗ code_completion, цель ${topics.length})`);
      homeworkSkipped += topics.length;
      continue;
    }

    for (const topic of topics) {
      const logPrefix = `  [${group.name} · ${topic}]`;

      let v = null;
      for (let attempt = 0; attempt < 2 && !v; attempt++) {
        geminiCalls++;
        let response;
        try {
          response = await callGeminiWithRetry(systemPromptFor(group.name, topic, spec), `Класс: ${group.name}\nТема: ${topic}`);
        } catch (e) {
          if (e.isDailyQuota) { console.warn(`${logPrefix} → ДНЕВНОЙ ЛИМИТ — остановка.`); return; }
          console.error(`${logPrefix} → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
          continue;
        }
        let parsed;
        try { parsed = JSON.parse(stripFences(response.text())); }
        catch { console.error(`${logPrefix} → ERROR (JSON parse, попытка ${attempt + 1})`); continue; }
        v = validate(parsed);
        if (!v) console.error(`${logPrefix} → ERROR (валидация не прошла, попытка ${attempt + 1})`);
      }
      if (!v) { console.error(`${logPrefix} → ПРОПУСК (не удалось сгенерировать)`); continue; }

      const { data: hwRow, error: hwErr } = await db.from("homework").insert({
        group_id: group.id,
        subject_id: subject.id,
        teacher_id: subject.teacher_id,
        title: v.title,
        description: v.task_description ?? null,
        due_date: DUE_DATE_ISO,
        content_type: "code_completion",
        code_completion_data: { code_template: v.code_template, gaps: v.gaps, language: v.language, task_description: v.task_description },
        source: "teacher",
        school_id: SCHOOL_ID,
      }).select("id").single();
      if (hwErr) {
        // 23514 — CHECK constraint (колонка есть, значение запрещено).
        // PGRST204 / "Could not find ... column" — сама колонка ещё не
        // существует (миграция 159 не применена вообще, PostgREST не
        // видит её в schema cache) — этим и обернулся первый живой запуск
        // этого скрипта. Обе ошибки означают одно: миграция не применена.
        const isMigrationGap = hwErr.code === "23514" || hwErr.code === "PGRST204"
          || /could not find.*column/i.test(hwErr.message ?? "");
        if (isMigrationGap) {
          console.error(`${logPrefix} → ОШИБКА (миграция 159 ещё не применена к БД): ${hwErr.message}`);
          migrationBlocked = true;
          break;
        }
        console.error(`${logPrefix} → ОШИБКА insert homework: ${hwErr.message}`);
        continue;
      }
      homeworkCreated++;

      let subOk = 0;
      for (const studentId of studentIds) {
        const { answers, score, total, grade } = pickAnswersAndGrade(v.gaps);
        const { error: subErr } = await db.from("homework_submissions").insert({
          homework_id: hwRow.id,
          student_id: studentId,
          code_completion_answers: { answers, score, total },
          grade,
          status: "graded",
          submitted_at: new Date().toISOString(),
          school_id: SCHOOL_ID,
        });
        if (subErr) { console.error(`  !! submission insert failed (${studentId}): ${subErr.message}`); continue; }
        subOk++;
      }
      submissionsCreated += subOk;
      console.log(`${logPrefix} → OK ("${v.title}", ${v.gaps.length} пропусков, сдач ${subOk}/${studentIds.length})`);
    }
    if (migrationBlocked) break;
  }

  if (migrationBlocked) {
    fail("Миграция 159_code_completion_type.sql не применена к прод-базе (CHECK constraint блокирует content_type='code_completion' на homework). Заказчик должен применить её через Supabase Dashboard → SQL Editor, затем перезапустить этот скрипт.");
  }

  console.log(`\nГотово: ДЗ создано ${homeworkCreated} (ожидание 15 = 5 × 3 класса), пропущено ${homeworkSkipped}, сдач создано ${submissionsCreated}, вызовов Gemini ${geminiCalls}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
