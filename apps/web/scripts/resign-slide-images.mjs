#!/usr/bin/env node
// 22.08.2026 — ОЖИВЛЕНИЕ БИТЫХ АДРЕСОВ КАРТИНОК В СЛАЙДАХ.
//
// ЗАЧЕМ. Маршрут генерации сохранял для картинки слайда ПУБЛИЧНЫЙ адрес, а
// бакет slide-images закрыт с 13.08.2026 (миграция 195) — такой адрес отдаёт
// «Bucket not found». Файл при этом лежит в хранилище: модель отработала,
// деньги потрачены, на экране пусто. Код починен коммитом 401d654 (теперь
// подписанная ссылка на десять лет, общая функция на обе картинки), но
// сохранённые адреса он не трогает — их и чинит этот скрипт.
//
// ЧТО ДЕЛАЕТ: находит в слайдах адреса вида /object/public/<бакет>/<путь>,
// проверяет, что файл в хранилище есть, выписывает на него подписанную ссылку
// и подменяет ТОЛЬКО адрес. Ничего не дорисовывает и не удаляет.
//
// ПОЧЕМУ ПОДМЕНА ИДЁТ ПО ТЕКСТУ JSON. Адрес встречается в двух видах: как
// значение ключа image_url и как markdown-картинка внутри текста слайда (так
// его вшивал скрипт наполнения). Замена точной строки на точную строку в
// тексте JSON накрывает оба случая и не может задеть ничего другого:
// результат разбирается обратно и сверяется — отличаться должен ровно на
// длину адресов.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/resign-slide-images.mjs            ← холостой
//   node --env-file=.env.local scripts/resign-slide-images.mjs --confirm  ← запись

import fs from "node:fs";
import { resolveSchoolId } from "./_school-arg.mjs";

// 26.08.2026: школа приходит аргументом --school. Раньше отбор слайдов
// шёл по обеим школам сразу, без разбора, чьи это строки.
const SCHOOL_ID = resolveSchoolId();
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire("C:/SNR EduOS/package.json");
const { Client } = require("pg");

const CONFIRM = process.argv.includes("--confirm");
const SNAPSHOT = path.join(process.cwd(), "scripts", ".slide-images-before.json");
/** Столько же, сколько у картинки этапа (lib/ai/stage-media-prompts.ts). */
const SIGNED_URL_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;
const PUBLIC_MARK = "/storage/v1/object/public/";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} отсутствует — запускай с --env-file=.env.local из apps/web`);
  return v;
}

const storage = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage;

const db = new Client({ connectionString: env("SUPABASE_DB_URL"), ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const line = (t) => console.log("\n── " + t + " " + "─".repeat(Math.max(0, 62 - t.length)));

// ── 1. ОБЩИЙ ОБХОД: где ещё в базе лежат адреса хранилища ────────────────────
// Публичных бакетов в проекте нет ни одного, значит любой сохранённый
// публичный адрес битый по определению. Ищем по ВСЕМ текстовым и json-колонкам
// схемы, а не только там, где ожидаем.
line("1. ВСЕ СОХРАНЁННЫЕ АДРЕСА ХРАНИЛИЩА В БАЗЕ");

const columns = await q(`
  SELECT table_name, column_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type IN ('text','character varying','json','jsonb')
   ORDER BY table_name, column_name`);

const found = [];
for (const c of columns) {
  const sql = `SELECT
      count(*) FILTER (WHERE "${c.column_name}"::text LIKE '%/storage/v1/object/public/%')::int AS publichnyh,
      count(*) FILTER (WHERE "${c.column_name}"::text LIKE '%/storage/v1/object/sign/%')::int AS podpisannyh
    FROM public."${c.table_name}"`;
  try {
    const [r] = await q(sql);
    if (r.publichnyh || r.podpisannyh) {
      found.push({ tablica: c.table_name, kolonka: c.column_name, publichnyh: r.publichnyh, podpisannyh: r.podpisannyh });
    }
  } catch { /* колонку не прочитать — пропускаем */ }
}
console.table(found.length ? found : [{ note: "адресов хранилища в базе нет" }]);

const brokenElsewhere = found.filter((f) => f.publichnyh > 0 && !(f.tablica === "lesson_stages" && f.kolonka === "slides"));
if (brokenElsewhere.length) {
  console.log("\nБИТОЕ В ДРУГИХ МЕСТАХ (в этом заходе НЕ чиним):");
  console.table(brokenElsewhere);
} else {
  console.log("\nБитых адресов вне слайдов не нашлось.");
}

// ── 2. СЛАЙДЫ: что чиним ────────────────────────────────────────────────────
line("2. СЛАЙДЫ С ПУБЛИЧНЫМ АДРЕСОМ");

// SCHOOL_ID подставляется строкой, а не параметром: помощник q() параметров
// не принимает. Безопасно — значение прошло проверку на форму uuid в
// resolveSchoolId, ничего кроме шестнадцатеричных цифр и дефисов туда не
// пройдёт.
const rows = await q(`
  SELECT ls.id, ls.title, ls.slides::text AS slides_text, l.title AS lesson_title, s.name AS school
    FROM lesson_stages ls
    JOIN lessons l ON l.id = ls.lesson_id
    JOIN schools s ON s.id = ls.school_id
   WHERE ls.slides::text LIKE '%${PUBLIC_MARK}%'
     AND ls.school_id = '${SCHOOL_ID}'
   ORDER BY ls.created_at`);

console.log(`строк со слайдами, где есть публичный адрес: ${rows.length}`);

const plan = [];
for (const row of rows) {
  const urls = [...new Set(row.slides_text.match(/https?:\/\/[^"'\\)\s]+/g) ?? [])]
    .filter((u) => u.includes(PUBLIC_MARK));

  const items = [];
  for (const oldUrl of urls) {
    const after = oldUrl.split(PUBLIC_MARK)[1];
    const bucket = after.split("/")[0];
    const objectPath = after.slice(bucket.length + 1);

    // Подпись служит и проверкой существования: у отсутствующего объекта
    // хранилище подписи не выдаёт.
    const { data: signed, error } = await storage.from(bucket).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
    items.push({
      oldUrl,
      bucket,
      objectPath,
      newUrl: signed?.signedUrl ?? null,
      fileOk: !!signed?.signedUrl,
      error: error?.message ?? null,
    });
  }
  plan.push({ ...row, items });
}

for (const p of plan) {
  console.log(`\n  этап «${String(p.title).slice(0, 40)}» — урок «${p.lesson_title}» (${p.school})`);
  for (const it of p.items) {
    console.log(`    файл ${it.bucket}/${it.objectPath}: ${it.fileOk ? "ЕСТЬ" : "НЕТ — " + it.error}`);
  }
}

const withFile = plan.filter((p) => p.items.every((i) => i.fileOk) && p.items.length > 0);
const withoutFile = plan.filter((p) => p.items.some((i) => !i.fileOk));

line("3. ИТОГ ХОЛОСТОГО СЧЁТА");
console.log(`  строк под починку        : ${withFile.length}`);
console.log(`  строк без файла (не трогаем): ${withoutFile.length}`);
if (withoutFile.length) {
  console.log("\n  БЕЗ ФАЙЛА — показываю отдельно, эти строки останутся как есть:");
  for (const p of withoutFile) console.log(`    ${p.id}  «${p.title}»`);
}

if (withFile.length) {
  const ex = withFile[0].items[0];
  console.log("\n  ПРИМЕР «БЫЛО — СТАЛО»:");
  console.log(`    было : ${ex.oldUrl}`);
  console.log(`    стало: ${ex.newUrl.slice(0, 110)}…`);
  console.log(`    (тот же файл, адрес подписанный, срок 10 лет)`);
}

if (!CONFIRM) {
  console.log("\nЭто ХОЛОСТОЙ прогон: в базу не писали. Запись — той же командой с --confirm.\n");
  await db.end();
} else if (withFile.length === 0) {
  console.log("\nЧинить нечего.\n");
  await db.end();
} else {
  // ── 4. ЗАПИСЬ: снимок «до», затем одна транзакция ─────────────────────────
  line("4. ЗАПИСЬ");

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      withFile.map((p) => ({ id: p.id, title: p.title, slides_before: JSON.parse(p.slides_text) })),
      null,
      2,
    ),
    "utf8",
  );
  console.log(`  снимок «до» сохранён: ${SNAPSHOT}`);

  await db.query("BEGIN");
  let updated = 0;
  try {
    for (const p of withFile) {
      let text = p.slides_text;
      for (const it of p.items) text = text.split(it.oldUrl).join(it.newUrl);
      // Проверяем, что получившееся — по-прежнему годный JSON и что число
      // слайдов не изменилось.
      const before = JSON.parse(p.slides_text);
      const after = JSON.parse(text);
      if (!Array.isArray(after) || after.length !== before.length) {
        throw new Error(`строка ${p.id}: число слайдов изменилось бы (${before.length} → ${after.length})`);
      }
      const res = await db.query(`UPDATE lesson_stages SET slides = $1::jsonb WHERE id = $2`, [text, p.id]);
      updated += res.rowCount;
    }
    await db.query("COMMIT");
    console.log(`  обновлено строк: ${updated}`);
  } catch (e) {
    await db.query("ROLLBACK");
    console.error(`  ОТКАТ: ${e.message}`);
    await db.end();
    process.exitCode = 1;
  }

  // ── 5. СВЕРКА ПОСЛЕ ЗАПИСИ ───────────────────────────────────────────────
  if (process.exitCode !== 1) {
    line("5. СВЕРКА ПОСЛЕ ЗАПИСИ");
    const left = await q(`SELECT count(*)::int AS n FROM lesson_stages WHERE slides::text LIKE '%${PUBLIC_MARK}%'`);
    console.log(`  осталось строк с публичным адресом: ${left[0].n}`);

    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
    for (const snap of snapshot) {
      const [now] = await q(`SELECT slides::text AS t FROM lesson_stages WHERE id = $1`, [snap.id]);
      const nowSlides = JSON.parse(now.t);
      const beforeSlides = snap.slides_before;

      // Сверяем содержимое, кроме адресов: обнуляем адреса с обеих сторон.
      const strip = (arr) =>
        JSON.stringify(arr).replace(/https?:\/\/[^"'\\)\s]+/g, "<адрес>");
      const same = strip(nowSlides) === strip(beforeSlides);
      console.log(`  ${snap.id}: слайдов ${nowSlides.length} (было ${beforeSlides.length}), ` +
        `содержимое кроме адреса ${same ? "не изменилось" : "ИЗМЕНИЛОСЬ"}`);

      for (const s of nowSlides) {
        const urls = (JSON.stringify(s).match(/https?:\/\/[^"'\\)\s]+/g) ?? []);
        for (const u of urls) {
          let status = "?";
          try {
            const r = await fetch(u, { headers: { Range: "bytes=0-0" } });
            status = r.status;
          } catch (e) { status = "сеть: " + e.message; }
          console.log(`    ссылка отвечает: ${status} ${String(status).startsWith("2") ? "— файл отдаётся" : ""}`);
        }
      }
    }
    await db.end();
  }
}
