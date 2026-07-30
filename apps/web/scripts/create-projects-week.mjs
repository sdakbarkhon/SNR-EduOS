#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 10 — проекты: AI-контент для "своих" проектов +
// 100% сдано у всех 30 учеников. "Внешние" проекты НЕ трогаем — см. ниже.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки схемы + чтения уже существующего
// apps/web/scripts/reset-projects.mjs, написанного и запущенного РАНЬШЕ в
// этой же сессии):
//
//   1) НЕТ полей code/progress/status/project_type НИ на projects, НИ на
//      project_submissions (проверено live через database.types.ts).
//      Реальная схема (4 таблицы, supabase/migrations/20260619000033_projects.sql):
//        projects              — каталог: title, description, group_id, subject, created_by.
//        project_stages        — 5 générик-этапов НА ПРОЕКТ (Понять задание →
//                                 Написать план → Написать код → Протестировать →
//                                 Показать учителю), НЕ на ученика.
//        project_submissions   — НА УЧЕНИКА: is_submitted (bool, НЕ "status"),
//                                 teacher_comment, grade/graded_at/graded_by. НЕТ code.
//        project_stage_progress — НА (submission × stage): is_completed,
//                                 completed_at, student_notes — код лежит ИМЕННО
//                                 здесь, в student_notes этапа "Написать код"
//                                 (position=2), а не в отдельном поле "code".
//      "100%" — не хранимое число, а ДОЛЯ is_completed=true этапов
//      (ProjectsView.tsx: percent = completedCount/stageCount) — для 100%
//      нужны все 5 project_stage_progress с is_completed=true.
//
//   2) "ВНЕШНИЕ" ПРОЕКТЫ НЕ ИМЕЮТ БД-БЭКИНГА ВООБЩЕ И УЖЕ ПОЛНОСТЬЮ ГОТОВЫ.
//      apps/web/app/(app)/projects/ProjectsView.tsx (EXTERNAL_PROJECTS_BY_CLASS,
//      строки 19-35) — статический каталог, всегда 0%/"Не начат", клик
//      открывает песочницу (Wokwi/GeoGebra/PhET). Титры ТОЧНО совпадают с
//      теми, что в этом промте ("Мигающий светодиод"/"График функции y=x"/
//      "Опыт с шариком" для 3-А и т.д.) — это уже было сделано в более
//      раннем заходе этой же сессии. Создавать под них project_submissions
//      НЕКУДА (нет строки в projects, не на что ставить project_id) и НЕ
//      НУЖНО (UI их не читает — всегда рендерит 0%/"Не начат" из
//      захардкоженного массива). Этот скрипт внешние проекты НЕ трогает.
//      Итог: 90 project_submissions (внутренние), а не 180 — 90 "внешних"
//      из промта физически невозможны в этой архитектуре.
//
//   3) "12 внутренних проектов" / "36 Gemini-вызовов" из сметы промта не
//      совпадает с собственным же списком промта (3 проекта × 3 класса = 9,
//      не 12). Используется реальная структура: 9 проектов, 9 Gemini-вызовов
//      (1 на проект, как и просил соседний абзац промта — "1 AI-запрос" на
//      "проект × уровень").
//
//   4) Каталог из 9 projects (+45 project_stages, по 5 на каждый) УЖЕ
//      существует — создан и реально запущен раньше (reset-projects.mjs,
//      CONFIRM=YES), названия совпадают 1:1 со списком этого промта.
//      Пересоздавать не нужно — этот скрипт берёт существующие project_id/
//      stage_id, обновляет description AI-контентом и добавляет сдачи.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-projects-week.mjs

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

const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];
const STAGE_TITLES = ["Понять задание", "Написать план", "Написать код", "Протестировать", "Показать учителю"];
const CODE_STAGE_POSITION = 2;

// Язык/тема на проект — только для промта Gemini (заголовки/класс — уже в БД).
const PROJECT_LANGUAGE = {
  "Мой первый Python скрипт": "Python", "Калькулятор": "Python", "Веб-страница о себе": "HTML/CSS",
  "Игра змейка на Python": "Python (Pygame)", "Мой сайт-визитка": "HTML/CSS/JavaScript", "Калькулятор функций на Python": "Python",
  "Игра на C++": "C++", "Веб-приложение на JavaScript": "JavaScript", "Анализ данных на Python": "Python",
};

const TEACHER_COMMENTS_POOL = [
  "Отличная работа! Код чистый и рабочий.",
  "Хорошо сделано, видно, что тема понята.",
  "Молодец, задание выполнено полностью.",
  "Хорошая работа, но в следующий раз добавь больше комментариев в код.",
  "Всё получилось, поздравляю!",
  "Аккуратное решение, так держать!",
  "Проект зачтён, приятно было проверять.",
  "Отлично справился с задачей!",
  "Видна самостоятельная работа, молодец.",
  "Хороший результат, продолжай в том же духе.",
];

// ── throttle + модель + retry (зеркалит generate-stages-jul28-30.mjs / create-homework-week.mjs) ──
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

const SYSTEM_PROMPT = `Ты школьный учитель. Тебе даётся класс, язык программирования и название
проекта. Создай содержательное наполнение проекта.

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON):
{
  "description": "описание в Markdown: цель, что научится, результат. 100-200 слов",
  "code": "реальный рабочий код на нужном языке (30-100 строк) с комментариями на русском",
  "teacher_comment_template": "короткий положительный комментарий учителя, 15-25 слов"
}

ПРАВИЛА:
- Код должен быть ПОЛНОСТЬЮ рабочим и соответствовать названию проекта, не общий пример.
- Сложность — под класс (3 = начальная школа, простой код; 7 = средняя; 10 = старшая, продвинуто).
- Только валидный JSON.`;

function validate(parsed) {
  const description = typeof parsed?.description === "string" && parsed.description.trim().length >= 80 ? parsed.description.trim() : null;
  const code = typeof parsed?.code === "string" && parsed.code.trim().length >= 20 ? parsed.code.trim() : null;
  const comment = typeof parsed?.teacher_comment_template === "string" && parsed.teacher_comment_template.trim() ? parsed.teacher_comment_template.trim() : null;
  if (!description || !code || !comment) return null;
  return { description, code, comment };
}

async function main() {
  console.log(`Проекты — AI-контент + сдачи всех учеников — демо-школа (${SCHOOL_ID})\n`);

  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  const groupIds = groups.map((g) => g.id);

  const { data: projects, error: pErr } = await db.from("projects").select("id, title, group_id, description").in("group_id", groupIds);
  if (pErr) fail(`Ошибка запроса projects: ${pErr.message}`);
  console.log(`Проектов в каталоге (3 группы): ${projects.length} (ожидание 9).`);
  if (projects.length !== 9) console.warn(`  !! Ожидалось 9 (3×3) — проверь, что reset-projects.mjs был запущен раньше.`);

  const { data: stages, error: sErr } = await db.from("project_stages").select("id, project_id, position").in("project_id", projects.map((p) => p.id));
  if (sErr) fail(`Ошибка запроса project_stages: ${sErr.message}`);
  const stagesByProject = new Map();
  for (const s of stages) {
    if (!stagesByProject.has(s.project_id)) stagesByProject.set(s.project_id, []);
    stagesByProject.get(s.project_id).push(s);
  }
  for (const p of projects) {
    const ps = stagesByProject.get(p.id) ?? [];
    if (ps.length !== STAGE_TITLES.length) fail(`У проекта "${p.title}" ${ps.length} этапов (ожидание ${STAGE_TITLES.length}) — проверь project_stages.`);
  }

  const { data: sgRows, error: sgErr } = await db.from("student_groups").select("student_id, group_id").in("group_id", groupIds);
  if (sgErr) fail(`Ошибка запроса student_groups: ${sgErr.message}`);
  const { data: studentsRaw, error: stErr } = await db.from("students").select("id, username").in("id", sgRows.map((r) => r.student_id));
  if (stErr) fail(`Ошибка запроса students: ${stErr.message}`);
  const usernameById = new Map(studentsRaw.map((s) => [s.id, s.username]));
  const studentsByGroup = new Map();
  for (const r of sgRows) {
    if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []);
    studentsByGroup.get(r.group_id).push(r.student_id);
  }
  for (const className of CLASS_NAMES) {
    const n = studentsByGroup.get(groupByName.get(className).id)?.length ?? 0;
    if (n !== 10) console.warn(`  !! Группа "${className}": ${n} учеников (ожидание 10).`);
  }

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let geminiCalls = 0, projectsUpdated = 0, submissionsCreated = 0, progressCreated = 0, skipped = 0;

  for (const project of projects) {
    const { count: existingSubs } = await db.from("project_submissions").select("*", { count: "exact", head: true }).eq("project_id", project.id);
    if ((existingSubs ?? 0) > 0) {
      console.log(`  [${project.title}] → ПРОПУСК (уже есть ${existingSubs} сдач)`);
      skipped++;
      continue;
    }

    const language = PROJECT_LANGUAGE[project.title] ?? "Python";
    const className = groups.find((g) => g.id === project.group_id)?.name ?? "?";
    const userPrompt = `Класс: ${className}\nЯзык/технология: ${language}\nНазвание проекта: "${project.title}"`;
    const logPrefix = `  [${className} · ${project.title}]`;

    let v = null;
    for (let attempt = 0; attempt < 2 && !v; attempt++) {
      geminiCalls++;
      let response;
      try {
        response = await callGeminiWithRetry(SYSTEM_PROMPT, userPrompt);
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

    const { error: updErr } = await db.from("projects").update({ description: v.description }).eq("id", project.id);
    if (updErr) { console.error(`${logPrefix} → ОШИБКА update description: ${updErr.message}`); continue; }
    projectsUpdated++;

    const projectStages = stagesByProject.get(project.id);
    const codeStage = projectStages.find((s) => s.position === CODE_STAGE_POSITION);
    const commentPool = [...TEACHER_COMMENTS_POOL, v.comment];

    const studentIds = studentsByGroup.get(project.group_id) ?? [];
    let okCount = 0;
    for (const studentId of studentIds) {
      const { data: sub, error: subErr } = await db.from("project_submissions").insert({
        school_id: SCHOOL_ID,
        project_id: project.id,
        student_id: studentId,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
        teacher_comment: pick(commentPool),
      }).select("id").single();
      if (subErr) { console.error(`  !! project_submissions insert failed (${usernameById.get(studentId)}): ${subErr.message}`); continue; }
      submissionsCreated++;

      const progressRows = projectStages.map((s) => ({
        school_id: SCHOOL_ID,
        submission_id: sub.id,
        stage_id: s.id,
        is_completed: true,
        completed_at: new Date().toISOString(),
        student_notes: s.id === codeStage.id ? v.code : null,
      }));
      const { error: progErr } = await db.from("project_stage_progress").insert(progressRows);
      if (progErr) { console.error(`  !! project_stage_progress insert failed (${usernameById.get(studentId)}): ${progErr.message}`); continue; }
      progressCreated += progressRows.length;
      okCount++;
    }
    console.log(`${logPrefix} → OK (${okCount}/${studentIds.length} учеников, 100% сдано)`);
  }

  console.log(`\nГотово: обновлено проектов ${projectsUpdated}, пропущено (уже было) ${skipped}, вызовов Gemini ${geminiCalls}.`);
  console.log(`project_submissions создано: ${submissionsCreated}. project_stage_progress создано: ${progressCreated}.`);

  const { count: subTotal } = await db.from("project_submissions").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { data: subAll } = await db.from("project_submissions").select("is_submitted").eq("school_id", SCHOOL_ID);
  const submittedCount = subAll.filter((r) => r.is_submitted).length;
  const { count: progressTotal } = await db.from("project_stage_progress").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: codeCount } = await db.from("project_stage_progress").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).not("student_notes", "is", null);

  console.log(`\nПроверка: project_submissions всего — ${subTotal} (ожидание 90 = 9 проектов × 10 учеников).`);
  console.log(`is_submitted=true: ${submittedCount} (ожидание = всего, 100%).`);
  console.log(`project_stage_progress всего — ${progressTotal} (ожидание 450 = 90 × 5 этапов).`);
  console.log(`project_stage_progress с кодом (student_notes not null) — ${codeCount} (ожидание 90 = 1 на сдачу, этап "Написать код").`);
}

main().catch((e) => fail(e.stack ?? String(e)));
