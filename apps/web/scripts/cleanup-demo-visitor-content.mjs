#!/usr/bin/env node
// 08.08.2026 — разовая ручная чистка демо-школы перед снятием снимка эталона.
//
// Правило заказчика в окончательном виде: удаляется ВСЁ, созданное в окне
// 05-07.08 включительно, без исключений, плюс уроки вне эталонной недели
// 27.07-02.08. Работа от 08.08 (этапы «Визуализация алгоритма» и Kahoot из
// коммита 856f445) — плановая, остаётся.
//
// Почему окно, а не «всё после эталона». Эталон создавался двумя заходами
// (29.07 и 30.07), а 08.08 добавлялась плановая работа — по created_at она
// неотличима от ручных проверок. Границы окна заданы явно, ровно по решению
// заказчика; дальше эталон фиксируется снимком (demo_baseline, миграция 179),
// и ночной откат сверяется уже с ним, а не с датами.
//
// Идемпотентен: повторный прогон найдёт ноль записей.
//
// ЗАПУСК (из apps/web):
//   node scripts/cleanup-demo-visitor-content.mjs           # прогон, ROLLBACK
//   node scripts/cleanup-demo-visitor-content.mjs --apply   # запись
//
// ПОСЛЕ ПРИМЕНЕНИЯ обязательно переснять снимок:
//   node scripts/snapshot-demo-baseline.mjs --apply

import fs from "node:fs";
import { resolveSchoolId } from "./_school-arg.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
// 26.08.2026: школа приходит аргументом --school, а не вписана сюда.
// Прежнее значение осталось как pinned: если указать другую школу, скрипт
// выйдет с ошибкой, а не применится молча не туда.
const DEMO_SCHOOL = resolveSchoolId({ pinned: "a0a0a0a0-0000-0000-0000-000000000001" });
const WEEK_FROM = "2026-07-27T00:00:00+05";
const WEEK_TO = "2026-08-03T00:00:00+05";
/** Окно ручных проверок. Верхняя граница — начало 08.08: плановая работа
 *  этого дня остаётся. */
const JUNK_FROM = "2026-08-05T00:00:00+05";
const JUNK_TO = "2026-08-08T00:00:00+05";

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await client.connect();

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

console.log(`Режим: ${APPLY ? "--apply (запись)" : "ХОЛОСТОЙ ПРОГОН, изменения откатываются"}\n`);

// ── 1. Уроки: вне эталонной недели ИЛИ созданные в окне ─────────────────────
const lessons = (
  await client.query(
    `SELECT l.id, g.name AS grp, COALESCE(l.title, l.topic, '—') AS title,
            to_char(l.starts_at + interval '5 hours', 'DD.MM.YYYY HH24:MI') AS when_,
            to_char(l.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created,
            (SELECT count(*)::int FROM lesson_stages x WHERE x.lesson_id = l.id) AS stages,
            (SELECT count(*)::int FROM attendance x WHERE x.lesson_id = l.id) AS attendance,
            (SELECT count(*)::int FROM lesson_grades x WHERE x.lesson_id = l.id) AS grades
       FROM lessons l JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1
        AND (NOT (l.starts_at >= $2 AND l.starts_at < $3)
             OR (l.created_at >= $4 AND l.created_at < $5))
      ORDER BY l.starts_at`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO, JUNK_FROM, JUNK_TO],
  )
).rows;
console.log("── 1. УРОКИ (вне эталонной недели или созданные 05-07.08) ──");
console.table(lessons.map((l) => ({
  когда: l.when_, создан: l.created, группа: l.grp, урок: l.title.slice(0, 30),
  этапов: l.stages, посещаемость: l.attendance, оценок: l.grades,
})));

// ── 2. Этапы, созданные в окне ──────────────────────────────────────────────
const stages = (
  await client.query(
    `SELECT st.id, st.title, COALESCE(st.content_type, '—') AS ct, g.name AS grp,
            to_char(st.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created,
            to_char(l.starts_at + interval '5 hours', 'DD.MM') AS lesson_day
       FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1 AND st.created_at >= $2 AND st.created_at < $3
      ORDER BY st.created_at`,
    [DEMO_SCHOOL, JUNK_FROM, JUNK_TO],
  )
).rows;
console.log("\n── 2. ЭТАПЫ, созданные 05-07.08 ──");
console.table(stages.map((s) => ({
  создан: s.created, группа: s.grp, урок_на: s.lesson_day, этап: s.title.slice(0, 32), тип: s.ct,
})));

// ── 3. Материалы, созданные в окне ──────────────────────────────────────────
const materials = (
  await client.query(
    `SELECT m.id, m.title, COALESCE(m.content_type, '—') AS ct, g.name AS grp,
            to_char(m.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created
       FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1 AND m.created_at >= $2 AND m.created_at < $3
      ORDER BY m.created_at`,
    [DEMO_SCHOOL, JUNK_FROM, JUNK_TO],
  )
).rows;
console.log("\n── 3. МАТЕРИАЛЫ, созданные 05-07.08 ──");
console.table(materials.map((m) => ({ создан: m.created, группа: m.grp, материал: m.title.slice(0, 32), тип: m.ct })));

// ── 4. Домашние задания, созданные в окне ───────────────────────────────────
// Сдачи учеников уходят каскадом (homework_submissions ON DELETE CASCADE).
// Заказчик решил так же, как с тестовым уроком: задание тестовое — значит и
// сдачи на нём тестовые. Числа показываем явно, чтобы решение было видимым.
const homework = (
  await client.query(
    `SELECT h.id, h.title, to_char(h.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created,
            (h.lesson_id IS NULL) AS no_lesson,
            (SELECT count(*)::int FROM homework_submissions s WHERE s.homework_id = h.id) AS subs,
            (SELECT count(*)::int FROM homework_submissions s WHERE s.homework_id = h.id AND s.grade IS NOT NULL) AS graded
       FROM homework h
      WHERE h.school_id = $1 AND h.created_at >= $2 AND h.created_at < $3
      ORDER BY h.created_at`,
    [DEMO_SCHOOL, JUNK_FROM, JUNK_TO],
  )
).rows;
console.log("\n── 4. ДОМАШНИЕ ЗАДАНИЯ, созданные 05-07.08 ──");
console.table(homework.map((h) => ({
  создан: h.created, дз: h.title.slice(0, 36), без_урока: h.no_lesson, сдач: h.subs, с_оценкой: h.graded,
})));

// ── Стоп-условия ────────────────────────────────────────────────────────────
if (lessons.length > 5) fail(`уроков к удалению ${lessons.length} — ожидалось не больше 5`);
if (stages.length > 15) fail(`этапов к удалению ${stages.length} — слишком много, проверь окно`);
if (materials.length > 15) fail(`материалов к удалению ${materials.length} — слишком много`);
if (homework.length > 10) fail(`заданий к удалению ${homework.length} — слишком много`);

const beforeWeek = (
  await client.query(
    `SELECT count(*)::int AS n FROM lessons WHERE school_id = $1 AND starts_at >= $2 AND starts_at < $3`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO],
  )
).rows[0].n;
if (beforeWeek !== 126) fail(`в эталонной неделе ${beforeWeek} уроков вместо 126 — состояние не то`);

const otherSchools = (
  await client.query(`SELECT count(*)::int AS n FROM lessons WHERE school_id <> $1`, [DEMO_SCHOOL])
).rows[0].n;
console.log(`\nУроков в ДРУГИХ школах: ${otherSchools} — их не касаемся ничем.`);

await client.query("BEGIN");

const del = async (table, ids) =>
  ids.length ? (await client.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [ids])).rowCount : 0;

const delLessons = await del("lessons", lessons.map((r) => r.id));
const delStages = await del("lesson_stages", stages.map((r) => r.id));
const delMaterials = await del("lesson_materials", materials.map((r) => r.id));
const delHomework = await del("homework", homework.map((r) => r.id));

console.log(`\nУдалено: уроков ${delLessons}, этапов ${delStages}, материалов ${delMaterials}, заданий ${delHomework}`);

const after = (
  await client.query(
    `SELECT
       (SELECT count(*)::int FROM lessons WHERE school_id = $1 AND starts_at >= $2 AND starts_at < $3) AS уроков_недели,
       (SELECT count(*)::int FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id WHERE l.school_id = $1) AS этапов,
       (SELECT count(*)::int FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id WHERE l.school_id = $1) AS материалов,
       (SELECT count(*)::int FROM homework WHERE school_id = $1) AS заданий,
       (SELECT count(*)::int FROM lessons WHERE school_id <> $1) AS уроков_других_школ`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO],
  )
).rows[0];
console.table([after]);

if (after.уроков_недели !== 126) {
  await client.query("ROLLBACK");
  fail(`после удаления в эталонной неделе ${after.уроков_недели} уроков вместо 126`);
}
if (after.уроков_других_школ !== otherSchools) {
  await client.query("ROLLBACK");
  fail("изменилось число уроков в других школах — этого быть не должно");
}

if (APPLY) {
  await client.query("COMMIT");
  console.log("\nПРИМЕНЕНО. Не забудь переснять снимок: node scripts/snapshot-demo-baseline.mjs --apply");
} else {
  await client.query("ROLLBACK");
  console.log("\nХолостой прогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
