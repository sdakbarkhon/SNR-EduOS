#!/usr/bin/env node
// 08.08.2026 — убрать мини-опросы из слайдов презентаций.
//
// Решение заказчика: опросы внутри слайдов не нужны. Речь ТОЛЬКО о поле
// mini_quiz внутри lesson_stages.slides — этапы-квизы (content_type
// 'quiz_qia' / 'quiz_kahoot') это отдельная сущность в таблице
// quiz_questions, их скрипт не трогает вовсе.
//
// Само поле удаляется из объекта слайда (jsonb - 'mini_quiz'), а не ставится
// в null: слайд должен выглядеть так, будто опроса там никогда и не было.
// Остальные поля слайда — заголовок, текст, макет, цвет, иконка, картинка —
// не трогаются.
//
// ЗАПУСК (из apps/web):
//   node scripts/strip-slide-mini-quizzes.mjs           # прогон, ROLLBACK
//   node scripts/strip-slide-mini-quizzes.mjs --apply   # запись
//
// Идемпотентен: повторный прогон найдёт 0 слайдов и ничего не сделает.

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

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

const COUNT_SQL = `
  SELECT count(*)::int AS n
    FROM lesson_stages st, jsonb_array_elements(st.slides) sl
   WHERE st.slides IS NOT NULL AND sl ? 'mini_quiz'`;

const before = (await client.query(COUNT_SQL)).rows[0].n;
console.log(`Слайдов с мини-опросом: ${before}`);

console.log("\nГде именно (этап · предмет · день):");
console.table(
  (
    await client.query(`
      SELECT st.title AS этап, COALESCE(s.name, '—') AS предмет,
             to_char(l.starts_at + interval '5 hours', 'DD.MM') AS день,
             jsonb_array_length(st.slides)::int AS слайдов
        FROM lesson_stages st
        JOIN lessons l ON l.id = st.lesson_id
        LEFT JOIN subjects s ON s.id = l.subject_id
       WHERE st.slides IS NOT NULL
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(st.slides) sl WHERE sl ? 'mini_quiz')
       ORDER BY 2, 3
       LIMIT 40`)
  ).rows,
);

await client.query("BEGIN");

// jsonb_agg по элементам массива с вырезанным ключом. WHERE по EXISTS —
// трогаем только те этапы, где опрос реально есть.
// 26.08.2026: школа приходит аргументом --school и подставляется в правку.
// Раньше UPDATE шёл по всей таблице, то есть по обеим школам сразу.
const SCHOOL_ID = resolveSchoolId();
const res = await client.query(`
  UPDATE lesson_stages st
     SET slides = sub.new_slides
    FROM (
      SELECT s2.id,
             jsonb_agg(sl - 'mini_quiz' ORDER BY ord) AS new_slides
        FROM lesson_stages s2, jsonb_array_elements(s2.slides) WITH ORDINALITY AS a(sl, ord)
       WHERE s2.slides IS NOT NULL
         AND s2.school_id = $1
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(s2.slides) x WHERE x ? 'mini_quiz')
       GROUP BY s2.id
    ) AS sub
   WHERE st.id = sub.id`, [SCHOOL_ID]);
console.log(`\nЭтапов обновлено: ${res.rowCount}`);

const after = (await client.query(COUNT_SQL)).rows[0].n;
console.log(`Слайдов с мини-опросом осталось: ${after}`);

// Стоп-условие: слайды не должны пропасть и опросов не должно остаться.
const lost = (
  await client.query(
    `SELECT count(*)::int AS n FROM lesson_stages
      WHERE content_type = 'presentation'
        AND (slides IS NULL OR jsonb_array_length(slides) = 0)`,
  )
).rows[0].n;
console.log(`Презентаций без слайдов (было 1 — этап «Циклы»): ${lost}`);

if (after > 0 || lost > 1) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: опросов осталось ${after}, презентаций без слайдов ${lost}`);
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
