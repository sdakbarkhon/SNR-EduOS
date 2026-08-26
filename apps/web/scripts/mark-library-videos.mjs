#!/usr/bin/env node
// 08.08.2026 — проставить вид «видео» существующим роликам в библиотеке.
//
// Вид материала (material_type) появился у teacher_library_materials в
// миграции 153, а возможность класть в библиотеку видео — только в 92b6f29 и
// 92f2c00. Поэтому у всех уже загруженных роликов вид пустой: список
// показывает значок видео (он считается по content_type), но бейджа вида нет.
// Миграция 178 добавила 'видео' в CHECK — осталось проставить его тем, кто
// уже есть.
//
// Видео определяем двумя способами сразу, как это делает UI:
//   * content_type — у видео-ссылок он не 'file' (video_youtube / video_rutube);
//   * расширение файла или mime — для загруженных .mp4 и подобных.
// Материалы, у которых вид УЖЕ проставлен вручную, не трогаем: учитель мог
// осознанно назвать ролик, например, методичкой.
//
// ЗАПУСК (из apps/web):
//   node scripts/mark-library-videos.mjs           # прогон, ROLLBACK
//   node scripts/mark-library-videos.mjs --apply   # запись

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

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const IS_VIDEO = `
  (
    (content_type IS NOT NULL AND content_type <> 'file')
    OR COALESCE(file_type, '') ILIKE 'video/%'
    OR COALESCE(file_type, '') ~* '\\.(mp4|webm|ogg|mov|m4v)$'
  )`;

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

console.log("── ЧТО В БИБЛИОТЕКЕ СЕЙЧАС ──");
console.table(
  (
    await client.query(
      `SELECT COALESCE(material_type, '(вид не задан)') AS вид,
              COALESCE(content_type, '(нет)') AS content_type,
              count(*)::int AS штук,
              count(*) FILTER (WHERE ${IS_VIDEO})::int AS из_них_видео
         FROM teacher_library_materials
        GROUP BY 1, 2 ORDER BY 3 DESC`,
    )
  ).rows,
);

await client.query("BEGIN");

// 26.08.2026: школа приходит аргументом --school и подставляется в правки.
// Раньше их не было вовсе — UPDATE шёл по всей таблице, то есть по обеим
// школам сразу.
const SCHOOL_ID = resolveSchoolId();
const res = await client.query(
  `UPDATE teacher_library_materials
      SET material_type = 'видео'
    WHERE material_type IS NULL AND ${IS_VIDEO} AND school_id = $1`,
  [SCHOOL_ID],
);
console.log(`\nПомечено видом «видео»: ${res.rowCount}`);

console.log("\n── ПОСЛЕ ──");
console.table(
  (
    await client.query(
      `SELECT COALESCE(material_type, '(вид не задан)') AS вид, count(*)::int AS штук
         FROM teacher_library_materials GROUP BY 1 ORDER BY 2 DESC`,
    )
  ).rows,
);

// Стоп-условие: не-видео вид «видео» получить не могло.
const wrong = (
  await client.query(`SELECT count(*)::int n FROM teacher_library_materials WHERE material_type = 'видео' AND NOT ${IS_VIDEO}`)
).rows[0].n;
if (wrong > 0) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: ${wrong} материалов помечены видео, не будучи видео`);
  process.exit(1);
}

if (APPLY) {
  await client.query("COMMIT");
  console.log("\nПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("\nПрогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
