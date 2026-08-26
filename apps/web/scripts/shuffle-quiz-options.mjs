#!/usr/bin/env node
// 19.08.2026 — перемешивание вариантов ответа в вопросах квизов.
//
// ЗАЧЕМ. Разведка нашла: у 373 вопросов из 478 правильный вариант стоит
// ПЕРВЫМ (78%), а на обоих Kahoot-этапах — 8 из 8. По здешней шкале оценок
// «жать первую кнопку не читая» даёт четвёрку на QIA-квизе и пятёрку на
// Kahoot. Это работает без всякого взлома, не зависит ни от прав доступа, ни
// от того, где считается балл, и потому чинится раньше и дешевле всего
// остального — правкой данных, без единой строки кода.
//
// ЧТО ДЕЛАЕТ. Внутри каждого вопроса переставляет варианты и правит номер
// правильного так, чтобы правильным остался ТОТ ЖЕ САМЫЙ вариант по смыслу.
// Тексты вопросов и вариантов не меняются ни на символ — только порядок.
//
// ПОЧЕМУ ЭТО БЕЗОПАСНО ДЛЯ УЖЕ СДАННЫХ РАБОТ. В ответах учеников хранится
// НОМЕР выбранного варианта (quiz_answers.selected_option_index). После
// перестановки номер указывал бы на другой текст, поэтому скрипт
// перекладывает и его: ответ продолжает указывать на тот же вариант, который
// человек выбрал. Баллы, признак правильности и оценки НЕ трогаются вовсе:
// ответил неверно — и после перекладки ответил неверно.
//
// ПОВТОРЯЕМОСТЬ — ГЛАВНОЕ СВОЙСТВО, И ОНО НЕ САМО СОБОЙ.
// Наивный перемешиватель при втором запуске перетасует уже перетасованное и
// даст новый порядок. Здесь порядок зависит только от двух вещей, ни одна из
// которых от запуска к запуску не меняется:
//   1) НАБОР текстов вариантов, приведённый к каноническому виду —
//      отсортированный по самому тексту. Текущий порядок в базе на результат
//      не влияет вовсе;
//   2) идентификатор вопроса, из которого выводится зерно тасовки.
// Отсюда: сколько раз ни запусти — порядок один и тот же, а второй запуск
// вообще ничего не пишет. Это же свойство делает безопасным повторный запуск
// после сбоя посередине.
//
// ЧЕГО НЕ ДЕЛАЕТ: не трогает вопросы тестов и домашних заданий (это другие
// таблицы, test_questions / test_question_options, закрыты миграцией 215), не
// пересчитывает оценки, не ищет подделки, не меняет схему.
//
// ДЕМО-ШКОЛА ПЕРЕМЕШИВАЕТСЯ ТОЖЕ. Снимок эталона демо (demo_baseline) этим не
// затрагивается: в нём лежат только идентификаторы сущностей четырёх видов —
// lesson_stage, lesson_material, lesson, homework, — а вопросов квиза там нет
// ни одного. Проверено живым запросом перед написанием скрипта; скрипт
// проверяет это ещё раз сам и отказывается писать, если вдруг увидит иное.
//
// ЗАПУСК:
//   node apps/web/scripts/shuffle-quiz-options.mjs            — холостой прогон
//   node apps/web/scripts/shuffle-quiz-options.mjs --confirm  — запись
//
// Подключение — напрямую к Postgres через SUPABASE_DB_URL из
// apps/web/.env.local, тем же приёмом, что apply-migration.mjs: перекладка
// вопросов и ответов обязана идти ОДНОЙ транзакцией, а через PostgREST это не
// выразить.

import fs from "node:fs";
import { resolveSchoolId } from "./_school-arg.mjs";

// 26.08.2026: школа приходит аргументом --school. Раньше отбор вопросов
// шёл по обеим школам сразу, без разбора, чьи это строки.
const SCHOOL_ID = resolveSchoolId();
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const CONFIRM = argv.includes("--confirm");

// ─── подключение ────────────────────────────────────────────────────────────
function dbUrl() {
  const envPath = path.join(HERE, "..", ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const m = /SUPABASE_DB_URL="?([^"\n]+)"?/.exec(raw);
  if (!m) throw new Error("SUPABASE_DB_URL не найден в apps/web/.env.local");
  return m[1];
}

// ─── детерминированная тасовка ──────────────────────────────────────────────

/** Зерно из строки. FNV-1a: короткий, без зависимостей, одинаковый везде. */
function seedFrom(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Генератор псевдослучайных чисел mulberry32: то же зерно — та же
 *  последовательность, на любой машине и в любой версии Node. Именно поэтому
 *  здесь не Math.random(): его последовательность невоспроизводима. */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Новый порядок вариантов для вопроса.
 *
 * Вход канонизируется сортировкой по тексту — поэтому результат не зависит от
 * того, в каком порядке варианты лежат в базе СЕЙЧАС. Это и даёт
 * повторяемость: второй запуск получит тот же самый ответ и ничего не изменит.
 *
 * Возвращает массив текстов в новом порядке.
 */
function newOrder(questionId, options) {
  const canonical = options.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const next = rng(seedFrom(questionId));
  // Тасовка Фишера — Йетса по канонизированному массиву.
  for (let i = canonical.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [canonical[i], canonical[j]] = [canonical[j], canonical[i]];
  }
  return canonical;
}

// ─── работа ─────────────────────────────────────────────────────────────────

async function main() {
  const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Проверка про демо-эталон — до всего остального.
    const baseline = await client.query(
      `SELECT DISTINCT entity_type FROM public.demo_baseline ORDER BY 1`,
    );
    const types = baseline.rows.map((r) => r.entity_type);
    const quizInBaseline = types.some((t) => /quiz|question/i.test(t));
    console.log(`Снимок эталона демо содержит виды: ${types.join(", ") || "(пусто)"}`);
    if (quizInBaseline) {
      console.log("ОСТАНОВКА: в снимке эталона демо есть вопросы квиза — перемешивание его затронет.");
      return;
    }
    console.log("Вопросов квиза в снимке нет — перемешивание его не затрагивает.\n");

    const questions = (await client.query(`
      SELECT q.id, q.stage_id, q.question_text, q.options, q.correct_option_index,
             s.name AS school_name, s.is_demo
        FROM public.quiz_questions q
        JOIN public.schools s ON s.id = q.school_id
       WHERE q.school_id = $1
       ORDER BY s.name, q.stage_id, q.position
    `, [SCHOOL_ID])).rows;

    const answers = (await client.query(`
      SELECT id, question_id, selected_option_index FROM public.quiz_answers
       WHERE selected_option_index IS NOT NULL
    `)).rows;
    const answersByQuestion = new Map();
    for (const a of answers) {
      const list = answersByQuestion.get(a.question_id) ?? [];
      list.push(a);
      answersByQuestion.set(a.question_id, list);
    }

    const plan = [];       // что писать
    const skipped = [];    // и почему пропущено
    const bySchool = new Map();
    const before = [0, 0, 0, 0, 0, 0, 0, 0];
    const after = [0, 0, 0, 0, 0, 0, 0, 0];
    let answersMoved = 0;

    for (const q of questions) {
      const opts = Array.isArray(q.options) ? q.options.map(String) : [];
      const oldIdx = q.correct_option_index;

      if (opts.length < 2) { skipped.push({ id: q.id, why: "меньше двух вариантов" }); continue; }
      if (oldIdx == null || oldIdx < 0 || oldIdx >= opts.length) {
        skipped.push({ id: q.id, why: `номер правильного вне диапазона: ${oldIdx}` }); continue;
      }
      // Повторяющиеся тексты сделали бы перекладку ответов неоднозначной —
      // такой вопрос не трогаем вовсе и говорим об этом вслух.
      if (new Set(opts).size !== opts.length) {
        skipped.push({ id: q.id, why: "варианты повторяются, перекладка неоднозначна" }); continue;
      }

      const correctText = opts[oldIdx];
      const fresh = newOrder(q.id, opts);
      const newIdx = fresh.indexOf(correctText);
      if (newIdx < 0) { skipped.push({ id: q.id, why: "правильный текст потерялся — внутренняя ошибка" }); continue; }

      before[oldIdx] += 1;
      after[newIdx] += 1;

      const key = `${q.school_name}${q.is_demo ? " (демо)" : ""}`;
      bySchool.set(key, (bySchool.get(key) ?? 0) + 1);

      // Перекладка ответов: старый номер → текст → новый номер.
      const moves = [];
      for (const a of answersByQuestion.get(q.id) ?? []) {
        const picked = opts[a.selected_option_index];
        const to = picked === undefined ? null : fresh.indexOf(picked);
        if (to == null || to < 0) {
          skipped.push({ id: q.id, why: `ответ ${a.id}: выбранный вариант ${a.selected_option_index} не найден` });
          continue;
        }
        if (to !== a.selected_option_index) answersMoved += 1;
        moves.push({ answerId: a.id, from: a.selected_option_index, to });
      }

      // Совпадает ли задуманное с тем, что уже лежит в базе. Нужно, чтобы
      // повторный запуск честно говорил «работы нет», а не пересчитывал план
      // как работу: порядок-то он выдаст тот же самый (см. шапку про
      // повторяемость), и без этой проверки отличить «сделано» от «предстоит»
      // было бы нечем.
      const sameOptions = opts.length === fresh.length && opts.every((o, i) => o === fresh[i]);
      const already = sameOptions && oldIdx === newIdx && moves.every((m) => m.to === m.from);

      plan.push({
        id: q.id, questionText: q.question_text,
        oldOptions: opts, newOptions: fresh,
        oldIdx, newIdx, moves, already,
        school: key,
      });
    }

    // ── показ ──────────────────────────────────────────────────────────────
    const toChange = plan.filter((p) => !p.already);
    console.log(`Вопросов всего: ${questions.length}`);
    console.log(`Изменится: ${toChange.length}`);
    console.log(`Уже на месте: ${plan.length - toChange.length}`);
    console.log(`Пропущено: ${skipped.length}`);
    if (toChange.length === 0) console.log("РАБОТЫ НЕТ — порядок уже такой, какой нужен.");
    for (const s of skipped.slice(0, 10)) console.log(`   • ${s.id} — ${s.why}`);
    console.log("\nПо школам:");
    for (const [school, n] of [...bySchool].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${school}: ${n}`);
    }

    const pct = (n) => (plan.length ? Math.round((n / plan.length) * 1000) / 10 : 0);
    console.log("\nГде стоит правильный вариант (место → сколько вопросов):");
    console.log("   место │ было              │ станет");
    for (let i = 0; i < 4; i++) {
      console.log(
        `     ${i + 1}   │ ${String(before[i]).padStart(4)} (${String(pct(before[i])).padStart(5)}%) │ ` +
        `${String(after[i]).padStart(4)} (${String(pct(after[i])).padStart(5)}%)`,
      );
    }

    console.log(`\nОтветов учеников всего: ${answers.length}`);
    console.log(`Из них сменят номер: ${answersMoved}`);

    console.log("\nПримеры (было → стало):");
    for (const p of toChange.slice(0, 4)) {
      console.log(`\n  ── ${p.school}`);
      console.log(`  Вопрос: ${p.questionText.slice(0, 90)}`);
      console.log("  БЫЛО:");
      p.oldOptions.forEach((o, i) => console.log(`    ${i + 1}. ${i === p.oldIdx ? "[верный] " : "         "}${o.slice(0, 70)}`));
      console.log("  СТАЛО:");
      p.newOptions.forEach((o, i) => console.log(`    ${i + 1}. ${i === p.newIdx ? "[верный] " : "         "}${o.slice(0, 70)}`));
      for (const m of p.moves) console.log(`    ответ ученика: место ${m.from + 1} → ${m.to + 1}`);
    }

    if (!CONFIRM) {
      console.log("\n[ХОЛОСТОЙ ПРОГОН] База не менялась. Для записи запусти с --confirm.");
      return;
    }

    // ── запись ─────────────────────────────────────────────────────────────
    console.log("\nЗапись…");
    await client.query("BEGIN");
    let wroteQ = 0, wroteA = 0;
    for (const p of toChange) {
      const res = await client.query(
        `UPDATE public.quiz_questions SET options = $2::jsonb, correct_option_index = $3 WHERE id = $1`,
        [p.id, JSON.stringify(p.newOptions), p.newIdx],
      );
      wroteQ += res.rowCount;
      for (const m of p.moves) {
        if (m.to === m.from) continue;
        const r2 = await client.query(
          `UPDATE public.quiz_answers SET selected_option_index = $2 WHERE id = $1`,
          [m.answerId, m.to],
        );
        wroteA += r2.rowCount;
      }
    }
    await client.query("COMMIT");
    console.log(`Записано: вопросов ${wroteQ}, ответов ${wroteA}.`);
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* не в транзакции */ }
    console.error("СБОЙ, база не изменена:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
