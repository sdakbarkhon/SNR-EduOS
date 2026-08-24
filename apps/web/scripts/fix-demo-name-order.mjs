#!/usr/bin/env node
// 23.08.2026 — ПОРЯДОК СЛОВ В ФИО ДЕМО-ШКОЛЫ.
//
// ЗАЧЕМ. В демо-школе 38 карточек людей. У 31 из них ФИО записано «Имя
// Фамилия» («Aziz Xolmatov», «Elena Sokolova»), а у семи — наоборот,
// «Фамилия Имя» («Ismailov Sherzod», «Karimova Malika»). Это хвост от старых
// демо-семей: родителей Рахимова и Каримова убрали 05–06.08.2026, а их детей
// переименовали, порядок слов при этом не поправили.
//
// ЧЕМ МЕШАЕТ. Мобильное приложение берёт имя первым словом (lib/realChild.ts),
// поэтому у ребёнка демо-родителя на экранах читается «Кошелёк Ismailov» и
// «Ismailov · 10-А» — фамилия вместо имени. Заказчик увидит это первым.
//
// ВАЖНО ПРО ВТОРУЮ ПОЛОВИНУ ПРАВКИ. В приветствии на главной стоит обратное
// допущение: HomeScreen.givenName() берёт ПОСЛЕДНЕЕ слово — специально под
// перевёрнутый порядок. Если переставить слова в базе и не поправить его,
// приветствие начнёт здороваться фамилией. Правки обязаны ехать вместе.
//
// ЧТО ДЕЛАЕТ. Меняет местами два слова в full_name у перечисленных карточек.
// Ничего не удаляет и не создаёт: только UPDATE одной колонки. Логины,
// телефоны, привязки и любые другие поля не трогаются.
//
// ЧЕГО НЕ ДЕЛАЕТ. Не трогает уведомления, в тексте которых имя уже впечатано
// строкой (4 штуки): это исторические записи, переписывать их задним числом —
// подмена истории. Они останутся с прежним порядком слов.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fix-demo-name-order.mjs            ← холостой
//   node --env-file=.env.local scripts/fix-demo-name-order.mjs --confirm  ← запись

import { createRequire } from "node:module";

const require = createRequire("C:/SNR EduOS/package.json");
const { Client } = require("pg");

const CONFIRM = process.argv.includes("--confirm");

/** Кого правим. Список закрытый и выписан руками — никакой эвристики
 *  «похоже на фамилию»: ошибиться здесь дороже, чем перечислить. */
const TARGETS = [
  { table: "students", from: "Ismailov Sherzod", to: "Sherzod Ismailov" },
  { table: "students", from: "Karimov Aziz", to: "Aziz Karimov" },
  { table: "students", from: "Karimov Farrukh", to: "Farrukh Karimov" },
  { table: "students", from: "Karimova Malika", to: "Malika Karimova" },
  { table: "students", from: "Rakhimov Rustam", to: "Rustam Rakhimov" },
  { table: "students", from: "Rakhimova Nodira", to: "Nodira Rakhimova" },
  { table: "parents", from: "Ismailov Bakhtiyor", to: "Bakhtiyor Ismailov" },
];

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} отсутствует — запускай с --env-file=.env.local из apps/web`);
  return v;
}

const db = new Client({ connectionString: env("SUPABASE_DB_URL"), ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const line = (t) => console.log("\n── " + t + " " + "─".repeat(Math.max(0, 62 - t.length)));

const [{ id: demoSchool }] = await q(`SELECT id FROM schools WHERE is_demo`);

// ── 1. Что найдено ───────────────────────────────────────────────────────────
line("1. ЧТО НАЙДЕНО");

const plan = [];
for (const t of TARGETS) {
  const rows = await q(
    `SELECT id, full_name FROM public."${t.table}" WHERE school_id = $1 AND full_name = $2`,
    [demoSchool, t.from],
  );
  plan.push({ ...t, rows });
}

for (const p of plan) {
  const state = p.rows.length === 1 ? "найдена" : p.rows.length === 0 ? "НЕ НАЙДЕНА" : `НАЙДЕНО ${p.rows.length}`;
  console.log(`  ${p.table.padEnd(9)} «${p.from}» → «${p.to}»  ${state}`);
}

const missing = plan.filter((p) => p.rows.length !== 1);
if (missing.length) {
  console.log("\n  ОСТАНОВКА: не по одной строке на карточку — база не та, что ожидалась.");
  await db.end();
  process.exitCode = 1;
}

// ── 2. Чего правка НЕ коснётся ──────────────────────────────────────────────
if (process.exitCode !== 1) {
  line("2. ЧЕГО ПРАВКА НЕ КОСНЁТСЯ");

  const notif = await q(
    `SELECT count(*)::int AS n FROM notifications
      WHERE title LIKE '%Ismailov%' OR body LIKE '%Ismailov%'`,
  );
  console.log(`  уведомлений с именем в тексте: ${notif[0].n} — остаются как есть (история)`);

  const others = await q(
    `SELECT count(*)::int AS n FROM students WHERE school_id = $1 AND full_name NOT IN (${TARGETS
      .filter((t) => t.table === "students")
      .map((_, i) => `$${i + 2}`)
      .join(", ")})`,
    [demoSchool, ...TARGETS.filter((t) => t.table === "students").map((t) => t.from)],
  );
  console.log(`  прочих учеников демо-школы: ${others[0].n} — не трогаем, у них порядок верный`);
  console.log(`  логины, телефоны, привязки, оценки, посещаемость: не трогаем вовсе`);

  // ── 3. Запись ─────────────────────────────────────────────────────────────
  if (!CONFIRM) {
    line("3. ЭТО ХОЛОСТОЙ ПРОГОН");
    console.log("  В базу НИЧЕГО не записано. Запись — той же командой с --confirm.\n");
    await db.end();
  } else {
    line("3. ЗАПИСЬ");
    await db.query("BEGIN");
    let updated = 0;
    try {
      for (const p of plan) {
        const res = await db.query(
          `UPDATE public."${p.table}" SET full_name = $1 WHERE id = $2 AND full_name = $3`,
          [p.to, p.rows[0].id, p.from],
        );
        if (res.rowCount !== 1) throw new Error(`${p.table} «${p.from}»: затронуто ${res.rowCount} строк вместо 1`);
        updated += res.rowCount;
      }
      await db.query("COMMIT");
      console.log(`  обновлено карточек: ${updated}`);
    } catch (e) {
      await db.query("ROLLBACK");
      console.error(`  ОТКАТ: ${e.message}`);
      await db.end();
      process.exitCode = 1;
    }

    // ── 4. Сверка ───────────────────────────────────────────────────────────
    if (process.exitCode !== 1) {
      line("4. СВЕРКА ПОСЛЕ ЗАПИСИ");
      for (const p of plan) {
        const [now] = await q(`SELECT full_name FROM public."${p.table}" WHERE id = $1`, [p.rows[0].id]);
        console.log(`  ${p.table.padEnd(9)} ${now.full_name === p.to ? "✓" : "✗"} «${now.full_name}»`);
      }
      const [{ n: total }] = await q(`SELECT count(*)::int AS n FROM students WHERE school_id = $1`, [demoSchool]);
      const [{ n: parents }] = await q(`SELECT count(*)::int AS n FROM parents WHERE school_id = $1`, [demoSchool]);
      console.log(`\n  учеников в демо-школе: ${total} (было 30), родителей: ${parents} (было 1)`);
      await db.end();
    }
  }
}
