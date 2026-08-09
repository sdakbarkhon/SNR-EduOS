#!/usr/bin/env node
// 08.08.2026 — разовая ручная чистка демо-школы перед снятием снимка эталона.
//
// Удаляет то, что заказчик опознал как ручные проверки посетителей и наши
// собственные тесты механики. Это ОДИН раз: дальше эталон фиксируется
// снимком, и ночной откат сверяется с ним, а не с датами создания.
//
// Почему не по дате создания. Эталон создавался двумя заходами (29.07 и
// 30.07), а в окне 05-08.08 лежат вперемешку и мусор посетителей, и наша
// плановая работа из коммита 856f445 — отличить их по created_at нельзя.
// Поэтому здесь всё перечислено ЯВНО, по меткам времени.
//
// ЗАПУСК (из apps/web):
//   node scripts/cleanup-demo-visitor-content.mjs           # прогон, ROLLBACK
//   node scripts/cleanup-demo-visitor-content.mjs --apply   # запись

import fs from "node:fs";
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
const DEMO_SCHOOL = "a0a0a0a0-0000-0000-0000-000000000001";
const WEEK_FROM = "2026-07-27T00:00:00+05";
const WEEK_TO = "2026-08-03T00:00:00+05";

/** Этапы ручных проверок. Перечислены окнами времени создания, а не «всё до
 *  08.08»: пять этапов от 08.08 (визуализация алгоритма и Kahoot, коммит
 *  856f445) — плановая работа, их оставляем. */
const STAGE_WINDOWS = [
  ["2026-08-05T00:00:00+05", "2026-08-06T00:00:00+05"], // «Код с пропусками» ×2
  ["2026-08-07T12:15:00+05", "2026-08-07T12:30:00+05"], // блок 10-А из 4 этапов
  ["2026-08-07T20:25:00+05", "2026-08-07T20:35:00+05"], // Kahoot 7-А
];

/** Материалы-мусор — по точным названиям, а не по дате. */
const JUNK_MATERIAL_TITLES = ["1", "1234", "123", "You Tube"];

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

console.log(`Режим: ${APPLY ? "--apply (запись)" : "ХОЛОСТОЙ ПРОГОН, изменения откатываются"}\n`);

// ── 1. Уроки вне эталонной недели ───────────────────────────────────────────
const lessons = (
  await client.query(
    `SELECT l.id, g.name AS grp, COALESCE(l.title, l.topic, '—') AS title,
            to_char(l.starts_at + interval '5 hours', 'DD.MM.YYYY HH24:MI') AS when_,
            (SELECT count(*)::int FROM lesson_stages x WHERE x.lesson_id = l.id) AS stages,
            (SELECT count(*)::int FROM lesson_materials x WHERE x.lesson_id = l.id) AS materials,
            (SELECT count(*)::int FROM attendance x WHERE x.lesson_id = l.id) AS attendance,
            (SELECT count(*)::int FROM lesson_grades x WHERE x.lesson_id = l.id) AS grades
       FROM lessons l JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1 AND NOT (l.starts_at >= $2 AND l.starts_at < $3)
      ORDER BY l.starts_at`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO],
  )
).rows;
console.log("── 1. УРОКИ ВНЕ ЭТАЛОННОЙ НЕДЕЛИ (удаляются целиком, каскадом) ──");
console.table(lessons.map((l) => ({
  когда: l.when_, группа: l.grp, урок: l.title.slice(0, 34),
  этапов: l.stages, материалов: l.materials, посещаемость: l.attendance, оценок: l.grades,
})));

// ── 2. Этапы ручных проверок внутри эталонной недели ────────────────────────
const stageRows = [];
for (const [from, to] of STAGE_WINDOWS) {
  const r = (
    await client.query(
      `SELECT st.id, st.title, COALESCE(st.content_type, '—') AS ct, g.name AS grp,
              to_char(st.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created,
              to_char(l.starts_at + interval '5 hours', 'DD.MM') AS lesson_day
         FROM lesson_stages st
         JOIN lessons l ON l.id = st.lesson_id
         JOIN groups g ON g.id = l.group_id
        WHERE l.school_id = $1 AND l.starts_at >= $2 AND l.starts_at < $3
          AND st.created_at >= $4 AND st.created_at < $5
        ORDER BY st.created_at`,
      [DEMO_SCHOOL, WEEK_FROM, WEEK_TO, from, to],
    )
  ).rows;
  stageRows.push(...r);
}
console.log("\n── 2. ЭТАПЫ РУЧНЫХ ПРОВЕРОК (внутри эталонной недели) ──");
console.table(stageRows.map((s) => ({
  создан: s.created, группа: s.grp, урок_на: s.lesson_day, этап: s.title.slice(0, 32), тип: s.ct,
})));

// Соседи по окну, которые НЕ удаляются, — чтобы было видно, что осталось.
const keptLate = (
  await client.query(
    `SELECT to_char(st.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created,
            g.name AS grp, st.title, COALESCE(st.content_type,'—') AS ct
       FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1 AND l.starts_at >= $2 AND l.starts_at < $3
        AND st.created_at >= '2026-08-01' AND st.id <> ALL($4::uuid[])
      ORDER BY st.created_at`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO, stageRows.map((s) => s.id)],
  )
).rows;
console.log("\n   ОСТАЮТСЯ (созданы в том же окне, но это плановая работа):");
console.table(keptLate.map((s) => ({ создан: s.created, группа: s.grp, этап: s.title.slice(0, 34), тип: s.ct })));

// ── 3. Материалы-мусор ──────────────────────────────────────────────────────
const junk = (
  await client.query(
    `SELECT m.id, m.title, COALESCE(m.content_type,'—') AS ct, g.name AS grp,
            to_char(m.created_at + interval '5 hours', 'DD.MM HH24:MI') AS created
       FROM lesson_materials m
       JOIN lessons l ON l.id = m.lesson_id
       JOIN groups g ON g.id = l.group_id
      WHERE l.school_id = $1 AND m.title = ANY($2::text[])
      ORDER BY m.created_at`,
    [DEMO_SCHOOL, JUNK_MATERIAL_TITLES],
  )
).rows;
console.log("\n── 3. МАТЕРИАЛЫ-МУСОР ──");
console.table(junk.map((m) => ({ создан: m.created, группа: m.grp, материал: m.title, тип: m.ct })));

// ── Стоп-условия ────────────────────────────────────────────────────────────
if (lessons.length > 5) fail(`уроков к удалению ${lessons.length} — ожидалось не больше 5, разбирайся вручную`);
if (stageRows.length > 15) fail(`этапов к удалению ${stageRows.length} — слишком много, проверь окна`);
if (junk.length > 10) fail(`материалов к удалению ${junk.length} — слишком много, проверь названия`);

const beforeWeek = (
  await client.query(
    `SELECT count(*)::int AS n FROM lessons WHERE school_id = $1 AND starts_at >= $2 AND starts_at < $3`,
    [DEMO_SCHOOL, WEEK_FROM, WEEK_TO],
  )
).rows[0].n;
if (beforeWeek !== 126) fail(`в эталонной неделе ${beforeWeek} уроков вместо 126 — состояние не то, чего ожидаем`);

const otherSchools = (
  await client.query(`SELECT count(*)::int AS n FROM lessons WHERE school_id <> $1`, [DEMO_SCHOOL])
).rows[0].n;
console.log(`\nУроков в ДРУГИХ школах: ${otherSchools} — их не касаемся ничем.`);

await client.query("BEGIN");

const delLessons = lessons.length
  ? (await client.query(`DELETE FROM lessons WHERE id = ANY($1::uuid[])`, [lessons.map((l) => l.id)])).rowCount
  : 0;
const delStages = stageRows.length
  ? (await client.query(`DELETE FROM lesson_stages WHERE id = ANY($1::uuid[])`, [stageRows.map((s) => s.id)])).rowCount
  : 0;
const delJunk = junk.length
  ? (await client.query(`DELETE FROM lesson_materials WHERE id = ANY($1::uuid[])`, [junk.map((m) => m.id)])).rowCount
  : 0;

console.log(`\nУдалено: уроков ${delLessons}, этапов ${delStages}, материалов ${delJunk}`);

// ── Проверка после удаления, внутри той же транзакции ───────────────────────
const after = (
  await client.query(
    `SELECT
       (SELECT count(*)::int FROM lessons WHERE school_id = $1 AND starts_at >= $2 AND starts_at < $3) AS уроков_недели,
       (SELECT count(*)::int FROM lessons WHERE school_id = $1) AS уроков_всего,
       (SELECT count(*)::int FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id
         WHERE l.school_id = $1) AS этапов,
       (SELECT count(*)::int FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id
         WHERE l.school_id = $1) AS материалов,
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
  console.log("\nПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("\nХолостой прогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
