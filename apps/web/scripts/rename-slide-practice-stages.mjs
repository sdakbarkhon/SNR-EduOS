#!/usr/bin/env node
// 08.08.2026 — честные названия для этапов, которые называются практикой, но
// на деле являются слайд-шоу.
//
// Разведка (см. resheniya_2.md за 08.08): 107 этапов «Практическая работа»
// имеют content_type='presentation', и у ВСЕХ слайды есть. То есть ученик
// открывает практику и смотрит слайды вместо того, чтобы что-то делать.
//
// Решение заказчика — разделить:
//   * программирование и робототехника  -> сменить тип и наполнить заданием
//     (делается отдельно, требует генерации содержимого);
//   * математика, русский, английский   -> ПЕРЕИМЕНОВАТЬ, тип и слайды не
//     трогать. Инструмента «практики» для этих предметов в платформе нет, а
//     содержимое слайдов само по себе полезное — это разбор примеров.
//
// Этот скрипт делает ТОЛЬКО вторую часть. Меняется одно поле title.
// Слайды, описание, тип, прогресс учеников не трогаются.
//
// ЗАПУСК (из apps/web):
//   node scripts/rename-slide-practice-stages.mjs           # прогон, ROLLBACK
//   node scripts/rename-slide-practice-stages.mjs --apply   # запись
//
// Идемпотентен: повторный прогон найдёт 0 строк.

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

/** Предметы, у которых практика остаётся слайдами и просто честно называется.
 *  Программирование и робототехника сюда НЕ входят — они получают настоящее
 *  задание отдельным заходом. */
const RENAME_SUBJECTS = ["Математика", "Русский язык", "Английский язык"];

/** Одно название на все три предмета. Содержимое у них однотипное — слайды с
 *  разобранными примерами по теме урока, поэтому выдумывать разные подписи не
 *  за чем: «Разбор примеров» описывает ровно то, что ученик увидит. */
const NEW_TITLE = "Разбор примеров";

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

const WHERE = `
  l.school_id = $1
  AND st.title = 'Практическая работа'
  AND st.content_type = 'presentation'
  AND s.name = ANY($2::text[])`;

console.log("── ЧТО БУДЕТ ПЕРЕИМЕНОВАНО ──");
console.table(
  (
    await client.query(
      `SELECT s.name AS предмет, g.name AS группа, count(*)::int AS этапов,
              sum(jsonb_array_length(st.slides))::int AS слайдов_всего
         FROM lesson_stages st
         JOIN lessons l ON l.id = st.lesson_id
         JOIN groups g ON g.id = l.group_id
         JOIN subjects s ON s.id = l.subject_id
        WHERE ${WHERE}
        GROUP BY 1, 2 ORDER BY 1, 2`,
      [DEMO_SCHOOL, RENAME_SUBJECTS],
    )
  ).rows,
);

await client.query("BEGIN");

const res = await client.query(
  `UPDATE lesson_stages st
      SET title = $3
     FROM lessons l, groups g, subjects s
    WHERE st.lesson_id = l.id AND g.id = l.group_id AND s.id = l.subject_id
      AND ${WHERE}`,
  [DEMO_SCHOOL, RENAME_SUBJECTS, NEW_TITLE],
);
console.log(`\nПереименовано этапов: ${res.rowCount}`);

// Стоп-условия: слайды должны остаться на месте, а практика программирования
// и робототехники — не пострадать (её этот скрипт не касается вовсе).
const after = (
  await client.query(
    `SELECT
       count(*) FILTER (WHERE st.title = 'Разбор примеров')::int AS переименованных,
       count(*) FILTER (WHERE st.title = 'Разбор примеров' AND (st.slides IS NULL OR jsonb_array_length(st.slides) = 0))::int AS без_слайдов,
       count(*) FILTER (WHERE st.title = 'Практическая работа' AND st.content_type = 'presentation')::int AS осталось_практик_презентаций
       FROM lesson_stages st
       JOIN lessons l ON l.id = st.lesson_id
      WHERE l.school_id = $1`,
    [DEMO_SCHOOL],
  )
).rows[0];
console.table([after]);

if (after.без_слайдов > 0) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: ${after.без_слайдов} переименованных этапов остались без слайдов`);
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
