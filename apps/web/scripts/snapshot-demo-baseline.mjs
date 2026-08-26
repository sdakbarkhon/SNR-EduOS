#!/usr/bin/env node
// 08.08.2026 — снять снимок эталона демо-школы в таблицу demo_baseline
// (миграция 179).
//
// Ночной откат удаляет из демо-школы всё, чего в снимке нет. Значит снимок —
// это определение «как демо должно выглядеть», и переснимать его нужно
// ПОСЛЕ каждого планового пополнения демо: добавили урок или этап, прогнали
// этот скрипт — иначе ближайшей ночью новое сотрётся как чужое.
//
// Снимок ПОЛНОСТЬЮ перезаписывается: снимаем состояние как есть, а не
// дописываем. Так исключено, что в снимке останется идентификатор давно
// удалённой записи.
//
// ЗАПУСК (из apps/web):
//   node scripts/snapshot-demo-baseline.mjs           # прогон, ROLLBACK
//   node scripts/snapshot-demo-baseline.mjs --apply   # запись

import fs from "node:fs";
import { resolveSchoolId, assertSchoolExists } from "./_school-arg.mjs";
import { requireYes } from "./_confirm.mjs";
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
// 26.08.2026: школа приходит аргументом --school. Прежнее значение осталось
// как pinned — снимок эталона имеет смысл только для демо-школы.
const DEMO_SCHOOL = resolveSchoolId({ pinned: "a0a0a0a0-0000-0000-0000-000000000001" });

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

await assertSchoolExists(client, DEMO_SCHOOL);

// 26.08.2026 — ЧЕМ НЫНЕШНЕЕ СОСТОЯНИЕ ОТЛИЧАЕТСЯ ОТ ЭТАЛОНА.
//
// Скрипт перезаписывает эталон текущим состоянием. Если в демо-школе что-то
// испорчено — гость наследил, скрипт отработал не так, урок удалили — порча
// станет НОВЫМ ЭТАЛОНОМ, и ночной откат начнёт её защищать. Поэтому перед
// записью показываем расхождение и просим подтверждения.
{
  const было = (await client.query(
    `SELECT entity_type AS вид, count(*)::int AS штук FROM demo_baseline
      WHERE school_id = $1 GROUP BY 1 ORDER BY 1`, [DEMO_SCHOOL])).rows;
  console.log("\n── В ЭТАЛОНЕ СЕЙЧАС ──");
  if (было.length) console.table(было);
  else console.log("  эталон пуст — это первая съёмка");

  const станет = [];
  for (const [type, select] of [
    ["lesson", `SELECT id FROM lessons WHERE school_id = $1`],
    ["lesson_stage", `SELECT st.id FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id WHERE l.school_id = $1`],
    ["lesson_material", `SELECT m.id FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id WHERE l.school_id = $1`],
  ]) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM (${select}) x`, [DEMO_SCHOOL]);
    станет.push({ вид: type, штук: rows[0].n });
  }
  console.log("\n── СТАНЕТ ЭТАЛОНОМ ──");
  console.table(станет);

  const картаБыло = new Map(было.map((r) => [r.вид, r.штук]));
  const расхождения = станет
    .map((r) => ({ вид: r.вид, было: картаБыло.get(r.вид) ?? 0, станет: r.штук }))
    .filter((r) => r.было !== r.станет)
    .map((r) => ({ ...r, разница: (r.станет - r.было > 0 ? "+" : "") + (r.станет - r.было) }));

  console.log("\n── РАСХОЖДЕНИЕ ──");
  if (расхождения.length) {
    console.table(расхождения);
    console.log("ВНИМАНИЕ: всё, что тут видно, станет новым эталоном — включая");
    console.log("порчу, если она есть. Ночной откат будет возвращать демо-школу");
    console.log("к ЭТОМУ состоянию, а не к прежнему.");
  } else {
    console.log("  нет: нынешнее состояние совпадает с эталоном");
  }
}

if (APPLY) await requireYes("Перезаписать эталон демо текущим состоянием?");

await client.query("BEGIN");
await client.query(`DELETE FROM demo_baseline WHERE school_id = $1`, [DEMO_SCHOOL]);

// Уроки — по school_id. Этапы и материалы — через свой урок: собственного
// school_id у них может не быть заполнено, а принадлежность уроку однозначна.
const inserts = [
  ["lesson", `SELECT id FROM lessons WHERE school_id = $1`],
  ["lesson_stage", `SELECT st.id FROM lesson_stages st JOIN lessons l ON l.id = st.lesson_id WHERE l.school_id = $1`],
  ["lesson_material", `SELECT m.id FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id WHERE l.school_id = $1`],
  ["homework", `SELECT id FROM homework WHERE school_id = $1`],
];

const counts = {};
for (const [type, select] of inserts) {
  const res = await client.query(
    `INSERT INTO demo_baseline (entity_type, entity_id, school_id)
     SELECT $2, sub.id, $1 FROM (${select}) AS sub
     ON CONFLICT (entity_type, entity_id) DO NOTHING`,
    [DEMO_SCHOOL, type],
  );
  counts[type] = res.rowCount;
}
console.table([counts]);

// Стоп-условие: пустой или подозрительно куцый снимок означал бы, что ночью
// откат снесёт демо целиком. Лучше не снять снимок, чем снять плохой.
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (counts.lesson !== 126) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: уроков в снимке ${counts.lesson}, ожидалось 126`);
  process.exit(1);
}
if (total < 500) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: в снимке всего ${total} записей — слишком мало, состояние не то`);
  process.exit(1);
}
console.log(`Всего в снимке: ${total} записей`);

if (APPLY) {
  await client.query("COMMIT");
  console.log("ПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("Прогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
