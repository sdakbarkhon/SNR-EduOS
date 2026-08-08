#!/usr/bin/env node
// 08.08.2026 — замена вопросов-заглушек в Kahoot-этапах демо-школы на
// настоящие вопросы по теме урока.
//
// Что нашлось на проде. Ровно два Kahoot-этапа держали следы ручных проверок,
// видимые ученикам:
//   7-А,  «Циклы for и while» (29.07, замороженное «сегодня») — один вопрос
//         "1234" с вариантами ["1","2","3","4"];
//   10-А, «Циклы в Python» (06.08) — один вопрос "qwerty?" с вариантами
//         ["12345","йцукен","фывап","asdfg"].
// Заказчик подтвердил, что обе записи проверочные.
//
// ОДИН СКРИПТ НА ДВА УРОКА СОЗНАТЕЛЬНО. Логика (найти этап -> убедиться, что
// там заглушка -> заменить -> проверить) для обоих одинакова, а копии в этом
// проекте расходились уже четырежды (резолв ссылок на материал, бакеты,
// классификаторы файлов, markdown-плагины). Отличаются только текст вопросов
// и способ найти этап — они и вынесены в TARGETS.
//
// ФОРМАТ ВОПРОСОВ. Kahoot рендерит и текст, и варианты через MarkdownInline
// (components/markdown-plugins.tsx), поэтому обратные кавычки отрисуются
// инлайн-кодом. Многострочные ```-блоки не используем намеренно: плитки
// ответов у Kahoot фиксированной высоты h-[72px], а на вопрос даётся 20
// секунд — развёрнутый листинг там не читается. Верные ответы расставлены по
// разным позициям: если все правильные первые, тест выглядит подставным.
//
// УДАЛЕНИЕ ПОПЫТОК. На вопросе 10-А висел один ответ ученика (attempt от
// 06.08, 1 вопрос, 0 баллов) — след той же проверки. quiz_answers уходит
// каскадом за вопросом, а quiz_attempts ссылается на stage_id и остался бы
// «доигранной попыткой 0/1» на этапе, где теперь 4 вопроса. Поэтому попытки
// по заменяемому этапу тоже удаляются, но только если их не больше
// MAX_ATTEMPTS_TO_CLEAR — иначе скрипт останавливается: это уже не след
// проверки, а живые данные.
//
// ЗАПУСК (из apps/web):
//   node scripts/fix-kahoot-placeholder-questions.mjs           # прогон, ROLLBACK
//   node scripts/fix-kahoot-placeholder-questions.mjs --apply   # запись
//
// Идемпотентен: уже заменённый этап пропускается.

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
const MAX_ATTEMPTS_TO_CLEAR = 3;

const TARGETS = [
  {
    label: "7-А · Циклы for и while (29.07)",
    groupLike: "7-А%",
    lessonTitle: "Циклы for и while",
    questions: [
      {
        text: "Сколько раз выполнится тело цикла `for i in range(5):`?",
        options: ["4 раза", "5 раз", "6 раз", "Бесконечно"],
        correct: 1,
      },
      {
        text: "Чем цикл `while` отличается от `for`?",
        options: [
          "Разницы нет, это одно и то же",
          "`while` работает только со строками",
          "`while` повторяется, пока условие истинно, а `for` — заданное число раз",
          "`for` нельзя прервать досрочно",
        ],
        correct: 2,
      },
      {
        text: "Что выведет код `for i in range(3): print(i)`?",
        options: ["1 2 3", "0 1 2 3", "3 3 3", "0 1 2"],
        correct: 3,
      },
      {
        text: "Что произойдёт, если в цикле `while x < 10:` забыть увеличивать `x`?",
        options: [
          "Цикл никогда не закончится",
          "Цикл выполнится ровно один раз",
          "Python увеличит `x` автоматически",
          "Программа не запустится",
        ],
        correct: 0,
      },
    ],
  },
  {
    label: "10-А · Циклы в Python (06.08)",
    groupLike: "10-А%",
    lessonTitle: "Циклы в Python",
    questions: [
      {
        text: "Какие значения переберёт цикл `for i in range(2, 10, 3):`?",
        options: ["2, 5, 8", "2, 4, 6, 8", "3, 6, 9", "2, 3, 4 … 9"],
        correct: 0,
      },
      {
        text: "Чему будет равно `total` после `total = 0` и `for i in range(1, 5): total += i`?",
        options: ["15", "10", "4", "5"],
        correct: 1,
      },
      {
        text: "Чем `continue` отличается от `break`?",
        options: [
          "Оба полностью прерывают цикл",
          "`continue` завершает программу",
          "`continue` пропускает итерацию, `break` выходит из цикла",
          "`continue` работает только в `while`",
        ],
        correct: 2,
      },
      {
        text: "Сколько раз выполнится `print()` в `for i in range(3): for j in range(4): print(i, j)`?",
        options: ["7", "3", "4", "12"],
        correct: 3,
      },
    ],
  },
];

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}`);
await client.query("BEGIN");

let replaced = 0;
let skipped = 0;

for (const target of TARGETS) {
  console.log(`\n── ${target.label} ──`);

  const stage = (
    await client.query(
      `SELECT st.id
         FROM lesson_stages st
         JOIN lessons l ON l.id = st.lesson_id
         JOIN groups g ON g.id = l.group_id
        WHERE l.school_id = $1
          AND g.name LIKE $2
          AND l.title = $3
          AND st.content_type = 'quiz_kahoot'`,
      [DEMO_SCHOOL, target.groupLike, target.lessonTitle],
    )
  ).rows;
  if (stage.length !== 1) fail(`ожидался ровно один Kahoot-этап, найдено ${stage.length}`);
  const stageId = stage[0].id;

  const before = (
    await client.query(
      `SELECT id, position, question_text, options FROM quiz_questions
        WHERE stage_id = $1 ORDER BY position`,
      [stageId],
    )
  ).rows;

  const wanted = target.questions.map((q) => q.text);
  if (before.length === wanted.length && before.every((q, i) => q.question_text === wanted[i])) {
    console.log("  уже заменено, пропускаю");
    skipped += 1;
    continue;
  }

  console.log(`  было вопросов: ${before.length}`);
  for (const q of before) console.log(`    ${q.position}: ${JSON.stringify(q.question_text)} ${JSON.stringify(q.options)}`);

  const attempts = (
    await client.query(
      `SELECT id, student_id, total_questions, correct_count, total_score, started_at
         FROM quiz_attempts WHERE stage_id = $1`,
      [stageId],
    )
  ).rows;
  if (attempts.length > MAX_ATTEMPTS_TO_CLEAR) {
    await client.query("ROLLBACK");
    fail(`на этапе ${attempts.length} попыток учеников — это не след проверки, разбирайся вручную`);
  }
  for (const a of attempts) {
    console.log(
      `  удаляю попытку ${a.id.slice(0, 8)}… (ученик ${a.student_id.slice(0, 8)}…, ` +
        `${a.correct_count}/${a.total_questions}, ${a.total_score} балл., ${a.started_at.toISOString().slice(0, 16)})`,
    );
  }

  // quiz_answers уходит каскадом за quiz_questions (FK ON DELETE CASCADE)
  await client.query(`DELETE FROM quiz_attempts WHERE stage_id = $1`, [stageId]);
  await client.query(`DELETE FROM quiz_questions WHERE stage_id = $1`, [stageId]);

  let position = 0; // нумерация с нуля — как в соседних quiz_qia
  for (const q of target.questions) {
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) {
      await client.query("ROLLBACK");
      fail(`у вопроса "${q.text}" correct=${q.correct} вне диапазона вариантов`);
    }
    await client.query(
      `INSERT INTO quiz_questions
         (stage_id, position, question_text, options, correct_option_index, points, time_per_question_seconds, school_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, 1, 20, $6)`,
      [stageId, position++, q.text, JSON.stringify(q.options), q.correct, DEMO_SCHOOL],
    );
  }

  const after = (
    await client.query(
      `SELECT position, question_text, options, correct_option_index FROM quiz_questions
        WHERE stage_id = $1 ORDER BY position`,
      [stageId],
    )
  ).rows;
  console.log(`  стало вопросов: ${after.length}`);
  for (const q of after) {
    console.log(`    ${q.position}: ${q.question_text}`);
    console.log(`        верный -> ${q.options[q.correct_option_index]}`);
  }
  replaced += 1;
}

// Контроль: заглушек по всей школе не должно остаться ни одной
const junk = (
  await client.query(
    `SELECT g.name AS grp, l.title, q.question_text
       FROM quiz_questions q
       JOIN lesson_stages st ON st.id = q.stage_id
       JOIN lessons l ON l.id = st.lesson_id
       JOIN groups g ON g.id = l.group_id
      WHERE st.content_type = 'quiz_kahoot'
        AND (q.question_text ~ '^[0-9]+$' OR q.question_text ILIKE '%qwerty%'
             OR q.options::text ILIKE '%йцукен%' OR q.options::text ILIKE '%asdfg%')`,
  )
).rows;
console.log(`\nЗаменено этапов: ${replaced}, пропущено (уже было): ${skipped}`);
console.log(`Заглушек в Kahoot по школе осталось: ${junk.length}`);
for (const j of junk) console.log(`   ${j.grp} · ${j.title}: ${JSON.stringify(j.question_text)}`);

if (APPLY) {
  await client.query("COMMIT");
  console.log("\nПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("\nПрогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
