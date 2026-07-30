#!/usr/bin/env node
// Большой фикс UI, ФИКС 2 — комментарии ученика и учителя на этапах проекта.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
//
//   1) КОЛОНКИ teacher_comment НА project_stage_progress НЕ БЫЛО НИГДЕ —
//      добавлена миграцией 155_project_stage_teacher_comment.sql, которая
//      (как и 153/154 в Этапе 12) НЕ ПРИМЕНЕНА к прод-базе в этой среде
//      (нет DDL-доступа, только PostgREST через service-role ключ). Этот
//      скрипт ПРОБУЕТ колонку перед записью (probeTeacherCommentColumn) —
//      если её ещё нет, молча пропускает teacher_comment (пишет только
//      student_notes, для которого миграция не нужна) и печатает явное
//      предупреждение с инструкцией перезапустить скрипт после применения
//      155. Идемпотентно в обе стороны.
//
//   2) "9 проектов × 3 класса = ~27 вызовов Gemini" из промта не совпадает
//      с реальной структурой: у projects.group_id одна FK — каждый проект
//      уже привязан РОВНО к одному классу (9 проектов = 3 класса × 3
//      проекта, класс НЕ умножается второй раз). 1 вызов на проект = 9
//      вызовов, зеркалит create-projects-week.mjs (тот же вывод там же).
//
//   3) Идемпотентность — НЕ файл-чекпойнт (в отличие от generate-stages-
//      jul28-30.mjs), а проверка по факту в БД (как в create-projects-
//      week.mjs: "уже есть сдачи → пропуск"): для каждого проекта
//      запрашиваются реальные NULL-строки student_notes/teacher_comment,
//      и если обеих не осталось — проект пропускается без вызова Gemini.
//      Так повторный запуск ПОСЛЕ применения миграции 155 сам дозаполнит
//      teacher_comment, даже если student_notes был заполнен раньше
//      (файл-чекпойн "done=true на весь проект" такого бы не позволил).
//
//   4) Этап "Написать код" (position=2) НЕ получает student_notes — там
//      уже лежит настоящий код ученика (create-projects-week.mjs,
//      student_notes этой строки = v.code, 90/90 заполнено). Он ПОЛУЧАЕТ
//      teacher_comment — учитель комментирует код, а не пишет вместо
//      ученика.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fill-project-comments.mjs

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
const VARIANTS_PER_STAGE = 6;

// ── throttle + модель + retry (зеркалит create-projects-week.mjs) ──
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

const SYSTEM_PROMPT = `Ты школьный учитель. Тебе даётся проект (название, описание, класс) и 5
этапов его выполнения по порядку: ${STAGE_TITLES.join(", ")}.

Для КАЖДОГО из 5 этапов придумай ${VARIANTS_PER_STAGE} коротких вариантов заметки
УЧЕНИКА (от первого лица, 3-8 слов, неформальный тон школьника, например
"Понял, что нужно делать" или "Всё получилось!") и ${VARIANTS_PER_STAGE} коротких
вариантов комментария УЧИТЕЛЯ (обращение к ученику, 8-20 слов, доброжелательно,
по существу именно этого этапа).

ВЕРНИ СТРОГО JSON (без markdown-обёртки, без пояснений вне JSON), ровно 5
элементов в массиве "stages" в ТОМ ЖЕ порядке, что и список этапов выше:
{
  "stages": [
    { "student": ["...", "..."], "teacher": ["...", "..."] },
    { "student": ["...", "..."], "teacher": ["...", "..."] },
    { "student": ["...", "..."], "teacher": ["...", "..."] },
    { "student": ["...", "..."], "teacher": ["...", "..."] },
    { "student": ["...", "..."], "teacher": ["...", "..."] }
  ]
}`;

function validate(parsed) {
  const stages = parsed?.stages;
  if (!Array.isArray(stages) || stages.length !== STAGE_TITLES.length) return null;
  const out = [];
  for (const s of stages) {
    const student = Array.isArray(s?.student) ? s.student.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
    const teacher = Array.isArray(s?.teacher) ? s.teacher.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
    if (!student.length || !teacher.length) return null;
    out.push({ student, teacher });
  }
  return out;
}

// PostgREST возвращает ошибку на ВЕСЬ select, если хоть одна запрошенная
// колонка не существует — поэтому колонку проверяем ОТДЕЛЬНО, до основного
// запроса, а не просто ловим ошибку главного select (иначе он не вернул бы
// и student_notes тоже).
async function probeTeacherCommentColumn() {
  const { error } = await db.from("project_stage_progress").select("teacher_comment").limit(1);
  if (!error) return true;
  if (error.code === "42703" || /column .*teacher_comment.* does not exist/i.test(error.message ?? "")) return false;
  fail(`Не удалось проверить колонку teacher_comment: ${error.message}`);
}

async function main() {
  console.log(`Комментарии ученика/учителя по этапам проектов — демо-школа (${SCHOOL_ID})\n`);

  const columnExists = await probeTeacherCommentColumn();
  if (!columnExists) {
    console.warn("!! Колонка project_stage_progress.teacher_comment ещё НЕ существует —");
    console.warn("!! миграция 155_project_stage_teacher_comment.sql не применена к прод-базе.");
    console.warn("!! Этот запуск заполнит ТОЛЬКО student_notes. После применения миграции");
    console.warn("!! (Supabase Dashboard → SQL Editor) перезапустите скрипт — он идемпотентен");
    console.warn("!! и дозаполнит teacher_comment, не трогая уже заполненный student_notes.\n");
  }

  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);
  const groupIds = groups.map((g) => g.id);

  const { data: projects, error: pErr } = await db.from("projects").select("id, title, description, group_id").in("group_id", groupIds);
  if (pErr) fail(`Ошибка запроса projects: ${pErr.message}`);
  console.log(`Проектов в каталоге (3 группы): ${projects.length} (ожидание 9).`);

  const { data: stages, error: sErr } = await db.from("project_stages").select("id, project_id, position").in("project_id", projects.map((p) => p.id));
  if (sErr) fail(`Ошибка запроса project_stages: ${sErr.message}`);
  const stagesByProject = new Map();
  for (const s of stages) {
    if (!stagesByProject.has(s.project_id)) stagesByProject.set(s.project_id, []);
    stagesByProject.get(s.project_id).push(s);
  }

  const progressCols = columnExists ? "id, submission_id, stage_id, student_notes, teacher_comment" : "id, submission_id, stage_id, student_notes";

  modelName = await pickWorkingModel();
  if (!modelName) fail("Ни одна модель Gemini не доступна (дневной лимит?).");

  let geminiCalls = 0, projectsProcessed = 0, projectsSkipped = 0, studentNotesFilled = 0, teacherCommentsFilled = 0;

  for (const project of projects) {
    const projectStages = (stagesByProject.get(project.id) ?? []).sort((a, b) => a.position - b.position);
    if (projectStages.length !== STAGE_TITLES.length) { console.warn(`  !! "${project.title}": ${projectStages.length} этапов, ожидание ${STAGE_TITLES.length} — пропуск.`); continue; }
    const stagePositionById = new Map(projectStages.map((s) => [s.id, s.position]));

    const { data: subs, error: subErr } = await db.from("project_submissions").select("id").eq("project_id", project.id);
    if (subErr) { console.error(`  !! "${project.title}" project_submissions: ${subErr.message}`); continue; }
    if (!subs.length) { console.log(`  ["${project.title}"] → нет сдач, пропуск.`); continue; }

    const { data: progress, error: progErr } = await db
      .from("project_stage_progress").select(progressCols).in("submission_id", subs.map((s) => s.id));
    if (progErr) { console.error(`  !! "${project.title}" project_stage_progress: ${progErr.message}`); continue; }

    const needsNotes = progress.filter((r) => stagePositionById.get(r.stage_id) !== CODE_STAGE_POSITION && !r.student_notes);
    const needsComment = columnExists ? progress.filter((r) => !r.teacher_comment) : [];
    if (!needsNotes.length && !needsComment.length) {
      console.log(`  ["${project.title}"] → уже заполнено, пропуск.`);
      projectsSkipped++;
      continue;
    }

    const className = groups.find((g) => g.id === project.group_id)?.name ?? "?";
    const userPrompt = `Класс: ${className}\nНазвание проекта: "${project.title}"\nОписание проекта: ${project.description ?? "(нет)"}`;
    const logPrefix = `  [${className} · ${project.title}]`;

    let pool = null;
    for (let attempt = 0; attempt < 2 && !pool; attempt++) {
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
      pool = validate(parsed);
      if (!pool) console.error(`${logPrefix} → ERROR (валидация не прошла, попытка ${attempt + 1})`);
    }
    if (!pool) { console.error(`${logPrefix} → ПРОПУСК (не удалось сгенерировать)`); continue; }

    let notesOk = 0, commentsOk = 0;
    for (const row of needsNotes) {
      const stagePool = pool[stagePositionById.get(row.stage_id)];
      const { error: updErr } = await db.from("project_stage_progress").update({ student_notes: pick(stagePool.student) }).eq("id", row.id);
      if (updErr) { console.error(`  !! student_notes update failed (${row.id}): ${updErr.message}`); continue; }
      notesOk++;
    }
    for (const row of needsComment) {
      const stagePool = pool[stagePositionById.get(row.stage_id)];
      const { error: updErr } = await db.from("project_stage_progress").update({ teacher_comment: pick(stagePool.teacher) }).eq("id", row.id);
      if (updErr) { console.error(`  !! teacher_comment update failed (${row.id}): ${updErr.message}`); continue; }
      commentsOk++;
    }
    studentNotesFilled += notesOk;
    teacherCommentsFilled += commentsOk;
    projectsProcessed++;
    console.log(`${logPrefix} → OK (student_notes ${notesOk}/${needsNotes.length}, teacher_comment ${commentsOk}/${needsComment.length})`);
  }

  console.log(`\nГотово: проектов обработано ${projectsProcessed}, пропущено (уже заполнено) ${projectsSkipped}, вызовов Gemini ${geminiCalls}.`);
  console.log(`student_notes заполнено: ${studentNotesFilled}. teacher_comment заполнено: ${teacherCommentsFilled}${columnExists ? "" : " (колонка отсутствует — 0 ожидаемо, см. предупреждение выше)"}.`);

  const { count: notesTotal } = await db.from("project_stage_progress").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).not("student_notes", "is", null);
  console.log(`\nПроверка: project_stage_progress со student_notes всего — ${notesTotal} (ожидание 450 = 360 заметок + 90 кода, после применения на всех проектах).`);
  if (columnExists) {
    const { count: commentTotal } = await db.from("project_stage_progress").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).not("teacher_comment", "is", null);
    console.log(`project_stage_progress с teacher_comment всего — ${commentTotal} (ожидание 450 = все этапы всех сдач).`);
  }
}

main().catch((e) => fail(e.stack ?? String(e)));
