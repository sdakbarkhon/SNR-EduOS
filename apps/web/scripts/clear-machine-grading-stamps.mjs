#!/usr/bin/env node
// 20.08.2026 — чистка отметок времени, которые поставил не учитель.
//
// ЗАЧЕМ. Миграция 218 починила будущее: отметку времени (graded_at) и автора
// оценки (graded_by) теперь заводит только рука учителя. Но записи, сделанные
// ДО неё, остались как были — отметка стоит, автора нет. Для замка оценок
// (миграция 203) такая запись выглядит как «оценку поставили давно», и он
// запирает её навсегда: учитель не может исправить оценку за работу, которую
// он никогда не оценивал.
//
// ЧТО ДЕЛАЕТ. Обнуляет graded_at ровно там, где graded_by пуст. И только это.
// После обнуления замок видит «отметки нет» → «значит первое выставление» →
// разрешает учителю поставить свою оценку, и с этого момента часы идут от
// него, как и задумано.
//
// ГДЕ ИМЕННО. Две таблицы:
//   public.test_submissions       — сдачи тестов
//   public.lesson_stage_progress  — прохождение этапов урока (квиз, Kahoot)
//
// ПОЧЕМУ ТОЛЬКО ЭТИ ДВЕ. Разбор 20.08.2026 показал: отметку при сдаче ученика
// проставляли триггер set_grading_meta (тесты) и функции submit_quiz /
// kahoot_finish (этапы). Домашние задания этой болезнью не болеют — там
// отметка ставилась только когда оценка уже не пуста, а ученик оценку не
// пишет. Журнал урока и посещаемость скрипт СЧИТАЕТ и ПОКАЗЫВАЕТ, но не
// трогает: там колонки объявлены NOT NULL, обнулить их нельзя физически, да и
// строку в обеих таблицах заводит сам учитель.
//
// ЧЕГО НЕ ДЕЛАЕТ. Не меняет баллы, оценки, статусы, даты сдачи. Не удаляет
// записи. Не проставляет автора задним числом — кто именно оценивал, мы не
// знаем, и выдумывать нельзя. Записи с указанным автором не трогает вовсе:
// это настоящие оценки учителя, и запирать их правильно.
//
// ПОВТОРНЫЙ ЗАПУСК БЕЗОПАСЕН. Условие «отметка есть, автора нет» после первого
// прохода не выполняется ни для одной строки, поэтому второй запуск не найдёт
// работы и ничего не напишет.
//
// ЗАПУСК:
//   node apps/web/scripts/clear-machine-grading-stamps.mjs            — холостой прогон
//   node apps/web/scripts/clear-machine-grading-stamps.mjs --confirm  — запись
//
// Подключение — напрямую к Postgres через SUPABASE_DB_URL из
// apps/web/.env.local, тем же приёмом, что apply-migration.mjs: запись обязана
// идти ОДНОЙ транзакцией, а сверка «до/после» — внутри неё же.

import fs from "node:fs";
import { resolveSchoolId } from "./_school-arg.mjs";

// 26.08.2026: школа приходит аргументом --school. Раньше обнуление отметок
// шёл по обеим школам сразу, без разбора, чьи это строки.
const SCHOOL_ID = resolveSchoolId();
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.slice(2).includes("--confirm");

function dbUrl() {
  const raw = fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8");
  const m = /SUPABASE_DB_URL="?([^"\n\r]+)"?/.exec(raw);
  if (!m) throw new Error("SUPABASE_DB_URL не найден в apps/web/.env.local");
  return m[1];
}

/** Таблицы, которые чистим. Колонка отметки у обеих одна и та же. */
const ЦЕЛИ = [
  { table: "test_submissions", stamp: "graded_at", author: "graded_by", подпись: "Сдачи тестов" },
  { table: "lesson_stage_progress", stamp: "graded_at", author: "graded_by", подпись: "Этапы урока" },
];

/** Таблицы, которые только считаем и показываем — решение по ним за заказчиком. */
const СМОТРИМ = [
  { table: "lesson_grades", stamp: "graded_at", author: "graded_by", подпись: "Журнал урока" },
  { table: "attendance", stamp: "marked_at", author: "marked_by", подпись: "Посещаемость" },
  { table: "homework_submissions", stamp: "graded_at", author: "graded_by", подпись: "Домашние задания" },
];

const line = (s = "") => console.log(s);
const head = (s) => { line(); line(s); line("─".repeat(s.length)); };

async function счёт(c, { table, stamp, author }) {
  const { rows } = await c.query(`
    SELECT count(*)::int AS всего,
           count(*) FILTER (WHERE ${stamp} IS NOT NULL)::int AS с_отметкой,
           count(*) FILTER (WHERE ${stamp} IS NOT NULL AND ${author} IS NULL)::int AS без_автора,
           count(*) FILTER (WHERE ${stamp} IS NOT NULL AND ${author} IS NOT NULL)::int AS с_автором,
           count(*) FILTER (WHERE ${stamp} IS NULL)::int AS без_отметки
      FROM public.${table}`);
  return rows[0];
}

async function поШколам(c, { table, stamp, author }) {
  const { rows } = await c.query(`
    SELECT s.name AS школа, s.is_demo AS демо, count(*)::int AS записей
      FROM public.${table} t
      JOIN public.schools s ON s.id = t.school_id
     WHERE t.${stamp} IS NOT NULL AND t.${author} IS NULL
     GROUP BY s.name, s.is_demo
     ORDER BY s.is_demo DESC`);
  return rows;
}

/** Колонки, которые обязаны остаться неизменными. Сверяем контрольной суммой. */
const СВЕРКА = {
  test_submissions: "count(*)::text || '|' || COALESCE(sum(score)::text,'-') || '|' || " +
    "COALESCE(sum(grade)::text,'-') || '|' || COALESCE(sum(max_score)::text,'-') || '|' || " +
    "count(graded_by)::text || '|' || COALESCE(sum(extract(epoch FROM submitted_at))::bigint::text,'-')",
  lesson_stage_progress: "count(*)::text || '|' || COALESCE(sum(grade)::text,'-') || '|' || " +
    "count(graded_by)::text || '|' || COALESCE(sum(extract(epoch FROM completed_at))::bigint::text,'-') || '|' || " +
    "count(*) FILTER (WHERE is_completed)::text",
};

async function отпечаток(c, table) {
  const { rows } = await c.query(`SELECT ${СВЕРКА[table]} AS отпечаток FROM public.${table}`);
  return rows[0]["отпечаток"];
}

async function примерыТестов(c, limit) {
  const { rows } = await c.query(`
    SELECT h.title AS работа, st.full_name AS ученик, sc.name AS школа,
           ts.score, ts.max_score, ts.grade,
           ts.submitted_at, ts.graded_at, ts.graded_by
      FROM public.test_submissions ts
      JOIN public.homework h ON h.id = ts.homework_id
      JOIN public.students st ON st.id = ts.student_id
      JOIN public.schools sc ON sc.id = ts.school_id
     WHERE ts.graded_at IS NOT NULL AND ts.graded_by IS NULL
     ORDER BY ts.graded_at DESC LIMIT $1`, [limit]);
  return rows;
}

async function примерыЭтапов(c, limit) {
  const { rows } = await c.query(`
    SELECT ls.title AS работа, ls.content_type AS тип, st.full_name AS ученик,
           sc.name AS школа, p.grade, p.completed_at, p.graded_at, p.graded_by
      FROM public.lesson_stage_progress p
      JOIN public.lesson_stages ls ON ls.id = p.stage_id
      JOIN public.students st ON st.id = p.student_id
      JOIN public.schools sc ON sc.id = p.school_id
     WHERE p.graded_at IS NOT NULL AND p.graded_by IS NULL
     ORDER BY p.graded_at DESC LIMIT $1`, [limit]);
  return rows;
}

/** Живая проба: может ли учитель исправить оценку у этой сдачи теста.
 *
 *  Работает ВНУТРИ уже открытой транзакции и под точкой сохранения: что бы
 *  проба ни сделала, снаружи от неё не остаётся ничего. Транзакцию открывает и
 *  откатывает вызывающий — так пробу можно поставить и на нетронутую базу, и
 *  на базу, где чистка сымитирована и тут же будет откачена. */
async function пробаВнутри(c, submissionId) {
  const { rows } = await c.query(`
    SELECT t.user_id, ts.score, ts.max_score
      FROM public.test_submissions ts
      JOIN public.homework h ON h.id = ts.homework_id
      JOIN public.groups g ON g.id = h.group_id
      JOIN public.teachers t ON t.id = g.teacher_id
     WHERE ts.id = $1`, [submissionId]);
  if (!rows[0]) return "учителя группы не нашёл";
  const { user_id, score, max_score } = rows[0];
  const новый = score > 0 ? score - 1 : Math.min(1, max_score ?? 1);

  await c.query("SAVEPOINT проба");
  await c.query("SELECT set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: user_id, role: "authenticated" })]);
  await c.query("SET LOCAL ROLE authenticated");
  let итог;
  try {
    await c.query("UPDATE public.test_submissions SET score = $2 WHERE id = $1", [submissionId, новый]);
    итог = "МОЖЕТ исправить";
    await c.query("RESET ROLE");
    await c.query("ROLLBACK TO SAVEPOINT проба");
  } catch (e) {
    итог = `НЕ может: ${e.message}`;
    await c.query("ROLLBACK TO SAVEPOINT проба");
    await c.query("RESET ROLE");
  }
  await c.query("SELECT set_config('request.jwt.claims', '', true)");
  return итог;
}

/** Проба на нетронутой базе: открыть транзакцию, спросить, откатить. */
async function пробаСейчас(c, id) {
  await c.query("BEGIN");
  try { return await пробаВнутри(c, id); }
  finally { await c.query("ROLLBACK"); }
}

/** Проба «как будет после чистки»: чистим ОДНУ строку и тут же откатываем. */
async function пробаПослеЧистки(c, id) {
  await c.query("BEGIN");
  try {
    await c.query("UPDATE public.test_submissions SET graded_at = NULL WHERE id = $1", [id]);
    return await пробаВнутри(c, id);
  } finally { await c.query("ROLLBACK"); }
}

async function main() {
  const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // ── Ворота: без миграции 218 чистка бессмысленна ──────────────────────
    const { rows: [g] } = await c.query(`
      SELECT pg_get_functiondef(p.oid) LIKE '%v_teacher IS NULL%' AS есть_218
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'set_grading_meta'`);
    line(`Миграция 218 применена: ${g && g.есть_218 ? "ДА" : "НЕТ"}`);
    if (!g || !g.есть_218) {
      line();
      line("ОСТАНОВКА. Миграция 218 не применена. Чистить рано: новые сдачи снова");
      line("проставят отметку, и через день всё вернётся. Сначала применить 218.");
      return;
    }

    // ── Что затронем ─────────────────────────────────────────────────────
    head("ЧТО ЗАТРОНЕМ");
    const план = [];
    for (const цель of ЦЕЛИ) {
      const n = await счёт(c, цель);
      const шк = await поШколам(c, цель);
      план.push({ цель, n, шк });
      line(`${цель.подпись} (${цель.table})`);
      line(`   всего строк ................. ${n.всего}`);
      line(`   с отметкой времени .......... ${n.с_отметкой}`);
      line(`   → ЗАТРОНЕМ (автор пуст) ..... ${n.без_автора}`);
      line(`   не тронем, автор указан ..... ${n.с_автором}`);
      line(`   не тронем, отметки и так нет  ${n.без_отметки}`);
      for (const s of шк) line(`      ${s.демо ? "демо   " : "реальная"} ${s.школа}: ${s.записей}`);
      if (!шк.length) line("      (нечего чистить)");
    }
    const всегоЗатронем = план.reduce((s, p) => s + p.n.без_автора, 0);

    // ── Три остальные таблицы: только показываем ─────────────────────────
    head("ОСТАЛЬНЫЕ ТРИ ТАБЛИЦЫ — ТОЛЬКО СЧЁТ, НЕ ТРОГАЕМ");
    for (const т of СМОТРИМ) {
      const n = await счёт(c, т);
      const { rows: [k] } = await c.query(`
        SELECT is_nullable AS можно_обнулить FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [т.table, т.stamp]);
      line(`${т.подпись} (${т.table}.${т.stamp})`);
      line(`   всего ${n.всего}, с отметкой ${n.с_отметкой}, из них автор пуст: ${n.без_автора}`);
      line(`   колонку отметки можно обнулить: ${k && k.можно_обнулить === "YES" ? "да" : "НЕТ, объявлена NOT NULL"}`);
    }

    // ── Примеры ──────────────────────────────────────────────────────────
    head("ПРИМЕРЫ ЦЕЛИКОМ");
    const прТ = await примерыТестов(c, 3);
    for (const r of прТ) {
      line(`• ТЕСТ «${r.работа}»`);
      line(`  ученик: ${r.ученик} (${r.школа})`);
      line(`  балл ${r.score}/${r.max_score}, оценка ${r.grade ?? "—"}`);
      line(`  сдано ....... ${r.submitted_at.toISOString()}`);
      line(`  отметка ..... ${r.graded_at.toISOString()}  ← обнулим`);
      line(`  автор ....... ${r.graded_by ?? "пусто"}  ← не трогаем`);
    }
    const прЭ = await примерыЭтапов(c, 3);
    for (const r of прЭ) {
      line(`• ЭТАП «${r.работа}» (${r.тип})`);
      line(`  ученик: ${r.ученик} (${r.школа})`);
      line(`  оценка ${r.grade ?? "—"}`);
      line(`  сдано ....... ${r.completed_at ? r.completed_at.toISOString() : "—"}`);
      line(`  отметка ..... ${r.graded_at.toISOString()}  ← обнулим`);
      line(`  автор ....... ${r.graded_by ?? "пусто"}  ← не трогаем`);
    }

    // ── Живая проба на одной записи ──────────────────────────────────────
    const { rows: [цельПробы] } = await c.query(`
      SELECT id FROM public.test_submissions
       WHERE graded_at IS NOT NULL AND graded_by IS NULL ORDER BY graded_at DESC LIMIT 1`);
    if (цельПробы) {
      head("ЖИВАЯ ПРОБА: МОЖЕТ ЛИ УЧИТЕЛЬ ИСПРАВИТЬ ОЦЕНКУ");
      line(`запись ${цельПробы.id}`);
      line(`   СЕЙЧАС .............. ${await пробаСейчас(c, цельПробы.id)}`);
      if (!CONFIRM) {
        line(`   ЕСЛИ ПОЧИСТИТЬ ...... ${await пробаПослеЧистки(c, цельПробы.id)}`);
        line("   (обе пробы под откатом, база не менялась)");
      }
    }

    if (!CONFIRM) {
      head("ХОЛОСТОЙ ПРОГОН");
      line(`База НЕ менялась. К записи готово: ${всегоЗатронем} строк.`);
      line("Для записи запусти с --confirm.");
      return;
    }

    // ── Снимок «до» ──────────────────────────────────────────────────────
    const снимок = { когда: new Date().toISOString(), таблицы: {} };
    for (const { цель } of план) {
      const { rows } = await c.query(`
        SELECT id, ${цель.stamp} AS отметка FROM public.${цель.table}
         WHERE ${цель.stamp} IS NOT NULL AND ${цель.author} IS NULL ORDER BY id`);
      снимок.таблицы[цель.table] = {
        отпечаток: await отпечаток(c, цель.table),
        строки: rows.map((r) => ({ id: r.id, отметка: r.отметка.toISOString() })),
      };
    }
    const снимокПуть = path.join(HERE, ".machine-stamps-before.json");
    fs.writeFileSync(снимокПуть, JSON.stringify(снимок, null, 1), "utf8");
    head("СНИМОК «ДО»");
    line(`сохранён: ${снимокПуть}`);

    // ── Запись одной транзакцией ─────────────────────────────────────────
    head("ЗАПИСЬ");
    await c.query("BEGIN");
    const итоги = {};
    for (const { цель } of план) {
      const r = await c.query(`
        UPDATE public.${цель.table} SET ${цель.stamp} = NULL
         WHERE ${цель.stamp} IS NOT NULL AND ${цель.author} IS NULL
           AND school_id = $1`, [SCHOOL_ID]);
      итоги[цель.table] = r.rowCount;
      line(`${цель.подпись}: обнулено ${r.rowCount}`);
    }

    // ── Сверка ВНУТРИ той же транзакции ──────────────────────────────────
    head("СВЕРКА");
    let беда = null;
    for (const { цель, n } of план) {
      const после = await счёт(c, цель);
      const отпПосле = await отпечаток(c, цель.table);
      const отпДо = снимок.таблицы[цель.table].отпечаток;
      const ok = {
        "число строк то же": после.всего === n.всего,
        "баллы и оценки не менялись": отпПосле === отпДо,
        "автор не появился и не исчез": после.с_автором === n.с_автором,
        "с пустым автором отметок не осталось": после.без_автора === 0,
        "записи с автором остались с отметкой": после.с_отметкой === n.с_автором,
      };
      line(`${цель.подпись}:`);
      for (const [k, v] of Object.entries(ok)) {
        line(`   ${v ? "✔" : "✘"} ${k}`);
        if (!v) беда = `${цель.table}: ${k}`;
      }
    }
    if (беда) {
      await c.query("ROLLBACK");
      line();
      line(`РАСХОЖДЕНИЕ: ${беда}`);
      line("ОТКАТ выполнен, база не изменена. Разбирайся до повторного запуска.");
      process.exitCode = 1;
      return;
    }
    await c.query("COMMIT");
    line();
    line("COMMIT. Записано.");

    // ── Проба после записи ───────────────────────────────────────────────
    if (цельПробы) {
      head("ЖИВАЯ ПРОБА ПОСЛЕ ЧИСТКИ");
      line(`запись ${цельПробы.id}`);
      line(`   ТЕПЕРЬ: ${await пробаСейчас(c, цельПробы.id)}`);
    }
    // Контрольная: запись, у которой автор БЫЛ указан, обязана остаться запертой.
    const { rows: [запертая] } = await c.query(`
      SELECT id FROM public.test_submissions
       WHERE graded_at IS NOT NULL AND graded_by IS NOT NULL
         AND graded_at <= now() - public.mark_edit_window()
       ORDER BY graded_at DESC LIMIT 1`);
    if (запертая) {
      line(`контрольная запись с автором ${запертая.id}`);
      line(`   ${await пробаСейчас(c, запертая.id)}   ← должно быть «НЕ может: mark_locked»`);
    }

    head("ИТОГ");
    for (const [t, n] of Object.entries(итоги)) line(`${t}: ${n}`);
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch { /* не в транзакции */ }
    console.error("СБОЙ, база не изменена:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

await main();
