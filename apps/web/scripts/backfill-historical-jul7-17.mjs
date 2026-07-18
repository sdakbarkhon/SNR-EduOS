#!/usr/bin/env node
// Пачка 2.5 (доп. заход) — исторический бэкфилл attendance/lesson_grades/
// homework_submissions за 2026-07-07..17 (11 дней) для всех 96 активных
// учеников (6 реальных + 90 конвертированных миграцией 132).
//
// Новый файл — НЕ замена apps/web/scripts/backfill-historical.mjs (тот
// остаётся как есть). Переиспользует его auth/batching/pagination паттерн
// и распределения из scripts/lib/backfill-templates.mjs (pickAttendance
// 90/8/2, pickGrade 30/40/25/5, pickHomeworkSubmissionState 75/15/10 —
// ТОЧНО совпадают с тем, что просили в этом промте, реализовывать заново
// смысла нет). Комментарии — НОВЫЕ 25 шаблонов с вероятностным смешением
// по оценке, как явно указано в этом промте (отличается от
// pickCommentByGrade старого скрипта, поэтому — отдельная функция здесь).
//
// ЖИВАЯ ПРОВЕРКА ПЕРЕД НАПИСАНИЕМ (эта сессия, hosted БД):
//   - 96 активных учеников, ровно 32/32/32 по 3-А/7-А/10-А (students.grade
//     '3 класс'/'7 класс'/'10 класс' + student_groups junction — та же
//     связка, что уже использует backfill-historical.mjs).
//   - 101 урок в 07-07..07-17 (9/день × 9 дней + 10×2 дня — 15/16 июля по
//     10 уроков, минорная аномалия расписания, вне скоупа этого скрипта).
//   - ends_at < now() — ВСЕ 101 урок уже прошли (сессия идёт больше суток,
//     реальное время ушло за полночь 18 июля).
//   - attendance УЖЕ ПОЛНОСТЬЮ забэкфиллен на все 11 дней (288/320 в день
//     = lessons_this_day × 32, точное совпадение) — этот скрипт создаст
//     0 новых attendance, идемпотентность просто пропустит всё.
//   - lesson_grades ЧАСТИЧНО: 07-12 близко к полному (~256-264/288 ≈
//     present-доля), но 07-13..17 сильно недобэкфиллены (49/28/37/8/0 из
//     ожидаемых ~260-290) — вот реальный пробел, который закрывает этот
//     скрипт.
//   - КРИТИЧНО: homework.lesson_id НЕ используется в этой схеме (всегда
//     NULL — live-проверка: 0 совпадений в диапазоне) — ДЗ привязано
//     только к group_id + due_date, ровно как задокументировано в шапке
//     backfill-historical.mjs. Логика ДЗ здесь адаптирована под реальную
//     схему: обрабатывается ОТДЕЛЬНЫМ шагом по (group_id, due_date IN
//     диапазоне), не "для каждого урока где есть ДЗ по lesson_id".

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  pickAttendance, pickGrade, pickHomeworkSubmissionState,
  pickHomeworkContent, randomTimestampAfter, randomTimeBetween,
  HOMEWORK_ANSWERS, pick,
} from "./lib/backfill-templates.mjs";

// ── env + client (service-role) ────────────────────────────────────────
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
  console.error("Запускай так: node --env-file=.env.local scripts/backfill-historical-jul7-17.mjs [--dry-run|--confirm]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";
const TZ_OFFSET = "+05:00";

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
if (CONFIRM && EXPLICIT_DRY) {
  console.warn("Указаны и --confirm, и --dry-run одновременно — выигрывает dry-run (безопаснее).");
}
const START_DATE = opt("date-from", "2026-07-07");
const END_DATE = opt("date-to", "2026-07-17"); // inclusive
const LIMIT_LESSONS = Number(opt("limit-lessons", "0")) || 0; // 0 = без лимита

const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
const rangeEndExclusiveIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(70));
console.log(`Пачка 2.5 (доп.) — бэкфилл attendance/grades/homework ${START_DATE}..${END_DATE}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД)" : "БОЕВОЙ (пишем в БД)"}`);
if (LIMIT_LESSONS > 0) console.log(`limit-lessons: ${LIMIT_LESSONS}`);
console.log("═".repeat(70));

// ── Комментарии — 25 новых шаблонов (промт этого захода), вероятностное
// смешение по оценке: 5→positive; 4→positive/neutral 50/50;
// 3→neutral/attention 60/40; 2→attention. ────────────────────────────────
const COMMENTS_POSITIVE = [
  "Хорошо усвоил материал", "Отличная работа", "Молодец, продолжай в том же духе",
  "Активно участвовал в уроке", "Правильно решил все задачи", "Показал хорошее понимание темы",
  "Аккуратно выполнил задание", "Быстро освоил новый материал", "Правильные ответы на все вопросы",
  "Уверенно справился с заданием",
];
const COMMENTS_NEUTRAL = [
  "В целом справился", "Есть небольшие ошибки, но материал понял", "Нужно повторить пройденное",
  "Обратить внимание на детали", "Задание выполнено с недочётами", "Средний уровень выполнения",
  "Требуется дополнительная практика",
];
const COMMENTS_ATTENTION = [
  "Нужно ещё раз повторить тему", "Обратиться за помощью, если непонятно", "Внимательнее читать задание",
  "Проверить свою работу ещё раз", "Много ошибок в основных понятиях", "Пропустил ключевые моменты",
  "Задание выполнено не полностью", "Требуется помощь учителя",
];
function pickCommentForGrade(grade) {
  if (grade === 5) return pick(COMMENTS_POSITIVE);
  if (grade === 4) return pick(Math.random() < 0.5 ? COMMENTS_POSITIVE : COMMENTS_NEUTRAL);
  if (grade === 3) return pick(Math.random() < 0.6 ? COMMENTS_NEUTRAL : COMMENTS_ATTENTION);
  return pick(COMMENTS_ATTENTION);
}

// ── batching / insert helpers (паттерн backfill-historical.mjs) ────────
const BATCH_SIZE = 200;
const stats = { created: {}, errors: [] };
function bump(map, key, n = 1) { map[key] = (map[key] ?? 0) + n; }

const queues = { attendance: [], lesson_grades: [], homework_submissions: [], test_submissions: [] };
async function flushTable(table, force = false) {
  const q = queues[table];
  while (q.length >= BATCH_SIZE || (force && q.length > 0)) {
    const chunk = q.splice(0, BATCH_SIZE);
    if (DRY_RUN) { bump(stats.created, table, chunk.length); continue; }
    const { data, error } = await db.from(table).insert(chunk).select("id");
    if (error) {
      console.error(`  ОШИБКА при INSERT ${chunk.length} → ${table}: ${error.message}`);
      stats.errors.push({ table, count: chunk.length, message: error.message });
      continue;
    }
    bump(stats.created, table, data?.length ?? chunk.length);
  }
}
async function enqueue(table, row) { queues[table].push(row); await flushTable(table, false); }
async function flushAll() { for (const table of Object.keys(queues)) await flushTable(table, true); }

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

// ── чекпоинт ────────────────────────────────────────────────────────────
const LOG_PATH = path.resolve(process.cwd(), "scripts/.backfill-progress-jul7-17.json");
function loadLog() { return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : { doneLessons: {} }; }
function saveLog(log) { fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2)); }

// ══════════════════════════════════════════════════════════════════════
// ШАГ 1 — контекст
// ══════════════════════════════════════════════════════════════════════
async function loadContext() {
  console.log("\n[Шаг 1] Загрузка контекста...");

  const students = await fetchAllRows("students", "id, user_id, username, grade", (q) => q.eq("status", "active"));
  console.log(`  Учеников: ${students.length}`);

  const groups = await fetchAllRows("groups", "id, name", (q) => q);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

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

  const curatorByGroupRows = await fetchAllRows("groups", "id, teacher_id", (q) => q);
  const curatorByGroup = new Map(curatorByGroupRows.map((g) => [g.id, g.teacher_id]));

  // Гейт безопасности: время, НЕ статус (см. шапку файла — прошлый инцидент
  // с плохим гейтом на статусе создал тысячи фейковых строк для уроков,
  // которые формально не были закрыты, но реально уже прошли).
  const nowIso = new Date().toISOString();
  const allLessonsInRange = await fetchAllRows(
    "lessons",
    "id, group_id, subject_id, starts_at, ends_at, status, topic, title",
    (q) => q.gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclusiveIso),
  );
  let lessons = allLessonsInRange
    .filter((l) => l.ends_at && l.ends_at < nowIso)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const skippedNotEnded = allLessonsInRange.length - lessons.length;
  console.log(`  Уроков в диапазоне: ${allLessonsInRange.length}, реально завершённых (ends_at<now): ${lessons.length}${skippedNotEnded ? ` (пропущено ${skippedNotEnded} — ещё не закончились)` : ""}`);
  if (LIMIT_LESSONS > 0 && lessons.length > LIMIT_LESSONS) {
    console.log(`  --limit-lessons=${LIMIT_LESSONS}: обрабатываем первые ${LIMIT_LESSONS} из ${lessons.length}`);
    lessons = lessons.slice(0, LIMIT_LESSONS);
  }

  // ДЗ: НЕ по lesson_id (в этой схеме всегда NULL) — по group_id + due_date
  // в диапазоне, как в backfill-historical.mjs.
  const homeworks = await fetchAllRows(
    "homework",
    "id, group_id, teacher_id, subject_id, content_type, due_date, created_at, title, programming_language",
    (q) => q.gte("due_date", rangeStartIso).lt("due_date", rangeEndExclusiveIso),
  );
  console.log(`  ДЗ в диапазоне (по due_date): ${homeworks.length}`);

  return { students, studentsByGroup, groupNameById, curatorByGroup, teacherBySubject, subjectNameById, lessons, homeworks };
}

// ══════════════════════════════════════════════════════════════════════
// Идемпотентность — bulk pre-fetch существующих ключей
// ══════════════════════════════════════════════════════════════════════
async function loadExistingKeys(ctx) {
  console.log("\n[pre-check] Загрузка уже существующих записей...");
  const lessonIds = ctx.lessons.map((l) => l.id);
  const homeworkIds = ctx.homeworks.map((h) => h.id);

  const existingAttendance = new Set();
  const existingAttendanceStatus = new Map();
  const existingGrades = new Set();
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
  if (homeworkIds.length > 0) {
    const hs = await fetchAllRows("homework_submissions", "homework_id, student_id", (q) => q.in("homework_id", homeworkIds));
    for (const r of hs) existingHwSub.add(`${r.homework_id}:${r.student_id}`);
    const ts = await fetchAllRows("test_submissions", "homework_id, student_id", (q) => q.in("homework_id", homeworkIds));
    for (const r of ts) existingTestSub.add(`${r.homework_id}:${r.student_id}`);
  }

  console.log(`  Уже есть: attendance=${existingAttendance.size}, lesson_grades=${existingGrades.size}, homework_submissions=${existingHwSub.size}, test_submissions=${existingTestSub.size}`);
  return { existingAttendance, existingAttendanceStatus, existingGrades, existingHwSub, existingTestSub };
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 2 — уроки: attendance → lesson_grades
// ══════════════════════════════════════════════════════════════════════
async function processLessons(ctx, existing, log) {
  console.log(`\n[Шаг 2] Обработка ${ctx.lessons.length} уроков...`);
  let lessonsFullySkipped = 0;

  for (let i = 0; i < ctx.lessons.length; i++) {
    const lesson = ctx.lessons[i];
    try {
      const studentIds = ctx.studentsByGroup.get(lesson.group_id) ?? [];
      const teacherId = ctx.teacherBySubject.get(lesson.subject_id) ?? ctx.curatorByGroup.get(lesson.group_id) ?? null;
      const subjectName = ctx.subjectNameById.get(lesson.subject_id) ?? "?";
      const groupName = ctx.groupNameById.get(lesson.group_id) ?? "?";
      const dateLabel = lesson.starts_at.slice(0, 10);
      const timeLabel = lesson.starts_at.slice(11, 16);

      let attCreated = 0, attPresent = 0, attAbsent = 0, attSick = 0, attSkipped = 0;
      let gradesCreated = 0, gradesSkipped = 0, g5 = 0, g4 = 0, g3 = 0, g2 = 0;
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
          lesson_id: lesson.id, student_id: studentId, status,
          marked_at: lesson.starts_at, marked_by: teacherId, school_id: SCHOOL_ID,
        });
        existing.existingAttendance.add(key);
        attCreated++;
      }

      if (teacherId) {
        for (const studentId of presentThisLesson) {
          const key = `${lesson.id}:${studentId}`;
          if (existing.existingGrades.has(key)) { gradesSkipped++; continue; }
          const grade = pickGrade();
          if (grade === 5) g5++; else if (grade === 4) g4++; else if (grade === 3) g3++; else g2++;
          await enqueue("lesson_grades", {
            lesson_id: lesson.id, student_id: studentId, grade,
            comment: pickCommentForGrade(grade), graded_by: teacherId,
            graded_at: randomTimestampAfter(lesson.ends_at ?? lesson.starts_at, 1, 30),
            school_id: SCHOOL_ID,
          });
          existing.existingGrades.add(key);
          gradesCreated++;
        }
      }

      if (attCreated === 0 && gradesCreated === 0) {
        lessonsFullySkipped++;
        log.doneLessons[lesson.id] = true;
      }

      console.log(
        `[${i + 1}/${ctx.lessons.length}] Урок ${dateLabel} · ${timeLabel} · ${groupName} · ${subjectName}:\n` +
        `    attendance: created ${attCreated} (present=${attPresent} absent=${attAbsent} sick=${attSick}), skipped ${attSkipped}\n` +
        `    grades: created ${gradesCreated} (5=${g5} 4=${g4} 3=${g3} 2=${g2}), skipped ${gradesSkipped}`,
      );
    } catch (e) {
      console.error(`  ОШИБКА на уроке ${lesson.id} (${lesson.topic ?? lesson.title ?? "?"}): ${e.message}`);
      stats.errors.push({ lessonId: lesson.id, message: e.message });
    }
  }
  return { lessonsFullySkipped };
}

// ══════════════════════════════════════════════════════════════════════
// ШАГ 3 — домашние задания (по group_id + due_date, НЕ по lesson_id)
// ══════════════════════════════════════════════════════════════════════
function submissionWindow(state, hw, nowMs) {
  const dueDate = hw.due_date;
  const windowStart = state === "onTime" ? hw.created_at : dueDate;
  const windowEndRaw = state === "onTime" ? dueDate : new Date(new Date(dueDate).getTime() + 3 * 86400000).toISOString();
  if (new Date(windowStart).getTime() > nowMs) return null;
  const windowEnd = new Date(windowEndRaw).getTime() < nowMs ? windowEndRaw : new Date(nowMs).toISOString();
  return { windowStart, windowEnd };
}

async function processHomework(ctx, existing) {
  console.log(`\n[Шаг 3] Обработка ${ctx.homeworks.length} домашних заданий (по group_id+due_date)...`);
  const nowMs = Date.now();

  for (let i = 0; i < ctx.homeworks.length; i++) {
    const hw = ctx.homeworks[i];
    try {
      if (hw.content_type === "bundle") {
        console.warn(`  [${i + 1}/${ctx.homeworks.length}] ДЗ "${hw.title}" content_type='bundle' — не реализовано, пропуск.`);
        continue;
      }
      const studentIds = ctx.studentsByGroup.get(hw.group_id) ?? [];
      const isTest = hw.content_type === "test";
      const existingSet = isTest ? existing.existingTestSub : existing.existingHwSub;

      let onTimeN = 0, lateN = 0, notSubmittedN = 0, skippedNotDue = 0, skippedExisting = 0;

      for (const studentId of studentIds) {
        const key = `${hw.id}:${studentId}`;
        if (existingSet.has(key)) { skippedExisting++; continue; }

        const state = pickHomeworkSubmissionState();
        if (state === "notSubmitted") { notSubmittedN++; continue; }

        const win = submissionWindow(state, hw, nowMs);
        if (!win) { skippedNotDue++; continue; }
        const submittedAt = randomTimeBetween(win.windowStart, win.windowEnd);
        if (state === "onTime") onTimeN++; else lateN++;

        const gradedAtRaw = randomTimestampAfter(submittedAt, 24 * 60, 48 * 60);
        const gradedAt = new Date(gradedAtRaw).getTime() > nowMs ? new Date(nowMs).toISOString() : gradedAtRaw;
        const grade = pickGrade();

        if (isTest) {
          const maxScore = 10;
          await enqueue("test_submissions", {
            homework_id: hw.id, student_id: studentId, submitted_at: submittedAt,
            score: Math.round((maxScore * grade) / 5), max_score: maxScore,
            graded_at: submittedAt, graded_by: null, school_id: SCHOOL_ID,
          });
        } else {
          const isProgramming = hw.content_type === "programming";
          const content = isProgramming
            ? { code_text: pickHomeworkContent(hw.programming_language) }
            : { answer_text: pick(HOMEWORK_ANSWERS.TEXT) };
          await enqueue("homework_submissions", {
            homework_id: hw.id, student_id: studentId, submitted_at: submittedAt, ...content,
            status: "graded", grade, teacher_comment: pickCommentForGrade(grade),
            graded_by: hw.teacher_id, graded_at: gradedAt, school_id: SCHOOL_ID,
          });
        }
        existingSet.add(key);
      }

      console.log(
        `ДЗ [${i + 1}/${ctx.homeworks.length}] "${hw.title}" (${hw.content_type}, due ${hw.due_date.slice(0, 10)}):\n` +
        `    homework: created ${onTimeN + lateN} submissions (ontime=${onTimeN} late=${lateN}), skipped ${skippedExisting}` +
        `${notSubmittedN ? `, не сдано ${notSubmittedN}` : ""}${skippedNotDue ? `, срок не наступил ${skippedNotDue}` : ""}`,
      );
    } catch (e) {
      console.error(`  ОШИБКА на ДЗ ${hw.id} (${hw.title}): ${e.message}`);
      stats.errors.push({ homeworkId: hw.id, message: e.message });
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const ctx = await loadContext();
  const existing = await loadExistingKeys(ctx);
  const log = loadLog();

  const { lessonsFullySkipped } = await processLessons(ctx, existing, log);
  await processHomework(ctx, existing);
  await flushAll();
  saveLog(log);

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  console.log(`  Обработано уроков: ${ctx.lessons.length}`);
  console.log(`  Пропущено уроков (уже полностью бэкфиллены): ${lessonsFullySkipped}`);
  console.log(`  Всего attendance создано: ${stats.created.attendance ?? 0}`);
  console.log(`  Всего lesson_grades создано: ${stats.created.lesson_grades ?? 0}`);
  console.log(`  Всего homework_submissions создано: ${stats.created.homework_submissions ?? 0}`);
  console.log(`  Всего test_submissions создано: ${stats.created.test_submissions ?? 0}`);
  console.log(`  Ошибок: ${stats.errors.length}`);
  console.log(`  Время: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);
  if (stats.errors.length) console.log(`  Ошибки:`, JSON.stringify(stats.errors.slice(0, 10), null, 2));
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
