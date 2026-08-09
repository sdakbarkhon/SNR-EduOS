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

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

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
