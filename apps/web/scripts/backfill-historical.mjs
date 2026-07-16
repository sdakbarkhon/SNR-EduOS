#!/usr/bin/env node
// Пачка 2.5 — исторический бэкфилл attendance/lesson_grades/quiz_attempts/
// homework_submissions/test_submissions за 7-16 июля 2026 для ~96 активных
// учеников школы (90 конвертированных из демо + 6 реальных, миграция 132).
// Демо-режим больше не отделяет данные (is_demo убран в 132) — этот скрипт
// пишет ОБЫЧНЫЕ, «боевые» строки, поэтому гейт --confirm-real-data обязателен.
//
// ЗАПУСК:
//   cd apps/web
//   node --env-file=.env.local scripts/backfill-historical.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-historical.mjs --confirm-real-data
//
// Аргументы:
//   --confirm-real-data      обязателен для боевого запуска; без него — dry-run
//   --dry-run                явный dry-run (тоже работает без --confirm-real-data)
//   --start-date=YYYY-MM-DD  default 2026-07-07
//   --end-date=YYYY-MM-DD    default 2026-07-16 (включительно)
//   --only-student=<username> ограничить одним учеником (для тестов)
//   --resume-from=<N>        пропустить первые N уроков (после сортировки по starts_at)
//
// СХЕМА (расхождения с исходным ТЗ, подтверждены live-запросом к hosted БД):
//   - attendance.status — 'present' | 'absent_excused' | 'absent_unexcused'
//     (НЕТ статуса 'sick'). Маппинг: absent_unexcused="absent" из ТЗ (8%),
//     absent_excused="sick" из ТЗ / справка (2%).
//   - lesson_grades колонка называется `grade`, не `grade_value`.
//   - homework.due_date, не due_at. homework.lesson_id всегда NULL — ДЗ
//     привязано только к group_id (аудитория = вся группа, индивидуальных
//     ДЗ в схеме нет).
//   - homework.content_type — 16 значений. В диапазоне 07-07..07-16 реально
//     встречаются: programming(6), wokwi(1), test(3). content_type='bundle'
//     использует ОТДЕЛЬНУЮ систему homework_subtasks — в диапазоне дат такого
//     ДЗ нет, поэтому не реализовано (если встретится — лог warning, skip).
//   - content_type='test' — ОТДЕЛЬНАЯ система (test_questions/test_submissions/
//     test_answers), НЕ через homework_submissions. Пишем в test_submissions
//     {score,max_score} по проценту (та же кривая, что quiz).
//   - Quiz-результаты — quiz_attempts (миграция 39), не quiz_submissions.
//     quiz_questions для стейджей уже сгенерированы (generate-lessons.mjs,
//     Gemini) — total_questions/max_score берём оттуда, а не выдумываем.
//   - Комментарии учителя — ПРЯМЫЕ колонки: lesson_grades.comment,
//     homework_submissions.teacher_comment. chat_messages здесь не участвует.
//   - is_demo убран миграцией 132 — НЕ пишем это поле нигде (в отличие от
//     старых apps/web/scripts/backfill-{attendance,grades,homework}.mjs,
//     которые его пишут и потому сейчас сломаны после 132 — не трогаем их,
//     этот скрипт им не замена по назначению, а параллельный, per ТЗ).
//   - Идемпотентность — ЯВНЫЙ pre-check существующих ключей (bulk SELECT в
//     Set, не ON CONFLICT DO NOTHING) — по прямому указанию ТЗ, чтобы видеть
//     реальное состояние (сколько уже было / сколько создано).
//   - set_grading_meta() — триггер BEFORE UPDATE (не INSERT) на
//     homework_submissions/test_submissions. Раз мы делаем ОДИН INSERT с уже
//     проставленными grade+graded_by+graded_at — триггер не срабатывает,
//     наши явные (исторически точные) значения не перезатираются. Отдельный
//     workaround с двойным UPDATE (как в старом backfill-homework.mjs) не
//     нужен.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  pickAttendance, pickGrade, pickCommentByGrade, pickHomeworkSubmissionState,
  pickHomeworkContent, pickQuizPercentage, randomTimestampAfter, randomTimeBetween,
  HOMEWORK_ANSWERS, pick,
} from "./lib/backfill-templates.mjs";

// ── env + client ────────────────────────────────────────────────────────
// Основной путь — node --env-file=.env.local уже кладёт переменные в
// process.env. Фолбэк на ручной парсинг — если кто-то забыл флаг.
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
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Запускай так: node --env-file=.env.local scripts/backfill-historical.mjs [--dry-run|--confirm-real-data]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";
const TZ_OFFSET = "+05:00"; // Tashkent — та же конвенция, что в старых backfill-*.mjs

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, def) {
  const pfx = `--${name}=`;
  const found = argv.find((a) => a.startsWith(pfx));
  return found ? found.slice(pfx.length) : def;
}
const CONFIRM = flag("confirm-real-data");
const EXPLICIT_DRY = flag("dry-run");
const DRY_RUN = !CONFIRM || EXPLICIT_DRY;
if (CONFIRM && EXPLICIT_DRY) {
  console.warn("Указаны и --confirm-real-data, и --dry-run одновременно — выигрывает dry-run (безопаснее).");
}
const START_DATE = opt("start-date", "2026-07-07");
const END_DATE = opt("end-date", "2026-07-16");
const ONLY_STUDENT = opt("only-student", null);
const RESUME_FROM = Number(opt("resume-from", "0")) || 0;

const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
const rangeEndExclusiveIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(70));
console.log(`Пачка 2.5 — исторический бэкфилл ${START_DATE}..${END_DATE}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД)" : "БОЕВОЙ (пишем в БД)"}`);
if (ONLY_STUDENT) console.log(`Фильтр: только ученик ${ONLY_STUDENT}`);
if (RESUME_FROM > 0) console.log(`Resume: пропускаем первые ${RESUME_FROM} уроков`);
console.log("═".repeat(70));

// ── batching / insert helpers ──────────────────────────────────────────
const BATCH_SIZE = 200;
const stats = { created: {}, skippedExisting: {}, errors: [] };
function bump(map, key, n = 1) { map[key] = (map[key] ?? 0) + n; }

const queues = {
  attendance: [],
  lesson_grades: [],
  homework_submissions: [],
  test_submissions: [],
  quiz_attempts: [],
};

async function flushTable(table, force = false) {
  const q = queues[table];
  while (q.length >= BATCH_SIZE || (force && q.length > 0)) {
    const chunk = q.splice(0, BATCH_SIZE);
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] would INSERT ${chunk.length} → ${table}`);
      bump(stats.created, table, chunk.length);
      continue;
    }
    const { data, error } = await db.from(table).insert(chunk).select("id");
    if (error) {
      console.error(`  ОШИБКА при INSERT ${chunk.length} → ${table}: ${error.message}`);
      stats.errors.push({ table, count: chunk.length, message: error.message });
      continue;
    }
    bump(stats.created, table, data?.length ?? chunk.length);
  }
}
async function enqueue(table, row) {
  queues[table].push(row);
  await flushTable(table, false);
}
async function flushAll() {
  for (const table of Object.keys(queues)) await flushTable(table, true);
}

// ── pagination helper (PostgREST default page limit) ──────────────────
async function fetchAllRows(table, selectCols, applyFilters) {
  const PAGE = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = db.from(table).select(selectCols).range(from, from + PAGE - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 1 — контекст
// ══════════════════════════════════════════════════════════════════════
async function loadContext() {
  console.log("\n[Шаг 1] Загрузка контекста...");

  let students = await fetchAllRows("students", "id, user_id, username, grade", (q) => q.eq("status", "active"));
  if (ONLY_STUDENT) {
    const before = students.length;
    students = students.filter((s) => s.username === ONLY_STUDENT);
    if (students.length === 0) {
      console.error(`FATAL: --only-student=${ONLY_STUDENT} не найден среди ${before} активных учеников.`);
      process.exit(1);
    }
  }
  console.log(`  Учеников: ${students.length}${ONLY_STUDENT ? ` (отфильтровано из ${ONLY_STUDENT ? "всех" : ""})` : ""}`);

  const groups = await fetchAllRows("groups", "id, name, teacher_id", (q) => q);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const curatorByGroup = new Map(groups.map((g) => [g.id, g.teacher_id]));

  const studentGroupRows = await fetchAllRows("student_groups", "student_id, group_id", (q) => q);
  const studentIdSet = new Set(students.map((s) => s.id));
  const studentsByGroup = new Map();
  for (const r of studentGroupRows) {
    if (!studentIdSet.has(r.student_id)) continue;
    const arr = studentsByGroup.get(r.group_id) ?? [];
    arr.push(r.student_id);
    studentsByGroup.set(r.group_id, arr);
  }

  const subjects = await fetchAllRows("subjects", "id, name, group_id, teacher_id", (q) => q.eq("is_stub", false));
  const teacherBySubject = new Map(subjects.map((s) => [s.id, s.teacher_id]));
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

  const nowIso = new Date().toISOString();
  const allLessonsInRange = await fetchAllRows(
    "lessons",
    "id, group_id, subject_id, starts_at, ends_at, status, topic, title",
    (q) => q.gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclusiveIso),
  );
  let lessons = allLessonsInRange
    .filter((l) => l.status === "completed" && l.ends_at && l.ends_at < nowIso)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const skippedNotCompleted = allLessonsInRange.length - lessons.length;
  console.log(`  Уроков в диапазоне: ${allLessonsInRange.length}, реально прошедших (completed AND ends_at<now): ${lessons.length}${skippedNotCompleted ? ` (пропущено ${skippedNotCompleted} — ещё не завершились)` : ""}`);
  if (RESUME_FROM > 0) {
    lessons = lessons.slice(RESUME_FROM);
    console.log(`  После --resume-from=${RESUME_FROM}: ${lessons.length} уроков к обработке`);
  }

  const homeworks = await fetchAllRows(
    "homework",
    "id, group_id, teacher_id, subject_id, content_type, due_date, created_at, title, programming_language",
    (q) => q.gte("due_date", rangeStartIso).lt("due_date", rangeEndExclusiveIso),
  );
  console.log(`  ДЗ в диапазоне (по due_date): ${homeworks.length}`);
  const hwByType = {};
  for (const h of homeworks) bump(hwByType, h.content_type);
  console.log(`  Разбивка по content_type: ${JSON.stringify(hwByType)}`);

  const lessonIds = lessons.map((l) => l.id);
  let quizStages = [];
  if (lessonIds.length > 0) {
    // .in() тоже подчиняется дефолтному лимиту — грузим чанками по lessonIds.
    const CHUNK = 200;
    for (let i = 0; i < lessonIds.length; i += CHUNK) {
      const idsChunk = lessonIds.slice(i, i + CHUNK);
      const rows = await fetchAllRows(
        "lesson_stages",
        "id, lesson_id, content_type",
        (q) => q.in("lesson_id", idsChunk).in("content_type", ["quiz_qia", "quiz_kahoot"]),
      );
      quizStages.push(...rows);
    }
  }
  console.log(`  Quiz-этапов (quiz_qia/quiz_kahoot) в этих уроках: ${quizStages.length}`);

  const quizMetaByStage = new Map();
  if (quizStages.length > 0) {
    const stageIds = quizStages.map((s) => s.id);
    const CHUNK = 200;
    const allQuestions = [];
    for (let i = 0; i < stageIds.length; i += CHUNK) {
      const idsChunk = stageIds.slice(i, i + CHUNK);
      const rows = await fetchAllRows("quiz_questions", "stage_id, points", (q) => q.in("stage_id", idsChunk));
      allQuestions.push(...rows);
    }
    for (const q of allQuestions) {
      const meta = quizMetaByStage.get(q.stage_id) ?? { count: 0, maxScore: 0 };
      meta.count += 1;
      meta.maxScore += q.points ?? 1;
      quizMetaByStage.set(q.stage_id, meta);
    }
  }
  const quizStagesByLesson = new Map();
  for (const s of quizStages) {
    const meta = quizMetaByStage.get(s.id);
    if (!meta || meta.count === 0) continue; // этап есть, но вопросов нет — генерировать нечего
    const arr = quizStagesByLesson.get(s.lesson_id) ?? [];
    arr.push({ stageId: s.id, totalQuestions: meta.count, maxScore: meta.maxScore });
    quizStagesByLesson.set(s.lesson_id, arr);
  }

  return {
    students, studentsByGroup, groupNameById, curatorByGroup,
    teacherBySubject, subjectNameById,
    lessons, homeworks, quizStagesByLesson,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Существующие ключи — bulk pre-fetch (идемпотентность через явный SELECT,
// не ON CONFLICT DO NOTHING — по прямому указанию ТЗ).
// ══════════════════════════════════════════════════════════════════════
async function loadExistingKeys(ctx) {
  console.log("\n[pre-check] Загрузка уже существующих записей (для идемпотентности)...");
  const lessonIds = ctx.lessons.map((l) => l.id);
  const homeworkIds = ctx.homeworks.map((h) => h.id);
  const allStageIds = [...ctx.quizStagesByLesson.values()].flat().map((s) => s.stageId);

  const existingAttendance = new Set();
  const existingAttendanceStatus = new Map(); // "lessonId:studentId" -> status (для связной генерации grades/quiz)
  const existingGrades = new Set();
  const existingQuiz = new Set();
  const existingHwSub = new Set();
  const existingTestSub = new Set();

  const CHUNK = 200;
  for (let i = 0; i < lessonIds.length; i += CHUNK) {
    const idsChunk = lessonIds.slice(i, i + CHUNK);
    const att = await fetchAllRows("attendance", "lesson_id, student_id, status", (q) => q.in("lesson_id", idsChunk));
    for (const r of att) {
      const key = `${r.lesson_id}:${r.student_id}`;
      existingAttendance.add(key);
      existingAttendanceStatus.set(key, r.status);
    }
    const gr = await fetchAllRows("lesson_grades", "lesson_id, student_id", (q) => q.in("lesson_id", idsChunk));
    for (const r of gr) existingGrades.add(`${r.lesson_id}:${r.student_id}`);
  }
  for (let i = 0; i < allStageIds.length; i += CHUNK) {
    const idsChunk = allStageIds.slice(i, i + CHUNK);
    const qa = await fetchAllRows("quiz_attempts", "stage_id, student_id", (q) => q.in("stage_id", idsChunk));
    for (const r of qa) existingQuiz.add(`${r.stage_id}:${r.student_id}`);
  }
  if (homeworkIds.length > 0) {
    const hs = await fetchAllRows("homework_submissions", "homework_id, student_id", (q) => q.in("homework_id", homeworkIds));
    for (const r of hs) existingHwSub.add(`${r.homework_id}:${r.student_id}`);
    const ts = await fetchAllRows("test_submissions", "homework_id, student_id", (q) => q.in("homework_id", homeworkIds));
    for (const r of ts) existingTestSub.add(`${r.homework_id}:${r.student_id}`);
  }

  console.log(`  Уже есть: attendance=${existingAttendance.size}, lesson_grades=${existingGrades.size}, quiz_attempts=${existingQuiz.size}, homework_submissions=${existingHwSub.size}, test_submissions=${existingTestSub.size}`);
  return { existingAttendance, existingAttendanceStatus, existingGrades, existingQuiz, existingHwSub, existingTestSub };
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 2 — уроки: attendance → lesson_grades → quiz_attempts
// ══════════════════════════════════════════════════════════════════════
async function processLessons(ctx, existing) {
  console.log(`\n[Шаг 2] Обработка ${ctx.lessons.length} уроков...`);

  for (let i = 0; i < ctx.lessons.length; i++) {
    const lesson = ctx.lessons[i];
    try {
      const studentIds = ctx.studentsByGroup.get(lesson.group_id) ?? [];
      const teacherId = ctx.teacherBySubject.get(lesson.subject_id) ?? ctx.curatorByGroup.get(lesson.group_id) ?? null;
      const subjectName = ctx.subjectNameById.get(lesson.subject_id) ?? "?";
      const groupName = ctx.groupNameById.get(lesson.group_id) ?? "?";
      const dateLabel = lesson.starts_at.slice(0, 16).replace("T", " ");

      let attCreated = 0, attPresent = 0, attAbsent = 0, attSick = 0, attSkipped = 0;
      let gradesCreated = 0, gradesSkipped = 0;
      let quizCreated = 0, quizSkipped = 0;

      // Присутствие для этого прогона: уже существующее (из bulk pre-fetch,
      // ШАГ pre-check) + только что сгенерированное — нужно, чтобы корректно
      // решить "оценка только если present" даже для строк, которые мы сейчас
      // не создаём (идемпотентность не должна ломать связность).
      const presentThisLesson = new Set();

      for (const studentId of studentIds) {
        const key = `${lesson.id}:${studentId}`;
        if (existing.existingAttendance.has(key)) {
          attSkipped++;
          if (existing.existingAttendanceStatus.get(key) === "present") presentThisLesson.add(studentId);
          continue;
        }
        const status = pickAttendance();
        if (status === "present") { attPresent++; presentThisLesson.add(studentId); }
        else if (status === "absent_unexcused") attAbsent++;
        else attSick++;
        await enqueue("attendance", {
          lesson_id: lesson.id,
          student_id: studentId,
          status,
          marked_at: lesson.starts_at,
          marked_by: teacherId,
          school_id: SCHOOL_ID,
        });
        existing.existingAttendance.add(key);
        attCreated++;
      }

      // Оценки — только для present (существующих ИЛИ только что созданных), и
      // только если есть кому ставить (реальный предметный учитель резолвится).
      if (teacherId) {
        for (const studentId of presentThisLesson) {
          const key = `${lesson.id}:${studentId}`;
          if (existing.existingGrades.has(key)) { gradesSkipped++; continue; }
          const grade = pickGrade();
          await enqueue("lesson_grades", {
            lesson_id: lesson.id,
            student_id: studentId,
            grade,
            comment: pickCommentByGrade(grade),
            graded_by: teacherId,
            graded_at: randomTimestampAfter(lesson.ends_at ?? lesson.starts_at, 1, 30),
            school_id: SCHOOL_ID,
          });
          existing.existingGrades.add(key);
          gradesCreated++;
        }
      }

      // Quiz — для present-учеников, только для этапов с реальными вопросами.
      const quizStages = ctx.quizStagesByLesson.get(lesson.id) ?? [];
      for (const stage of quizStages) {
        for (const studentId of presentThisLesson) {
          const key = `${stage.stageId}:${studentId}`;
          if (existing.existingQuiz.has(key)) { quizSkipped++; continue; }
          const pct = pickQuizPercentage();
          const correctCount = Math.max(0, Math.min(stage.totalQuestions, Math.round((stage.totalQuestions * pct) / 100)));
          const scoreShare = stage.totalQuestions > 0 ? correctCount / stage.totalQuestions : 0;
          const startedAt = randomTimestampAfter(lesson.ends_at ?? lesson.starts_at, 1, 20);
          await enqueue("quiz_attempts", {
            stage_id: stage.stageId,
            student_id: studentId,
            started_at: startedAt,
            finished_at: randomTimestampAfter(startedAt, 2, 15),
            total_questions: stage.totalQuestions,
            correct_count: correctCount,
            total_score: Math.round(stage.maxScore * scoreShare),
            is_finalized: true,
            school_id: SCHOOL_ID,
          });
          existing.existingQuiz.add(key);
          quizCreated++;
        }
      }

      const attTotal = attCreated + attSkipped;
      console.log(
        `[${i + 1}/${ctx.lessons.length}] Урок ${subjectName} ${groupName} ${dateLabel}... ` +
        `→ attendance ${attTotal} (${attPresent} present, ${attAbsent} absent, ${attSick} sick` +
        `${attSkipped ? `, ${attSkipped} уже было` : ""}), grades ${gradesCreated + gradesSkipped}${gradesSkipped ? ` (${gradesSkipped} уже было)` : ""}` +
        `${quizStages.length ? `, quiz ${quizCreated + quizSkipped}${quizSkipped ? ` (${quizSkipped} уже было)` : ""}` : ""}`,
      );
    } catch (e) {
      console.error(`  ОШИБКА на уроке ${lesson.id} (${lesson.topic ?? lesson.title ?? "?"}): ${e.message}`);
      stats.errors.push({ lessonId: lesson.id, message: e.message });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 3 — домашние задания: submissions → grades
// ══════════════════════════════════════════════════════════════════════
function submissionWindow(state, hw, nowMs) {
  const dueDate = hw.due_date;
  const windowStart = state === "onTime" ? hw.created_at : dueDate;
  const windowEndRaw = state === "onTime" ? dueDate : new Date(new Date(dueDate).getTime() + 3 * 86400000).toISOString();
  if (new Date(windowStart).getTime() > nowMs) return null; // окно ещё не наступило
  const windowEnd = new Date(windowEndRaw).getTime() < nowMs ? windowEndRaw : new Date(nowMs).toISOString();
  return { windowStart, windowEnd };
}

async function processHomework(ctx, existing) {
  console.log(`\n[Шаг 3] Обработка ${ctx.homeworks.length} домашних заданий...`);
  const nowMs = Date.now();

  for (let i = 0; i < ctx.homeworks.length; i++) {
    const hw = ctx.homeworks[i];
    try {
      if (hw.content_type === "bundle") {
        console.warn(`  [${i + 1}/${ctx.homeworks.length}] ДЗ "${hw.title}" content_type='bundle' — отдельная система (homework_subtasks), не реализовано в этом скрипте. Пропуск.`);
        continue;
      }

      const studentIds = ctx.studentsByGroup.get(hw.group_id) ?? [];
      const isTest = hw.content_type === "test";
      const existingSet = isTest ? existing.existingTestSub : existing.existingHwSub;

      let onTimeN = 0, lateN = 0, notSubmittedN = 0, skippedNotDue = 0, skippedExisting = 0, gradedN = 0;

      for (const studentId of studentIds) {
        const key = `${hw.id}:${studentId}`;
        if (existingSet.has(key)) { skippedExisting++; continue; }

        const state = pickHomeworkSubmissionState();
        if (state === "notSubmitted") { notSubmittedN++; continue; }

        const win = submissionWindow(state, hw, nowMs);
        if (!win) { skippedNotDue++; continue; }
        const submittedAt = randomTimeBetween(win.windowStart, win.windowEnd);
        if (state === "onTime") onTimeN++; else lateN++;

        const gradedAtRaw = randomTimestampAfter(submittedAt, 24 * 60, 48 * 60); // 1-2 дня
        const gradedAt = new Date(gradedAtRaw).getTime() > nowMs ? new Date(nowMs).toISOString() : gradedAtRaw;
        const grade = pickGrade();
        gradedN++;

        if (isTest) {
          const pct = pickQuizPercentage();
          const maxScore = 10;
          await enqueue("test_submissions", {
            homework_id: hw.id,
            student_id: studentId,
            submitted_at: submittedAt,
            score: Math.round((maxScore * pct) / 100),
            max_score: maxScore,
            graded_at: submittedAt, // тест авто-проверяемый — оценка сразу при сдаче
            graded_by: null,
            school_id: SCHOOL_ID,
          });
        } else {
          const isProgramming = hw.content_type === "programming";
          const content = isProgramming
            ? { code_text: pickHomeworkContent(hw.programming_language) }
            : { answer_text: pick(HOMEWORK_ANSWERS.TEXT) };
          await enqueue("homework_submissions", {
            homework_id: hw.id,
            student_id: studentId,
            submitted_at: submittedAt,
            ...content,
            status: "graded",
            grade,
            teacher_comment: pickCommentByGrade(grade),
            graded_by: hw.teacher_id,
            graded_at: gradedAt,
            school_id: SCHOOL_ID,
          });
        }
        existingSet.add(key);
      }

      console.log(
        `[${i + 1}/${ctx.homeworks.length}] ДЗ "${hw.title}" (${hw.content_type}, due ${hw.due_date.slice(0, 10)})... ` +
        `→ сдано ${onTimeN + lateN} (${onTimeN} вовремя, ${lateN} с опозданием), не сдано ${notSubmittedN}, ` +
        `оценено ${gradedN}${skippedNotDue ? `, ещё не наступило ${skippedNotDue}` : ""}${skippedExisting ? `, уже было ${skippedExisting}` : ""}`,
      );
    } catch (e) {
      console.error(`  ОШИБКА на ДЗ ${hw.id} (${hw.title}): ${e.message}`);
      stats.errors.push({ homeworkId: hw.id, message: e.message });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 5 — финальная проверка идемпотентности / распределений
// ══════════════════════════════════════════════════════════════════════
async function finalVerification() {
  console.log("\n[Шаг 5] Финальная проверка распределений (по всем данным в диапазоне)...");
  if (DRY_RUN) {
    console.log("  (dry-run — пропускаем, распределение будет видно только после боевого запуска)");
    return;
  }

  const attRows = await fetchAllRows("attendance", "status", (q) => q.gte("marked_at", rangeStartIso).lt("marked_at", rangeEndExclusiveIso));
  const attByStatus = {};
  for (const r of attRows) bump(attByStatus, r.status);
  console.log(`  attendance распределение (n=${attRows.length}):`, JSON.stringify(attByStatus));
  for (const [k, v] of Object.entries(attByStatus)) {
    console.log(`    ${k}: ${((100 * v) / attRows.length).toFixed(1)}%`);
  }

  const gradeRows = await fetchAllRows("lesson_grades", "grade", (q) => q.gte("graded_at", rangeStartIso).lt("graded_at", rangeEndExclusiveIso));
  const byGrade = {};
  for (const r of gradeRows) bump(byGrade, r.grade);
  console.log(`  lesson_grades распределение (n=${gradeRows.length}):`, JSON.stringify(byGrade));
  for (const [k, v] of Object.entries(byGrade)) {
    console.log(`    ${k}: ${((100 * v) / gradeRows.length).toFixed(1)}% (ожидание: 5=30%, 4=40%, 3=25%, 2=5%)`);
  }
}

// ══════════════════════════════════════════════════════════════════════
async function main() {
  const ctx = await loadContext();
  const existing = await loadExistingKeys(ctx);

  await processLessons(ctx, existing);
  await processHomework(ctx, existing);
  await flushAll();
  await finalVerification();

  console.log("\n" + "═".repeat(70));
  console.log(`ИТОГО (${DRY_RUN ? "DRY-RUN" : "боевой прогон"}):`);
  for (const [table, n] of Object.entries(stats.created)) {
    console.log(`  ${table}: +${n}`);
  }
  if (stats.errors.length > 0) {
    console.log(`\nОШИБКИ (${stats.errors.length}):`);
    for (const e of stats.errors.slice(0, 20)) console.log(`  ${JSON.stringify(e)}`);
    if (stats.errors.length > 20) console.log(`  ...и ещё ${stats.errors.length - 20}`);
  } else {
    console.log("  Ошибок: 0");
  }
  console.log("═".repeat(70));
  if (DRY_RUN) {
    console.log("\nЭто был DRY-RUN. Для боевого запуска добавь --confirm-real-data.");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
