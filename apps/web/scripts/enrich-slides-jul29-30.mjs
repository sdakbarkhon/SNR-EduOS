#!/usr/bin/env node
// Большой фикс, Блок 6, ЗАДАЧА 2 — визуальное обогащение слайдов теории для
// уроков 29-30 июля (демо-дни). БЕЗ картинок (Pollinations.ai нестабилен,
// явно исключено промтом) — только фон/шрифт/иконка/мини-квиз.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
//   1) "32-48 этапов" промта — устарело. Живых content_type='presentation'
//      lesson_stages на 29-30 июля: считаем реальное число на старте (не
//      хардкодим) — по факту разведки ~120 этапов / ~387 слайдов (36 уроков ×
//      2-4 presentation-этапа: "Изучение материала"+"Итог урока" всегда,
//      + "Демонстрация учителя"+"Практическая работа" тоже presentation
//      только у Математики/Английского/Русского — у Программирования/
//      Робототехники это code/wokwi, не слайды).
//   2) СТОИМОСТЬ: background_color/title_font/icon — ДЕТЕРМИНИРОВАННО, без
//      Gemini (0 вызовов, 0$) — палитра по классу (3-А пастель / 7-А средние
//      тона / 10-А минимализм), title_font="fancy" на все заголовки (тело
//      остаётся обычным — ровно как просил промт: "fancy для заголовков,
//      обычный для текста"), icon по точному названию этапа. Gemini — ТОЛЬКО
//      для mini_quiz, и ТОЛЬКО на этапе "Изучение материала" (1 на урок, не
//      на слайд) — 36 вызовов, а не 120+. Квиз крепится к ПОСЛЕДНЕМУ слайду
//      этого этапа.
//   3) MERGE, не REPLACE — как generate-lessons-jul18-25.ts:235 — берём
//      существующий slide целиком ({...slide}) и только добавляем новые
//      поля. title/content ИИ никогда не трогает и не переписывает.
//   4) Идемпотентно: этап пропускается целиком, если первый слайд уже имеет
//      background_color (значит уже обогащён этим скриптом).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/enrich-slides-jul29-30.mjs [--dry-run]

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const DRY_RUN = process.argv.includes("--dry-run");

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
if (!DRY_RUN && !GEMINI_API_KEY) { console.error("FATAL: GEMINI_API_KEY отсутствует в .env.local."); process.exit(1); }
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const START_DATE = "2026-07-29";
const END_DATE = "2026-07-30"; // включительно
const TZ_OFFSET = "+05:00";
const QUIZ_STAGE_TITLE = "Изучение материала";

// ── палитра по классу (пастель 3-А / средние тона 7-А / минимализм 10-А) ──
const PALETTE_BY_TIER = {
  "3-А": ["#fef3c7", "#fce7f3", "#e0f2fe", "#dcfce7", "#ede9fe"],
  "7-А": ["#bfdbfe", "#bbf7d0", "#fde68a", "#ddd6fe", "#fecaca"],
  "10-А": ["#f1f5f9", "#f8fafc", "#f4f4f5", "#eef2ff", "#f0fdfa"],
};
function tierFromGroupName(groupName) {
  for (const tier of Object.keys(PALETTE_BY_TIER)) {
    if ((groupName ?? "").startsWith(tier)) return tier;
  }
  return "7-А"; // fallback — не должно случаться на живых данных демо-школы
}

const ICON_BY_STAGE_TITLE = {
  "Изучение материала": "BookOpen",
  "Демонстрация учителя": "Lightbulb",
  "Практическая работа": "Target",
  "Итог урока": "Rocket",
};
function iconFor(stageTitle) {
  return ICON_BY_STAGE_TITLE[stageTitle] ?? "BookOpen";
}

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

const QUIZ_SYSTEM_PROMPT = `Ты школьный учитель. Тебе даётся содержимое этапа "Изучение материала"
одного урока (набор слайдов: заголовок + текст). Придумай ОДИН короткий
мини-квиз (1 вопрос, 4 варианта, один правильный) для проверки, усвоил ли
ученик именно этот материал — вопрос должен быть конкретным по содержанию
слайдов, не общего характера.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{ "question": "...", "options": ["...", "...", "...", "..."], "correct": 0 }`;

function buildQuizUserPrompt(slides) {
  const body = slides.map((s, i) => `Слайд ${i + 1}: "${s.title}"\n${s.content}`).join("\n\n");
  return `СЛАЙДЫ ЭТАПА:\n\n${body}`;
}
function validateQuiz(parsed) {
  const question = typeof parsed?.question === "string" && parsed.question.trim() ? parsed.question.trim() : null;
  const options = Array.isArray(parsed?.options)
    ? parsed.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
    : [];
  const correct = Number.isInteger(parsed?.correct) ? parsed.correct : null;
  if (!question || options.length !== 4 || correct === null || correct < 0 || correct >= options.length) return null;
  return { question, options, correct };
}

async function main() {
  console.log(`Обогащение слайдов (29-30 июля) — демо-школа (${SCHOOL_ID})${DRY_RUN ? " [DRY RUN]" : ""}\n`);

  const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
  const rangeEndExclIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, group:groups(name)")
    .eq("school_id", SCHOOL_ID)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndExclIso);
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Уроков в диапазоне 29-30 июля: ${lessons.length}`);

  const tierByLessonId = new Map(lessons.map((l) => [l.id, tierFromGroupName(l.group?.name)]));
  const lessonIds = lessons.map((l) => l.id);
  if (!lessonIds.length) { console.log("Нет уроков — нечего делать."); return; }

  const { data: stages, error: sErr } = await db
    .from("lesson_stages")
    .select("id, lesson_id, title, slides")
    .in("lesson_id", lessonIds)
    .eq("content_type", "presentation");
  if (sErr) fail(`Ошибка запроса lesson_stages: ${sErr.message}`);

  const totalSlides = stages.reduce((n, s) => n + (Array.isArray(s.slides) ? s.slides.length : 0), 0);
  console.log(`Presentation-этапов: ${stages.length}. Слайдов всего: ${totalSlides}.`);

  const pending = stages.filter((s) => {
    const first = Array.isArray(s.slides) ? s.slides[0] : null;
    return first && !first.background_color;
  });
  const quizStagesPending = pending.filter((s) => s.title === QUIZ_STAGE_TITLE);
  console.log(`Уже обогащено (пропуск): ${stages.length - pending.length}. К обогащению: ${pending.length} (из них с мини-квизом: ${quizStagesPending.length}).\n`);

  if (DRY_RUN) { console.log("DRY RUN — без записи, без вызовов Gemini."); return; }
  if (!pending.length) { console.log("Всё уже обогащено, выходим."); return; }

  if (quizStagesPending.length) {
    modelName = await pickWorkingModel();
    if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");
  }

  let stagesDone = 0, slidesDone = 0, quizCalls = 0, quizOk = 0, errors = 0;

  for (const [i, stage] of pending.entries()) {
    const tier = tierByLessonId.get(stage.lesson_id) ?? "7-А";
    const palette = PALETTE_BY_TIER[tier];
    const icon = iconFor(stage.title);
    const slides = stage.slides;

    let miniQuiz = null;
    if (stage.title === QUIZ_STAGE_TITLE) {
      quizCalls++;
      let v = null;
      for (let attempt = 0; attempt < 2 && !v; attempt++) {
        let response;
        try {
          response = await callGeminiWithRetry(QUIZ_SYSTEM_PROMPT, buildQuizUserPrompt(slides));
        } catch (e) {
          if (e.isDailyQuota) { console.warn(`  [${i + 1}/${pending.length}] ДНЕВНОЙ ЛИМИТ — остановка.`); break; }
          console.error(`  [${i + 1}/${pending.length}] квиз ERROR (Gemini: ${(e.message ?? "").split("\n")[0]})`);
          continue;
        }
        let parsed;
        try { parsed = JSON.parse(stripFences(response.text())); }
        catch { console.error(`  [${i + 1}/${pending.length}] квиз ERROR (JSON parse, попытка ${attempt + 1})`); continue; }
        v = validateQuiz(parsed);
        if (!v) console.error(`  [${i + 1}/${pending.length}] квиз ERROR (валидация, попытка ${attempt + 1})`);
      }
      if (v) { miniQuiz = v; quizOk++; }
    }

    const newSlides = slides.map((slide, si) => {
      const enriched = {
        ...slide,
        background_color: palette[si % palette.length],
        title_font: "fancy",
        icon,
      };
      // 08.08.2026 — мини-опрос на последнем слайде больше не ставится:
      // решение заказчика убрать их из презентаций совсем. Строка оставлена
      // закомментированной как след того, откуда они брались.
      // if (miniQuiz && si === slides.length - 1) enriched.mini_quiz = miniQuiz;
      return enriched;
    });

    const { error: updErr } = await db.from("lesson_stages").update({ slides: newSlides }).eq("id", stage.id);
    if (updErr) { console.error(`  !! update failed (${stage.id}): ${updErr.message}`); errors++; continue; }
    stagesDone++;
    slidesDone += newSlides.length;
    console.log(`  [${i + 1}/${pending.length}] "${stage.title}" (${tier}) → OK (${newSlides.length} слайдов${miniQuiz ? ", +мини-квиз" : ""})`);
  }

  console.log(`\nГотово: этапов обогащено ${stagesDone}, слайдов ${slidesDone}, ошибок ${errors}.`);
  console.log(`Мини-квиз: попыток ${quizCalls}, успешно ${quizOk} (вызовов Gemini: ${quizCalls}).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
