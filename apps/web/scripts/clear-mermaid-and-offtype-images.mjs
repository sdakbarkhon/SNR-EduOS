#!/usr/bin/env node
// 08.08.2026 — разовая чистка медиа этапов.
//
// 1. mermaid_code -> NULL у всех этапов. Генератор системно выдавал
//    невалидный синтаксис (кавычки внутри подписей узлов, слово `end` как имя
//    узла), и mermaid при разборе САМ вставляет в DOM картинку с бомбой и
//    надписью «Syntax error» — ученик видел её вместо диаграммы. Решение
//    заказчика: схемы убрать совсем. Колонку в базе НЕ удаляем — вдруг
//    вернёмся; просто больше не заполняем и не показываем.
//
// 2. image_url -> NULL у этапов, которым картинка не нужна. Картинка
//    оставляется ТОЛЬКО на этапах-объяснениях (content_type='presentation').
//    Практика, задания, тесты, код и внешние сервисы картинку не получают.
//
// Содержимое уроков не трогается: тексты, задания, слайды, ДЗ, оценки и
// материалы остаются как есть. Файлы картинок в bucket'е lesson-stage-images
// тоже остаются — очищается только ссылка.
//
// ЗАПУСК (из apps/web):
//   node scripts/clear-mermaid-and-offtype-images.mjs           # прогон, ROLLBACK
//   node scripts/clear-mermaid-and-offtype-images.mjs --apply   # запись
//
// Идемпотентен: повторный прогон найдёт 0 строк и ничего не сделает.

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

/** Единственный тип этапа-объяснения в проекте. Остальные content_type
 *  (wokwi, quiz_qia, quiz_kahoot, code, code_completion, excalidraw,
 *  visualgo, typerun) — практические. Держать синхронно с
 *  EXPLANATION_CONTENT_TYPES в apps/web/lib/ai/stage-media-prompts.ts. */
const EXPLANATION_TYPES = ["presentation"];

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);

console.log("── ДО ──");
console.table(
  (
    await client.query(
      `SELECT COALESCE(content_type, '(нет типа)') AS тип,
              count(*) FILTER (WHERE mermaid_code IS NOT NULL AND mermaid_code <> '')::int AS схем,
              count(image_url)::int AS картинок
         FROM lesson_stages
        GROUP BY 1
       HAVING count(*) FILTER (WHERE mermaid_code IS NOT NULL AND mermaid_code <> '') > 0
           OR count(image_url) > 0
        ORDER BY 3 DESC, 2 DESC`,
    )
  ).rows,
);

await client.query("BEGIN");

// 26.08.2026: школа приходит аргументом --school и подставляется в правки.
// Раньше их не было вовсе — UPDATE шёл по всей таблице, то есть по обеим
// школам сразу.
const SCHOOL_ID = resolveSchoolId();
const mermaidRes = await client.query(
  `UPDATE lesson_stages SET mermaid_code = NULL
    WHERE mermaid_code IS NOT NULL AND mermaid_code <> '' AND school_id = $1`,
  [SCHOOL_ID],
);
console.log(`\nСхем очищено: ${mermaidRes.rowCount}`);

const imgRes = await client.query(
  `UPDATE lesson_stages SET image_url = NULL
    WHERE image_url IS NOT NULL
      AND (content_type IS NULL OR content_type <> ALL($1::text[]))
      AND school_id = $2`,
  [EXPLANATION_TYPES, SCHOOL_ID],
);
console.log(`Картинок снято с неподходящих этапов: ${imgRes.rowCount}`);

console.log("\n── ПОСЛЕ ──");
console.table(
  (
    await client.query(
      `SELECT COALESCE(content_type, '(нет типа)') AS тип, count(*)::int AS этапов,
              count(*) FILTER (WHERE mermaid_code IS NOT NULL AND mermaid_code <> '')::int AS схем,
              count(image_url)::int AS картинок
         FROM lesson_stages
        GROUP BY 1 ORDER BY 4 DESC, 2 DESC`,
    )
  ).rows,
);

// Стоп-условия: схем не должно остаться нигде, картинки — только на объяснениях.
const leftoverMermaid = (
  await client.query(`SELECT count(*)::int n FROM lesson_stages WHERE mermaid_code IS NOT NULL AND mermaid_code <> ''`)
).rows[0].n;
const leftoverImages = (
  await client.query(
    `SELECT count(*)::int n FROM lesson_stages
      WHERE image_url IS NOT NULL AND (content_type IS NULL OR content_type <> ALL($1::text[]))`,
    [EXPLANATION_TYPES],
  )
).rows[0].n;

if (leftoverMermaid > 0 || leftoverImages > 0) {
  await client.query("ROLLBACK");
  console.error(`\n!!! ОСТАНОВЛЕНО: осталось схем ${leftoverMermaid}, картинок не на объяснениях ${leftoverImages}`);
  process.exit(1);
}
console.log("\nПроверка: схем не осталось, картинки только на объяснениях.");

if (APPLY) {
  await client.query("COMMIT");
  console.log("ПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("Прогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
