#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 1 — полная зачистка учебных данных демо-школы
// перед регенерацией новой недели (27.07-02.08). Скрипт написан и
// закоммичен, НЕ запускался на проде — только dry-run. Реальное удаление
// (--confirm) запускает пользователь сам.
//
// ЦЕЛЬ: убрать ВСЕ учебные данные демо-школы (school_id=a0a0a0a0-...) БЕЗ
// фильтра по датам — весь костяк (пользователи, школы, группы, предметы,
// БЗ-книги, чат-треды) остаётся нетронутым.
//
// СХЕМА (проверено разведкой по supabase/migrations/*.sql в этой сессии):
// каждая из 25 таблиц ниже имеет СВОЙ прямой столбец school_id — никакого
// резолва id родителя через join не требуется (в отличие от
// cleanup-jul7-jul26.mjs, где lessons/homework резолвились по датам, а
// дочерние таблицы — по id родителя). Удаление — просто
// `DELETE ... WHERE school_id = $1` по каждой таблице.
//
// ПОРЯДОК (листья → корень) — единственное жёсткое ограничение во всём
// списке: test_answers.selected_option_id → test_question_options это
// NO ACTION (не CASCADE), поэтому test_answers обязан удаляться РАНЬШE
// test_question_options. Всё остальное в списке — CASCADE или SET NULL от
// lessons/homework/quiz_attempts/quiz_questions, так что порядок между
// остальными шагами не критичен (более ранние удаления просто каскадом
// подчищают часть более поздних — повторный DELETE по school_id на уже
// пустом множестве идемпотентен, 0 строк, не ошибка).
//
// ПОБОЧНЫЕ ЭФФЕКТЫ КАСКАДА (НЕ в списке 25 таблиц, отдельно не удаляются,
// но исчезнут автоматически вместе с родителем — см. отчёт разведки):
//   - classwork/classwork_questions/classwork_submissions — CASCADE от lessons
//   - homework_subtasks/homework_subtask_submissions — CASCADE от homework
//   - quiz_answers — CASCADE от quiz_questions/quiz_attempts
//   - ai_chat_messages, leave_requests, lesson_excuse_requests — CASCADE от lessons
//   - project_stage_progress/project_attachments — CASCADE от project_submissions
//   - curriculum_plan_topics — CASCADE от curriculum_plans
//   - announcement_reads/announcement_user_reads — CASCADE от announcements
// Скрипт печатает их дополнительно в dry-run ТОЛЬКО для информации (не
// удаляет их сам — родительский DELETE и так их каскадом уберёт).
//
// ЧТО НЕ ТРОГАЕТ: schools, users/students/teachers/parents/admins/
// super_admins, groups, subjects, group_teachers, books, chat_threads,
// chat_participants, demo_leases, user_sessions, schema_migrations,
// projects (сама таблица проектов — удаляются только project_submissions),
// реальную школу SNR International (b0b0b0b0-...) — фильтр по school_id
// физически не может её задеть.
//
// БЕЗОПАСНОСТЬ:
//   - Dry-run по умолчанию — только COUNT(*) через {count:"exact",
//     head:true} (агрегат, ни одной строки не читает и не пишет).
//   - --confirm — реальное удаление.
//   - Идемпотентно: DELETE WHERE school_id=... на пустом множестве — 0 строк,
//     не ошибка. Повторный запуск безопасен.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/clean-all-lesson-data.mjs             — dry-run
//   node --env-file=.env.local scripts/clean-all-lesson-data.mjs --confirm   — реальное удаление

import { createClient } from "@supabase/supabase-js";
import { resolveSchoolId } from "./_school-arg.mjs";
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

// 26.08.2026: школа приходит аргументом --school. Прежнее значение осталось
// как pinned — указать другую школу этому скрипту нельзя: он перечисляет
// 25 таблиц демо поимённо и на боевой означал бы совсем другое.
const DEMO_SCHOOL_ID = resolveSchoolId({ pinned: "a0a0a0a0-0000-0000-0000-000000000001" });
const REAL_SCHOOL_ID = "b0b0b0b0-0000-0000-0000-000000000001"; // только для sanity-проверки в конце, не трогаем

const argv = process.argv.slice(2);
const CONFIRM = argv.includes("--confirm");
const DRY_RUN = !CONFIRM;

console.log("═".repeat(74));
console.log(`Зачистка учебных данных демо-школы (school_id=${DEMO_SCHOOL_ID})`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (только COUNT, ничего не удаляется)" : "БОЕВОЙ (--confirm) — реальное удаление"}`);
console.log("═".repeat(74));

// Порядок — листья → корень (см. комментарий в шапке файла).
const TABLES = [
  "quiz_attempts",
  "test_answers",                  // ДО test_question_options — единственное жёсткое ограничение
  "ai_homework_review_queue",
  "lesson_stages_embedding_queue",
  "lesson_stage_embeddings",
  "lesson_stage_progress",
  "kahoot_sessions",
  "quiz_questions",
  "test_question_options",
  "test_questions",
  "test_submissions",
  "homework_submissions",
  "course_materials",
  "lesson_grades",
  "lesson_raised_hands",
  "attendance",
  "lesson_materials",
  "lesson_stages",
  "homework",
  "lessons",
  "curriculum_plans",
  "announcements",
  "chat_messages",
  "notifications",
  "project_submissions",
];

// Побочные эффекты каскада — только для информации в dry-run, отдельно не
// удаляются (см. комментарий в шапке файла).
const CASCADE_SIDE_EFFECTS = [
  { table: "classwork", col: "school_id" },
  { table: "classwork_questions", col: null },       // резолвится через classwork.id, только для примерного счёта — см. ниже
  { table: "classwork_submissions", col: null },
  { table: "homework_subtasks", col: "school_id" },
  { table: "homework_subtask_submissions", col: null },
  { table: "quiz_answers", col: "school_id" },
  { table: "ai_chat_messages", col: "school_id" },
  { table: "leave_requests", col: "school_id" },
  { table: "lesson_excuse_requests", col: "school_id" },
  { table: "project_stage_progress", col: "school_id" },
  { table: "project_attachments", col: "school_id" },
  { table: "curriculum_plan_topics", col: null },    // нет собственного school_id — только plan_id → curriculum_plans (CASCADE)
  { table: "announcement_reads", col: "school_id" },
  { table: "announcement_user_reads", col: "school_id" },
];

const totals = {};

async function countOrDelete(table) {
  if (DRY_RUN) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq("school_id", DEMO_SCHOOL_ID);
    if (error) throw new Error(`${table} dry-count failed: ${error.message}`);
    return count ?? 0;
  }
  const { count, error } = await db.from(table).delete({ count: "exact" }).eq("school_id", DEMO_SCHOOL_ID);
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log(`\n── Основные ${TABLES.length} таблиц (порядок: листья → корень) ──\n`);
  for (let i = 0; i < TABLES.length; i++) {
    const table = TABLES[i];
    const label = `[${i + 1}/${TABLES.length}] ${DRY_RUN ? "Would delete" : "Deleting"} ${table} where school_id=${DEMO_SCHOOL_ID}`;
    const n = await countOrDelete(table);
    console.log(`${label} — deleted ${n} rows`);
    totals[table] = n;
  }

  console.log("\n── Побочные эффекты каскада (информационно, отдельно НЕ удаляются) ──\n");
  // classwork/classwork_questions/classwork_submissions и
  // homework_subtask_submissions не имеют собственного school_id-фильтра,
  // удобного для одного .eq() — считаем только те, у кого есть прямой
  // school_id; остальные помечаем как "каскад от родителя, счёт не выводим"
  // (это ЧИСТО информационная секция, ничего не удаляет).
  for (const { table, col } of CASCADE_SIDE_EFFECTS) {
    if (!col) {
      console.log(`  ${table} — каскад от родителя (не в school_id-таблицах), счёт не выводится`);
      continue;
    }
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(col, DEMO_SCHOOL_ID);
    if (error) {
      console.log(`  ${table} — ошибка подсчёта (${error.message}), пропуск`);
      continue;
    }
    console.log(`  ${table} — ${count ?? 0} строк исчезнут вместе с родителем`);
  }

  console.log("\n" + "═".repeat(74));
  console.log(DRY_RUN ? "DRY-RUN ЗАВЕРШЁН — ничего не удалено. Для реального удаления: --confirm" : "УДАЛЕНИЕ ЗАВЕРШЕНО.");
  console.log("Итого по основным таблицам:");
  for (const [table, n] of Object.entries(totals)) {
    if (n > 0) console.log(`  ${table}: ${n}`);
  }
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`ВСЕГО строк ${DRY_RUN ? "было бы удалено" : "удалено"}: ${grandTotal}`);
  console.log("═".repeat(74));

  if (!DRY_RUN) {
    const { count: remaining } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", DEMO_SCHOOL_ID);
    console.log(`Проверка: уроков демо-школы осталось (ожидание 0) — ${remaining ?? "?"}`);
    const { count: realSchoolLessons } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", REAL_SCHOOL_ID);
    console.log(`Sanity-check: уроков реальной школы (не должно было измениться) — ${realSchoolLessons ?? "?"}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
