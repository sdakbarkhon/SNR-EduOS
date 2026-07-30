#!/usr/bin/env node
// Большой фикс, Блок 6.5, ЧАСТЬ B — новый этап "code_completion" (Drag &
// Drop заполнение пропусков) в конце уроков программирования 29-30 июля.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
//
//   1) "lessons WHERE content_type='programming'" — у lessons НЕТ колонки
//      content_type (это поле lesson_stages/homework). "Программирование"
//      — предмет, определяется через lessons.subject_id -> subjects.name.
//
//   2) "position = max+1 или position=6" — не так: каждый урок УЖЕ имеет
//      фиксированный паттерн position 0(start)/1-4(middle)/9999(summary,
//      сентинел от триггера fn_create_default_stages). Наивный MAX(position)+1
//      дал бы 10000 — этап отрендерился бы ПОСЛЕ "Итог урока". Правильно:
//      MAX(position) СРЕДИ stage_role='middle' (сейчас 4) + 1 = 5.
//
//   3) Колонки "payload" на lesson_stages НЕТ — используем существующую
//      config jsonb (см. migration 159).
//
//   4) Требуется миграция 159 (content_type CHECK на lesson_stages не
//      включает 'code_completion' без неё) — ЕСЛИ она ещё не применена,
//      INSERT упадёт на constraint violation; скрипт это обнаруживает и
//      останавливается с понятным сообщением, не оставляя частичных данных.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-code-completion.mjs

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

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

const DAY_FROM = "2026-07-29T00:00:00+05:00";
const DAY_TO = "2026-07-31T00:00:00+05:00"; // строго < — конец 30 июля по Ташкенту

// ── throttle + модель + retry (зеркалит fill-grade-comments.mjs) ──
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

const LEVEL_SPEC = {
  "3-А класс": {
    lines: "5-10", gaps: "3-5",
    extra: "Только простейшие конструкции: print(), переменные, простая арифметика. НЕ используй классы/декораторы/сложную логику.",
  },
  "7-А класс": {
    lines: "8-15", gaps: "5-8",
    extra: "Операторы, циклы for/while, функции с аргументами, условия. Средняя сложность.",
  },
  "10-А класс": {
    lines: "12-20", gaps: "7-10",
    extra: "Продвинутый уровень: классы, self, def, return, наследование, декораторы, операторы сравнения, сложные условия — сложнее, чем в простых примерах.",
  },
};

function systemPromptFor(className, topic) {
  const spec = LEVEL_SPEC[className];
  return `Ты школьный учитель Python. Создай упражнение "заполни пропуск в коде" по
теме урока "${topic}" для класса "${className}".

Код должен быть ${spec.lines} строк, ${spec.gaps} пропусков. Каждый пропуск имеет
4 варианта (1 правильный + 3 правдоподобных, но ошибочных). ${spec.extra}

Пропуски в коде обозначай литерально как __GAP1__, __GAP2__ и т.д. (ровно в
таком формате, с двумя подчёркиваниями с каждой стороны).

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{
  "code_template": "код с __GAP1__, __GAP2__ и т.д.",
  "gaps": [
    { "id": "GAP1", "correct": "...", "options": ["...", "...", "...", "..."] }
  ],
  "language": "python",
  "task_description": "короткое описание (1 предложение) что должен делать код"
}`;
}

function validate(parsed) {
  if (typeof parsed?.code_template !== "string" || !parsed.code_template.trim()) return null;
  if (!Array.isArray(parsed?.gaps) || parsed.gaps.length < 3) return null;
  for (const g of parsed.gaps) {
    if (typeof g?.id !== "string" || typeof g?.correct !== "string") return null;
    if (!Array.isArray(g?.options) || g.options.length < 2) return null;
    if (!g.options.includes(g.correct)) return null;
    if (!parsed.code_template.includes(`__${g.id}__`)) return null;
  }
  return {
    code_template: parsed.code_template.trim(),
    gaps: parsed.gaps.map((g) => ({ id: g.id, correct: g.correct, options: g.options })),
    language: typeof parsed.language === "string" && parsed.language.trim() ? parsed.language.trim() : "python",
    task_description: typeof parsed.task_description === "string" ? parsed.task_description.trim() : undefined,
  };
}

async function main() {
  console.log(`Этап code_completion — уроки программирования 29-30 июля — демо-школа (${SCHOOL_ID})\n`);

  const { data: progSubjects, error: subErr } = await db.from("subjects")
    .select("id, group_id, group:groups(name)").eq("name", "Программирование").eq("school_id", SCHOOL_ID);
  if (subErr) fail(`Ошибка запроса subjects: ${subErr.message}`);
  const subjectIds = progSubjects.map((s) => s.id);
  const classByGroupId = new Map(progSubjects.map((s) => [s.group_id, s.group?.name ?? "?"]));

  const { data: lessons, error: lErr } = await db.from("lessons")
    .select("id, group_id, subject_id, topic, title, starts_at")
    .eq("school_id", SCHOOL_ID).in("subject_id", subjectIds)
    .gte("starts_at", DAY_FROM).lt("starts_at", DAY_TO);
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Уроков программирования 29-30 июля: ${lessons.length}.\n`);

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let geminiCalls = 0, created = 0, skipped = 0, migrationBlocked = false;

  for (const lesson of lessons) {
    const className = classByGroupId.get(lesson.group_id) ?? "?";
    const topic = lesson.topic ?? lesson.title ?? "Python";
    const logPrefix = `  [${className} · ${topic}]`;

    const { data: stages, error: stErr } = await db.from("lesson_stages")
      .select("id, position, stage_role, content_type").eq("lesson_id", lesson.id);
    if (stErr) { console.error(`${logPrefix} → ERROR (stages: ${stErr.message})`); continue; }

    if (stages.some((s) => s.content_type === "code_completion")) {
      console.log(`${logPrefix} → ПРОПУСК (уже есть этап code_completion)`);
      skipped++;
      continue;
    }
    const middlePositions = stages.filter((s) => s.stage_role === "middle").map((s) => s.position);
    const newPosition = (middlePositions.length ? Math.max(...middlePositions) : 0) + 1;

    let v = null;
    for (let attempt = 0; attempt < 2 && !v; attempt++) {
      geminiCalls++;
      let response;
      try {
        response = await callGeminiWithRetry(systemPromptFor(className, topic), `Класс: ${className}\nТема урока: ${topic}`);
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

    const { error: insErr } = await db.from("lesson_stages").insert({
      lesson_id: lesson.id,
      position: newPosition,
      stage_role: "middle",
      stage_type: "task",
      content_type: "code_completion",
      title: "Код с пропусками",
      description: v.task_description ?? null,
      config: { code_template: v.code_template, gaps: v.gaps, language: v.language, task_description: v.task_description },
      school_id: SCHOOL_ID,
    });
    if (insErr) {
      const isMigrationGap = insErr.code === "23514" || insErr.code === "PGRST204"
        || /could not find.*column/i.test(insErr.message ?? "");
      if (isMigrationGap) {
        console.error(`${logPrefix} → ОШИБКА (миграция 159 ещё не применена к БД): ${insErr.message}`);
        migrationBlocked = true;
        break;
      }
      console.error(`${logPrefix} → ОШИБКА insert: ${insErr.message}`);
      continue;
    }
    created++;
    console.log(`${logPrefix} → OK (position ${newPosition}, ${v.gaps.length} пропусков)`);
  }

  if (migrationBlocked) {
    fail("Миграция 159_code_completion_type.sql не применена к прод-базе (CHECK constraint блокирует content_type='code_completion'). Заказчик должен применить её через Supabase Dashboard → SQL Editor, затем перезапустить этот скрипт — он идемпотентен (пропускает уроки, где этап уже есть).");
  }

  console.log(`\nГотово: создано этапов ${created}, пропущено (уже было) ${skipped}, вызовов Gemini ${geminiCalls}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
