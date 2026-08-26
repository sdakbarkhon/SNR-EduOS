#!/usr/bin/env node
// 10.08.2026 — чистка уведомлений демо-школы.
//
// ЗАЧЕМ. Скрипты наполнения наплодили 8778 уведомлений на 37 человек: у
// отдельных учеников по 445 штук, колокольчик показывает «99+» и выглядит
// мусором. Решение заказчика — оставить каждому 10-20 свежих.
//
// КАК ОТБИРАЕМ. Не «последние 15 подряд»: у активного ученика последние
// пятнадцать окажутся пятнадцатью «добавлен материал», и разнообразие
// пропадёт. Берём по кругу — по одному самому свежему из каждого вида, пока
// не наберётся TARGET. Так у человека оказываются и оценки, и домашние
// задания, и объявления, если они у него вообще есть.
//
// ПРОЧИТАННОСТЬ. Сейчас непрочитано 8522 из 8778 — после чистки колокольчик
// показывал бы ровно столько, сколько осталось. Оставляем непрочитанными
// UNREAD_KEEP самых свежих, остальные помечаем прочитанными: бейдж
// показывает небольшое число, а история не выглядит нетронутой.
//
// БЕЗОПАСНОСТЬ. Только демо-школа. На notifications не ссылается ни одна
// таблица (проверено запросом к pg_constraint) — удаление ничего за собой
// не тянет. В снимок эталона (demo_baseline) уведомления не входят: там
// только уроки, этапы, материалы и домашние задания, — поэтому ночной откат
// удалённое не восстановит и оставшееся лишним не сочтёт.
//
// ЗАПУСК (из apps/web):
//   node scripts/trim-demo-notifications.mjs           # холостой прогон
//   node scripts/trim-demo-notifications.mjs --apply   # запись

import fs from "node:fs";
import { resolveSchoolId } from "./_school-arg.mjs";
import path from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
// 26.08.2026: школа приходит аргументом --school, а не вписана сюда.
// Прежнее значение осталось как pinned: если указать другую школу, скрипт
// выйдет с ошибкой, а не применится молча не туда.
const DEMO_SCHOOL = resolveSchoolId({ pinned: "a0a0a0a0-0000-0000-0000-000000000001" });
/** Сколько оставляем каждому. В границах 10-20 из постановки. */
const TARGET = 15;
/** Сколько из оставленных остаются непрочитанными. */
const UNREAD_KEEP = 5;

const envText = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await client.connect();

console.log(`Режим: ${APPLY ? "--apply (запись)" : "ХОЛОСТОЙ ПРОГОН, изменения откатываются"}\n`);

// ── страховка: чужие школы не трогаем ───────────────────────────────────────
const foreign = (await client.query(
  `SELECT count(*)::int n FROM notifications WHERE school_id <> $1`, [DEMO_SCHOOL],
)).rows[0].n;
console.log(`Уведомлений в ДРУГИХ школах: ${foreign} — не трогаем ни одного.`);

const fk = (await client.query(
  `SELECT count(*)::int n FROM pg_constraint WHERE contype='f' AND confrelid='notifications'::regclass`,
)).rows[0].n;
if (fk > 0) fail(`на notifications ссылаются ${fk} внешних ключей — удаление потянет за собой чужие строки, нужно обсудить`);

// ── отбор: по кругу видов, самые свежие ─────────────────────────────────────
const { rows: all } = await client.query(
  `SELECT id, recipient_user_id, kind, is_read, created_at
     FROM notifications WHERE school_id = $1
    ORDER BY recipient_user_id, created_at DESC`,
  [DEMO_SCHOOL],
);

const byUser = new Map();
for (const n of all) {
  if (!byUser.has(n.recipient_user_id)) byUser.set(n.recipient_user_id, []);
  byUser.get(n.recipient_user_id).push(n);
}

const keep = [];
const keepUnread = [];
const keepRead = [];
for (const [, items] of byUser) {
  // по видам, внутри вида — от свежих к старым
  const byKind = new Map();
  for (const n of items) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind).push(n);
  }
  const queues = [...byKind.values()];
  const picked = [];
  let progress = true;
  while (picked.length < TARGET && progress) {
    progress = false;
    for (const q of queues) {
      if (picked.length >= TARGET) break;
      const next = q.shift();
      if (next) { picked.push(next); progress = true; }
    }
  }
  picked.sort((a, b) => b.created_at - a.created_at);
  picked.forEach((n, i) => {
    keep.push(n.id);
    (i < UNREAD_KEEP ? keepUnread : keepRead).push(n.id);
  });
}

const keepSet = new Set(keep);
const toDelete = all.filter((n) => !keepSet.has(n.id)).map((n) => n.id);

// ── показ ───────────────────────────────────────────────────────────────────
console.log(`\nВсего в демо: ${all.length}; получателей: ${byUser.size}`);
console.log(`Оставляем: ${keep.length} (по ${TARGET} на человека, из них непрочитанными ${UNREAD_KEEP})`);
console.log(`Удаляем: ${toDelete.length}`);

const perUser = [...byUser.entries()].map(([uid, items]) => ({
  было: items.length,
  видов_было: new Set(items.map((n) => n.kind)).size,
  станет: keep.filter((id) => items.some((n) => n.id === id)).length,
  видов_станет: new Set(items.filter((n) => keepSet.has(n.id)).map((n) => n.kind)).size,
  uid,
}));
console.log("\n── ПО ЛЮДЯМ (первые 8 и итог) ──");
console.table(perUser.slice(0, 8).map((r) => ({ было: r.было, видов_было: r.видов_было, станет: r.станет, видов_станет: r.видов_станет })));
const minKeep = Math.min(...perUser.map((r) => r.станет));
const maxKeep = Math.max(...perUser.map((r) => r.станет));
const minKinds = Math.min(...perUser.map((r) => r.видов_станет));
console.log(`У всех ${perUser.length} человек останется от ${minKeep} до ${maxKeep} уведомлений; видов минимум ${minKinds}.`);
if (maxKeep > 20) fail(`кому-то остаётся ${maxKeep} — больше двадцати из постановки`);

console.log("\n── ПО ВИДАМ ──");
const kindBefore = {}, kindAfter = {};
for (const n of all) {
  kindBefore[n.kind] = (kindBefore[n.kind] ?? 0) + 1;
  if (keepSet.has(n.id)) kindAfter[n.kind] = (kindAfter[n.kind] ?? 0) + 1;
}
console.table(Object.keys(kindBefore).map((k) => ({ вид: k, было: kindBefore[k], станет: kindAfter[k] ?? 0 })));

await client.query("BEGIN");

const del = toDelete.length
  ? (await client.query(`DELETE FROM notifications WHERE id = ANY($1::uuid[])`, [toDelete])).rowCount
  : 0;
const unread = keepUnread.length
  ? (await client.query(
      `UPDATE notifications SET is_read = false, read_at = NULL WHERE id = ANY($1::uuid[])`, [keepUnread],
    )).rowCount
  : 0;
const read = keepRead.length
  ? (await client.query(
      `UPDATE notifications SET is_read = true, read_at = COALESCE(read_at, created_at) WHERE id = ANY($1::uuid[])`, [keepRead],
    )).rowCount
  : 0;

console.log(`\nУдалено: ${del}; помечено непрочитанными: ${unread}; прочитанными: ${read}`);

const after = (await client.query(
  `SELECT count(*)::int всего, count(*) FILTER (WHERE is_read = false)::int непрочитано,
          count(DISTINCT recipient_user_id)::int получателей
     FROM notifications WHERE school_id = $1`, [DEMO_SCHOOL],
)).rows[0];
console.table([after]);

const foreignAfter = (await client.query(
  `SELECT count(*)::int n FROM notifications WHERE school_id <> $1`, [DEMO_SCHOOL],
)).rows[0].n;
if (foreignAfter !== foreign) { await client.query("ROLLBACK"); fail("изменилось число уведомлений в других школах"); }
if (after.получателей !== byUser.size) { await client.query("ROLLBACK"); fail(`получателей стало ${after.получателей} вместо ${byUser.size} — кто-то остался вовсе без уведомлений`); }

if (APPLY) {
  await client.query("COMMIT");
  console.log("\nПРИМЕНЕНО.");
} else {
  await client.query("ROLLBACK");
  console.log("\nХолостой прогон, изменения откачены. Запуск с --apply запишет их.");
}
await client.end();
