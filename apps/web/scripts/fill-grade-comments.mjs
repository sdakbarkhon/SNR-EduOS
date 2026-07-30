#!/usr/bin/env node
// Большой фикс, Блок 5, ФИКС 3 — ИИ-комментарий к каждой оценке lesson_grades.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
//
//   1) МИГРАЦИЯ НЕ НУЖНА — колонка lesson_grades.comment уже существует
//      (исходная CREATE TABLE, supabase/migrations/20260623000040_lesson_grades.sql)
//      и уже прокинута насквозь: getStudentGrades() (packages/core) уже
//      селектит и маппит comment → StudentGradeItem.comment,
//      GradeDetailModal.tsx (apps/web/app/(app)/grades/) уже рендерит
//      grade.comment в блоке "«...»" (просто показывает t.noComment,
//      пока пусто). Ни миграции, ни правок фронтенда — только бэкфилл.
//
//   2) "540 оценок" из промта — устарело: изначально create-grades-week.mjs
//      создал 540 (54 урока × 10 учеников), но демо-"сегодня" с тех пор
//      продвинулось (заморозка даты, см. resheniya_2.md) — сейчас 57
//      завершённых уроков → 553 живых lesson_grades. Скрипт считает
//      реальное количество на старте, не хардкодит 540.
//
//   3) Распределение оценок — не 30/40/25/5 из промта, а фактическое живое
//      (5→163, 4→219, 3→140, 2→31, 1→0 на момент разведки) — комментарии
//      генерируются ПУЛОМ на каждый РЕАЛЬНО существующий тир (5/4/3/2),
//      без тира 1 (нет таких строк).
//
// СТОИМОСТЬ: 4 вызова Gemini (по одному на тир 5/4/3/2, не на строку) —
// пул из VARIANTS_PER_TIER коротких вариантов на тир, дальше локальный
// pick() на каждую из ~553 строк. Тот же паттерн, что fill-project-comments.mjs
// (9 вызовов на 450 строк) — доли цента.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fill-grade-comments.mjs

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

const VARIANTS_PER_TIER = 10;
const TONE_BY_GRADE = {
  5: "похвала — искренне, конкретно, без канцелярита",
  4: "конструктив — похвали, но мягко укажи что можно улучшить (\"хорошо, обрати внимание на...\")",
  3: "мотивация — по-доброму, без осуждения (\"есть над чем работать\")",
  2: "поддержка — тема сложная, предложи разобраться вместе, никакого стыда",
  1: "поддержка — тема далась тяжело, акцент на том, что это нормально и можно наверстать",
};

// ── throttle + модель + retry (зеркалит fill-project-comments.mjs) ──
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

function systemPromptFor(grade) {
  return `Ты школьный учитель. Придумай ${VARIANTS_PER_TIER} коротких вариантов комментария к
оценке ${grade} (из 5) за урок — тон: ${TONE_BY_GRADE[grade]}. 10-20 слов каждый,
обращение к ученику на "ты", без канцелярита, разные формулировки (не
парафразы друг друга).

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{ "comments": ["...", "..."] }`;
}

function validate(parsed) {
  const comments = Array.isArray(parsed?.comments)
    ? parsed.comments.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
    : [];
  return comments.length ? comments : null;
}

async function main() {
  console.log(`Комментарии к оценкам (lesson_grades) — демо-школа (${SCHOOL_ID})\n`);

  const { data: rows, error } = await db.from("lesson_grades")
    .select("id, grade, comment").eq("school_id", SCHOOL_ID);
  if (error) fail(`Ошибка запроса lesson_grades: ${error.message}`);

  const needsComment = rows.filter((r) => !r.comment);
  console.log(`Всего lesson_grades: ${rows.length}. Без комментария: ${needsComment.length}.`);
  if (!needsComment.length) { console.log("Уже всё заполнено, выходим."); return; }

  const byGrade = new Map();
  for (const r of needsComment) {
    if (!byGrade.has(r.grade)) byGrade.set(r.grade, []);
    byGrade.get(r.grade).push(r);
  }
  const tiers = [...byGrade.keys()].sort((a, b) => b - a);
  console.log(`Тиры, требующие пула: ${tiers.map((g) => `${g}(${byGrade.get(g).length})`).join(", ")}\n`);

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let geminiCalls = 0, totalFilled = 0;

  for (const grade of tiers) {
    const groupRows = byGrade.get(grade);
    let pool = null;
    for (let attempt = 0; attempt < 2 && !pool; attempt++) {
      geminiCalls++;
      let response;
      try {
        response = await callGeminiWithRetry(systemPromptFor(grade), `Оценка: ${grade}`);
      } catch (e) {
        if (e.isDailyQuota) { console.warn(`  [grade=${grade}] → ДНЕВНОЙ ЛИМИТ — остановка.`); return; }
        console.error(`  [grade=${grade}] → ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
        continue;
      }
      let parsed;
      try { parsed = JSON.parse(stripFences(response.text())); }
      catch { console.error(`  [grade=${grade}] → ERROR (JSON parse, попытка ${attempt + 1})`); continue; }
      pool = validate(parsed);
      if (!pool) console.error(`  [grade=${grade}] → ERROR (валидация не прошла, попытка ${attempt + 1})`);
    }
    if (!pool) { console.error(`  [grade=${grade}] → ПРОПУСК (не удалось сгенерировать пул)`); continue; }

    let ok = 0;
    for (const row of groupRows) {
      const { error: updErr } = await db.from("lesson_grades").update({ comment: pick(pool) }).eq("id", row.id);
      if (updErr) { console.error(`  !! update failed (${row.id}): ${updErr.message}`); continue; }
      ok++;
    }
    totalFilled += ok;
    console.log(`  [grade=${grade}] → OK (${ok}/${groupRows.length}, пул из ${pool.length})`);
  }

  console.log(`\nГотово: вызовов Gemini ${geminiCalls}, заполнено комментариев ${totalFilled}.`);

  const { count: total } = await db.from("lesson_grades").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: withComment } = await db.from("lesson_grades").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).not("comment", "is", null);
  console.log(`\nПроверка: lesson_grades всего — ${total}, с комментарием — ${withComment}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
