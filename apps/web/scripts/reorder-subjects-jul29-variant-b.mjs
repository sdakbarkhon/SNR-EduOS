#!/usr/bin/env node
// 08.08.2026 — перестановка предметов на замороженном «сегодня» 29.07.2026
// в демо-школе: робототехника и программирование выводятся в слоты 2-3, чтобы
// клиент видел их как «идёт сейчас» и «следующий урок».
//
// ПОЧЕМУ НЕ У ВСЕХ ТРЁХ КЛАССОВ. На все три класса приходится один робототехник
// (Kamila Yusupova) и один программист (Rustam Rakhmatov) — Сарвар Эшмуродов
// ведёт программирование только в группе W-5, к демо-классам отношения не
// имеет. Учитель не может вести два класса в одном слоте, поэтому в слоте 2
// предмет пары получают максимум ДВА класса из трёх, и столько же в слоте 3:
// четыре «места» на шесть требуемых. Это ограничение по числу учителей, а не
// неудачная раскладка — никакой перестановкой оно не обходится.
//
// ВЫБРАННЫЙ РАСКЛАД (вариант B, согласован с заказчиком):
//   пара целиком у 3-А и 7-А; 10-А показывает робототехнику в слоте 1 как
//   уже прошедший урок. Ключевое свойство варианта — слоты 1 и 2 НЕ трогаются
//   ни в одном классе, поэтому completed/in_progress уроки никуда не едут и
//   форма 3/3/12 не может сломаться побочным эффектом перестановки.
//
// ЧТО МЕНЯЕТСЯ (перестановка ВНУТРИ группы, набор времён сохраняется):
//   3-А : слот3 <- слот4 (Робототехника), слот4 <- слот5, слот5 <- слот3
//   10-А: слот3 <-> слот5
//   7-А : не трогается, у него пара уже стоит правильно
//
// ПОЧЕМУ ДОСТАТОЧНО ПРАВИТЬ starts_at. Прикреплённое содержимое (этапы,
// материалы, ДЗ, картинки) висит на lesson_id, а не на времени, поэтому
// переезжает вместе со строкой урока. ends_at пересчитает триггер
// trg_compute_lesson_end (BEFORE UPDATE OF starts_at, duration_minutes).
// trg_validate_lesson_start демо-школы пропускает (миграция 172), так что
// перенос на «прошедшее» по настоящему now() время не блокируется.
// Уникальных ограничений по (group_id, starts_at) нет — на lessons только
// PK по id, поэтому промежуточные состояния внутри транзакции безопасны.
//
// СТАТУСЫ. Переезжают только слоты 3-5, все они scheduled и остаются
// scheduled. Скрипт всё равно проверяет форму 1/2/3+ после записи и печатает
// счётчики; расходится с ней он не должен. Ночной откат
// app/api/cron/_lib/restore-demo-shape.ts раскладывает статусы по ПОРЯДКУ
// starts_at внутри группы и порядок предметов не трогает — перестановку он не
// отменит.
//
// ЗАПУСК (из apps/web):
//   node scripts/reorder-subjects-jul29-variant-b.mjs           # прогон, ROLLBACK
//   node scripts/reorder-subjects-jul29-variant-b.mjs --apply   # запись
//
// Идемпотентен: если расклад уже целевой — выходит, ничего не трогая.

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
const DAY_FROM = "2026-07-29T00:00:00+05";
const DAY_TO = "2026-07-30T00:00:00+05";

// Ожидаемое «до» — защита от повторного прогона по уже переставленным данным:
// ротация, применённая дважды, тихо перемешала бы день. move: {новый: старый}.
const PLAN = {
  "3-А класс": {
    before: ["Математика", "Программирование", "Английский язык", "Робототехника", "Русский язык", "Робототехника"],
    move: { 3: 4, 4: 5, 5: 3 },
  },
  "7-А класс": {
    before: ["Русский язык", "Робототехника", "Программирование", "Английский язык", "Математика", "Математика"],
    move: {},
  },
  "10-А класс": {
    before: ["Робототехника", "Математика", "Русский язык", "Программирование", "Английский язык", "Английский язык"],
    move: { 3: 5, 5: 3 },
  },
};

const SHORT = (s) =>
  String(s).replace("Программирование", "ПРОГ").replace("Робототехника", "РОБО").replace(" язык", "");

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

/** Применяет move к массиву «до» и возвращает ожидаемое «после». */
function expectedAfter({ before, move }) {
  const after = before.slice();
  for (const [to, from] of Object.entries(move)) after[Number(to) - 1] = before[Number(from) - 1];
  return after;
}

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `SELECT l.id, g.name AS group_name, l.starts_at, l.status, l.duration_minutes,
          l.started_at, l.ended_at,
          COALESCE(s.name, '—') AS subject, COALESCE(t.full_name, '—') AS teacher
     FROM lessons l
     JOIN groups g ON g.id = l.group_id
     LEFT JOIN subjects s ON s.id = l.subject_id
     LEFT JOIN teachers t ON t.id = s.teacher_id
    WHERE l.school_id = $1 AND l.starts_at >= $2 AND l.starts_at < $3
    ORDER BY g.name, l.starts_at`,
  [DEMO_SCHOOL, DAY_FROM, DAY_TO],
);

const byGroup = new Map();
for (const r of rows) {
  if (!byGroup.has(r.group_name)) byGroup.set(r.group_name, []);
  byGroup.get(r.group_name).push(r);
}

// ── Стоп-условия ────────────────────────────────────────────────────────────
if (byGroup.size !== 3) fail(`ожидалось 3 группы на 29.07, найдено ${byGroup.size}`);
for (const [name, arr] of byGroup) {
  if (!PLAN[name]) fail(`группа "${name}" не описана в PLAN`);
  if (arr.length !== 6) fail(`у ${name} на 29.07 ${arr.length} уроков вместо 6`);
  const badDur = arr.filter((l) => l.duration_minutes !== 45);
  if (badDur.length) fail(`${name}: ${badDur.length} уроков с duration_minutes != 45`);
}

const current = {};
for (const [name, arr] of byGroup) current[name] = arr.map((l) => l.subject);

const alreadyDone = Object.entries(PLAN).every(
  ([name, plan]) => JSON.stringify(current[name]) === JSON.stringify(expectedAfter(plan)),
);
if (alreadyDone) {
  console.log("Расклад уже целевой (вариант B). Ничего не меняю.");
  await client.end();
  process.exit(0);
}

for (const [name, plan] of Object.entries(PLAN)) {
  if (JSON.stringify(current[name]) !== JSON.stringify(plan.before)) {
    fail(
      `у ${name} расписание не совпадает с ожидаемым «до».\n` +
        `   в базе:   ${current[name].map(SHORT).join(", ")}\n` +
        `   ожидалось: ${plan.before.map(SHORT).join(", ")}`,
    );
  }
}

// ── Симуляция: пересечения учителей по ВСЕМУ дню, а не только в слотах 2-3 ──
const simulated = {};
for (const [name, arr] of byGroup) {
  const plan = PLAN[name];
  simulated[name] = arr.slice();
  for (const [to, from] of Object.entries(plan.move)) simulated[name][Number(to) - 1] = arr[Number(from) - 1];
}
const clashes = [];
for (let slot = 0; slot < 6; slot++) {
  const seen = new Map();
  for (const name of Object.keys(simulated)) {
    const teacher = simulated[name][slot].teacher;
    if (!seen.has(teacher)) seen.set(teacher, []);
    seen.get(teacher).push(name);
  }
  for (const [teacher, groups] of seen) {
    if (groups.length > 1) clashes.push(`слот ${slot + 1}: ${teacher} одновременно в ${groups.join(" и ")}`);
  }
}
if (clashes.length) fail(`перестановка даёт пересечения учителей:\n   ${clashes.join("\n   ")}`);

// ── Печать «до/после» ───────────────────────────────────────────────────────
const times = (name) => byGroup.get(name).map((l) => l.starts_at);
const hhmm = (iso) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(11, 16);
console.log(`Режим: ${APPLY ? "--apply (запись)" : "прогон, изменения откатываются"}\n`);
for (const name of Object.keys(PLAN)) {
  console.log(`${name}`);
  console.log(`  до:    ${byGroup.get(name).map((l, i) => `${i + 1}·${hhmm(l.starts_at)} ${SHORT(l.subject)}`).join("  ")}`);
  console.log(`  после: ${simulated[name].map((l, i) => `${i + 1}·${hhmm(times(name)[i])} ${SHORT(l.subject)}`).join("  ")}`);
}
console.log("\nПересечения учителей за весь день: НЕТ (проверены все 6 слотов)");

// ── Запись ──────────────────────────────────────────────────────────────────
await client.query("BEGIN");
let moved = 0;
for (const name of Object.keys(PLAN)) {
  const slotTimes = times(name);
  for (let slot = 0; slot < 6; slot++) {
    const lesson = simulated[name][slot];
    if (lesson.starts_at === slotTimes[slot]) continue;
    // ends_at не указываем: его пересчитает trg_compute_lesson_end
    await client.query(`UPDATE lessons SET starts_at = $2 WHERE id = $1`, [lesson.id, slotTimes[slot]]);
    moved += 1;
  }
}
console.log(`\nПеренесено уроков: ${moved}`);

// ── Проверка результата внутри той же транзакции ────────────────────────────
const after = (
  await client.query(
    `SELECT g.name AS group_name,
            row_number() OVER (PARTITION BY l.group_id ORDER BY l.starts_at)::int AS slot,
            to_char(l.starts_at + interval '5 hours', 'HH24:MI') AS tm,
            COALESCE(s.name,'—') AS subject, COALESCE(t.full_name,'—') AS teacher,
            l.status, l.ends_at, l.starts_at, l.duration_minutes
       FROM lessons l
       JOIN groups g ON g.id = l.group_id
       LEFT JOIN subjects s ON s.id = l.subject_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
      WHERE l.school_id = $1 AND l.starts_at >= $2 AND l.starts_at < $3
      ORDER BY g.name, l.starts_at`,
    [DEMO_SCHOOL, DAY_FROM, DAY_TO],
  )
).rows;

const badEnds = after.filter(
  (r) => new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime() !== r.duration_minutes * 60_000,
);
if (badEnds.length) {
  await client.query("ROLLBACK");
  fail(`${badEnds.length} уроков с ends_at != starts_at + duration — триггер не пересчитал, откатываю`);
}

const shape = { completed: 0, in_progress: 0, scheduled: 0 };
const wrongSlot = [];
for (const r of after) {
  shape[r.status] = (shape[r.status] ?? 0) + 1;
  const want = r.slot === 1 ? "completed" : r.slot === 2 ? "in_progress" : "scheduled";
  if (r.status !== want) wrongSlot.push(`${r.group_name} слот${r.slot} ${r.tm}: ${r.status}, ожидался ${want}`);
}

console.log("\nПОСЛЕ:");
const grid = [];
for (const name of Object.keys(PLAN)) {
  const row = { класс: name };
  for (const r of after.filter((x) => x.group_name === name)) row[`${r.slot}·${r.tm}`] = SHORT(r.subject);
  grid.push(row);
}
console.table(grid);
console.log(`Форма по школе: ${shape.completed} completed / ${shape.in_progress} in_progress / ${shape.scheduled} scheduled`);
if (wrongSlot.length) {
  console.log("Статусы, разошедшиеся с правилом 1/2/3+ (чинятся restore-demo-shape):");
  for (const w of wrongSlot) console.log(`   ${w}`);
} else {
  console.log("Статусы по позиции слота: правило 1/2/3+ соблюдено во всех группах.");
}

if (APPLY) {
  await client.query("COMMIT");
  console.log("\nПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("\nПрогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
