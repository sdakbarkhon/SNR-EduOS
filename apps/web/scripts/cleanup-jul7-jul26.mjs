#!/usr/bin/env node
// Очистка БД 7-26 июля 2026 — ЗАХОД 1: скрипт написан и закоммичен, НЕ
// запускался на проде. Запускает менеджер вручную (dry-run сначала).
//
// ЦЕЛЬ: перед демо-показом оставить в БД только 2 свежие недели (20-26 июля
// удаляется-и-регенерируется скриптом regenerate-jul20-aug2.mjs, 27 июля -
// 2 августа генерируется как обычная будущая неделя). Всё 7-19 июля просто
// удаляется без регенерации. Этот скрипт отвечает ТОЛЬКО за удаление
// 7-26 июля включительно (оба под-диапазона — 20-26 тоже стирается здесь,
// регенерация — отдельный скрипт).
//
// ГРАНИЦЫ: starts_at (для lessons) / due_date∪created_at (для homework) /
// created_at (для chat_messages) попадающие в [--start-date 00:00,
// --end-date+1день 00:00) по Asia/Tashkent (+05:00). По умолчанию
// 2026-07-07..2026-07-26 включительно.
//
// СХЕМА (проверено live-запросами к hosted БД в этой сессии, разведка —
// см. resheniya_2.md/отчёт заказчику для полного списка таблиц и счётчиков):
//   - lessons.id ON DELETE CASCADE → lesson_stages, attendance,
//     lesson_materials, classwork(→classwork_questions,classwork_submissions),
//     lesson_excuse_requests, lesson_raised_hands, ai_chat_messages,
//     lesson_grades, leave_requests.
//   - lesson_stages.id ON DELETE CASCADE → lesson_stage_progress,
//     quiz_questions(→quiz_answers), quiz_attempts(→quiz_answers),
//     kahoot_sessions, course_materials.stage_id, lesson_stage_embeddings,
//     lesson_stages_embedding_queue (RAG).
//   - homework.lesson_id — ON DELETE SET NULL, НЕ CASCADE. Живой запрос
//     подтвердил: lesson_id у ВСЕХ существующих homework сейчас NULL — ДЗ в
//     этом проекте фактически не привязаны к конкретному уроку, только к
//     group_id/due_date/created_at (см. комментарий в scripts/backfill-
//     homework.mjs). Поэтому homework НЕ чистится каскадом от lessons —
//     нужен отдельный корневой DELETE по due_date∪created_at.
//   - homework.id ON DELETE CASCADE → test_questions(→test_question_options),
//     test_submissions(→test_answers), homework_subtasks(→
//     homework_subtask_submissions), homework_submissions(→
//     homework_subtask_submissions, ai_homework_review_queue).
//   - chat_threads — НЕ трогаем (треды не привязаны к дате). Чистим только
//     chat_messages.created_at в диапазоне; chat_participants/
//     chat_read_state не каскадируют от chat_messages (last_read_message_id
//     — SET NULL), трогать не нужно.
//   - course_materials — ДВЕ разные FK на lessons: stage_id (CASCADE, для
//     авто-опубликованных AI-презентаций) и lesson_id (SET NULL, для
//     вручную загруженных материалов группы). Этот скрипт удаляет только
//     ветку через stage_id (она и так каскадно уйдёт вместе со stage) —
//     строки с только lesson_id (без stage_id) сознательно НЕ удаляются:
//     это материалы уровня группы, не привязанные к конкретной дате урока
//     жёстче, чем к его существованию; после удаления урока lesson_id у них
//     просто станет NULL (примерно 100 строк по живому счёту на момент
//     разведки — см. отчёт).
//
// РЕЖИМ: dry-run по умолчанию — ничего не пишет, только считает и печатает.
// --confirm — реальное удаление. Идемпотентно: каждый шаг заново вычисляет
// текущие id по актуальному состоянию БД и удаляет "то, что ещё есть"; при
// падении на середине повторный запуск безопасно продолжит (ничего не
// задвоится, ничего не будет пропущено). НЕ единая SQL-транзакция — supabase-
// js/PostgREST не даёт обернуть произвольную последовательность DELETE по
// разным таблицам в один BEGIN/COMMIT (как и все прежние скрипты в этом
// репозитории — cleanup-lessons-jul18-31.sql делает это через один SQL-файл
// в Dashboard, а не через JS-клиент); вместо транзакции — идемпотентность +
// чанкинг по 300 id на запрос (безопасный размер IN-списка для PostgREST).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/cleanup-jul7-jul26.mjs                     — dry-run
//   node --env-file=.env.local scripts/cleanup-jul7-jul26.mjs --confirm           — реальное удаление
//   node --env-file=.env.local scripts/cleanup-jul7-jul26.mjs --start-date=2026-07-07 --end-date=2026-07-26 --confirm

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

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
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, def) {
  const pfx = `--${name}=`;
  const found = argv.find((a) => a.startsWith(pfx));
  return found ? found.slice(pfx.length) : def;
}
const CONFIRM = flag("confirm");
const DRY_RUN = !CONFIRM;
const START_DATE = opt("start-date", "2026-07-07");
const END_DATE = opt("end-date", "2026-07-26"); // inclusive
const TZ_OFFSET = "+05:00";
const START_ISO = `${START_DATE}T00:00:00${TZ_OFFSET}`;
const END_EXCL_ISO = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(74));
console.log(`Очистка БД: ${START_DATE}..${END_DATE} (Asia/Tashkent, включительно)`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не удаляется)" : "БОЕВОЙ (--confirm) — реальное удаление"}`);
console.log("═".repeat(74));

// ── helpers ─────────────────────────────────────────────────────────────
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
async function selectIds(table, filterFn, selectCol = "id") {
  const { data, error } = await filterFn(db.from(table).select(selectCol));
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return (data ?? []).map((r) => r[selectCol]);
}
async function selectIdsIn(table, col, ids, selectCol = "id") {
  if (ids.length === 0) return [];
  let out = [];
  for (const c of chunk(ids, 300)) {
    const { data, error } = await db.from(table).select(selectCol).in(col, c);
    if (error) throw new Error(`${table}.${col} select failed: ${error.message}`);
    out = out.concat((data ?? []).map((r) => r[selectCol]));
  }
  return out;
}

let stepNo = 0;
const totals = {};
/** Удаляет строки table, где col IN ids (чанками). Возвращает удалённое кол-во.
 *  dry-run: только считает (не пишет). Идемпотентно — повторный вызов на уже
 *  пустом множестве просто вернёт 0. */
async function deleteWhereIn(table, col, ids, totalSteps) {
  stepNo++;
  const label = `[${stepNo}/${totalSteps}] ${DRY_RUN ? "Would delete" : "Deleting"} ${table} where ${col} in (...)`;
  if (ids.length === 0) {
    console.log(`${label} — 0 кандидатов, пропуск.`);
    totals[table] = (totals[table] ?? 0) + 0;
    return 0;
  }
  let deleted = 0;
  for (const c of chunk(ids, 300)) {
    if (DRY_RUN) {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(col, c);
      if (error) throw new Error(`${table} dry-count failed: ${error.message}`);
      deleted += count ?? 0;
    } else {
      const { data, error } = await db.from(table).delete().in(col, c).select("*");
      if (error) throw new Error(`${table} delete failed: ${error.message}`);
      deleted += data?.length ?? 0;
    }
  }
  console.log(`${label} — ${deleted} строк.`);
  totals[table] = (totals[table] ?? 0) + deleted;
  return deleted;
}
async function deleteWhereRange(table, col, totalSteps) {
  stepNo++;
  const label = `[${stepNo}/${totalSteps}] ${DRY_RUN ? "Would delete" : "Deleting"} ${table} where ${col} in range`;
  if (DRY_RUN) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).gte(col, START_ISO).lt(col, END_EXCL_ISO);
    if (error) throw new Error(`${table} dry-count failed: ${error.message}`);
    console.log(`${label} — ${count ?? 0} строк.`);
    totals[table] = (totals[table] ?? 0) + (count ?? 0);
    return count ?? 0;
  }
  const { data, error } = await db.from(table).delete().gte(col, START_ISO).lt(col, END_EXCL_ISO).select("*");
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
  console.log(`${label} — ${data?.length ?? 0} строк.`);
  totals[table] = (totals[table] ?? 0) + (data?.length ?? 0);
  return data?.length ?? 0;
}

async function main() {
  const TOTAL_STEPS = 32; // 1 chat_messages + 10 дерево homework + 21 дерево lessons

  // ── Резолв id ДО удаления (чтобы дочерние DELETE знали, что удалять) ────
  const lessonIds = await selectIds("lessons", (q) => q.gte("starts_at", START_ISO).lt("starts_at", END_EXCL_ISO));
  console.log(`\nУроков в диапазоне: ${lessonIds.length}`);

  const { data: hwRows, error: hwErr } = await db
    .from("homework")
    .select("id")
    .or(`and(due_date.gte.${START_ISO},due_date.lt.${END_EXCL_ISO}),and(created_at.gte.${START_ISO},created_at.lt.${END_EXCL_ISO})`);
  if (hwErr) throw new Error(`homework select failed: ${hwErr.message}`);
  const homeworkIds = (hwRows ?? []).map((r) => r.id);
  console.log(`ДЗ в диапазоне (due_date ИЛИ created_at): ${homeworkIds.length}`);

  const stageIds = await selectIdsIn("lesson_stages", "lesson_id", lessonIds);
  const classworkIds = await selectIdsIn("classwork", "lesson_id", lessonIds);
  const questionIds = await selectIdsIn("quiz_questions", "stage_id", stageIds);
  const attemptIds = await selectIdsIn("quiz_attempts", "stage_id", stageIds);
  const submissionIds = await selectIdsIn("homework_submissions", "homework_id", homeworkIds);
  const testSubIds = await selectIdsIn("test_submissions", "homework_id", homeworkIds);
  const subtaskIds = await selectIdsIn("homework_subtasks", "homework_id", homeworkIds);

  console.log("\n── Порядок: сначала chat_messages, потом дерево ДЗ (листья→корень homework), потом дерево уроков (листья→корень lessons) ──\n");

  // ── 0. chat_messages (независимо, треды НЕ трогаем) ─────────────────────
  await deleteWhereRange("chat_messages", "created_at", TOTAL_STEPS);

  // ── Дерево homework: листья → корень ─────────────────────────────────
  await deleteWhereIn("test_answers", "submission_id", testSubIds, TOTAL_STEPS);
  const testQuestionIds = await selectIdsIn("test_questions", "homework_id", homeworkIds);
  await deleteWhereIn("test_question_options", "question_id", testQuestionIds, TOTAL_STEPS);
  await deleteWhereIn("ai_homework_review_queue", "submission_id", submissionIds, TOTAL_STEPS);
  await deleteWhereIn("homework_subtask_submissions", "submission_id", submissionIds, TOTAL_STEPS);
  await deleteWhereIn("homework_subtask_submissions", "subtask_id", subtaskIds, TOTAL_STEPS);
  await deleteWhereIn("homework_subtasks", "homework_id", homeworkIds, TOTAL_STEPS);
  await deleteWhereIn("test_submissions", "homework_id", homeworkIds, TOTAL_STEPS);
  await deleteWhereIn("test_questions", "homework_id", homeworkIds, TOTAL_STEPS);
  await deleteWhereIn("homework_submissions", "homework_id", homeworkIds, TOTAL_STEPS);
  await deleteWhereIn("homework", "id", homeworkIds, TOTAL_STEPS);

  // ── Дерево lessons: листья → корень ──────────────────────────────────
  await deleteWhereIn("quiz_answers", "question_id", questionIds, TOTAL_STEPS);
  await deleteWhereIn("quiz_answers", "attempt_id", attemptIds, TOTAL_STEPS);
  await deleteWhereIn("quiz_attempts", "stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("quiz_questions", "stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("kahoot_sessions", "stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_stage_progress", "stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_stage_embeddings", "lesson_stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_stages_embedding_queue", "lesson_stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("course_materials", "stage_id", stageIds, TOTAL_STEPS);
  await deleteWhereIn("classwork_submissions", "classwork_id", classworkIds, TOTAL_STEPS);
  await deleteWhereIn("classwork_questions", "classwork_id", classworkIds, TOTAL_STEPS);
  await deleteWhereIn("classwork", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_excuse_requests", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_raised_hands", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("ai_chat_messages", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_grades", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("leave_requests", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("attendance", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_materials", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lesson_stages", "lesson_id", lessonIds, TOTAL_STEPS);
  await deleteWhereIn("lessons", "id", lessonIds, TOTAL_STEPS);

  // ── Итог ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(74));
  console.log(DRY_RUN ? "DRY-RUN ЗАВЕРШЁН — ничего не удалено. Для реального удаления: --confirm" : "УДАЛЕНИЕ ЗАВЕРШЕНО.");
  console.log("Итого по таблицам:");
  for (const [table, n] of Object.entries(totals)) {
    if (n > 0) console.log(`  ${table}: ${n}`);
  }
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`ВСЕГО строк ${DRY_RUN ? "было бы удалено" : "удалено"}: ${grandTotal}`);
  console.log("═".repeat(74));

  if (!DRY_RUN) {
    const { count: remainingLessons } = await db.from("lessons").select("*", { count: "exact", head: true }).gte("starts_at", START_ISO).lt("starts_at", END_EXCL_ISO);
    console.log(`Проверка: уроков осталось в диапазоне (ожидание 0) — ${remainingLessons ?? "?"}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
