#!/usr/bin/env node
// Промт 1 — "Догнать test_submissions с AI-ответами".
//
// РАЗВЕДКА: премиса промта не подтвердилась — все 120 test_submissions
// демо-школы УЖЕ имеют полностью заполненные test_answers (12 на сдачу,
// 1440 всего, согласованные с score/grade). Это сделал уже существующий
// apps/web/scripts/backfill-test-answers.mjs, написанный и запущенный
// (CONFIRM=YES) раньше в этой же сессии — его собственный doc-комментарий
// фиксирует стартовое состояние "150 test_submissions, 0 test_answers",
// live-проверка подтверждает, что он с тех пор реально отработал.
//
// Единственный реальный пробел — распределение ОЦЕНОК не совпадает с
// запрошенным 80%/15%/5% (grade5/grade4/grade3): живое на момент разведки
// — 95×grade5 (79%) / 25×grade4 (21%) / 0×grade3 (0%). Тира "3+ ошибки"
// нет вообще. Этот скрипт НЕ заполняет ответы заново (нечего заполнять) —
// перебалансирует часть сдач с grade=4 в grade=3, РЕАЛЬНО подменяя часть
// верных test_answers на неверные (не только меняя число в grade), чтобы
// "Просмотреть свои ответы" в TestPlayer.tsx показывал консистентную
// картину (Results.canShowAnswers читает реальные test_answers).
//
// Идемпотентно: если live grade=3 count уже достиг цели — выходит без правок.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fill-test-submissions.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const TARGET_GRADE3_COUNT = 6; // ~5% из 120

async function main() {
  console.log(`Перебалансировка test_submissions (тир grade=3) — демо-школа (${SCHOOL_ID})\n`);

  const { data: submissions, error } = await db.from("test_submissions")
    .select("id, homework_id, student_id, score, max_score, grade")
    .eq("school_id", SCHOOL_ID);
  if (error) fail(`Ошибка запроса test_submissions: ${error.message}`);
  console.log(`test_submissions всего: ${submissions.length} (ожидание 120).`);

  const current3 = submissions.filter((s) => s.grade === 3).length;
  console.log(`Уже grade=3: ${current3} (цель: ${TARGET_GRADE3_COUNT}).`);
  if (current3 >= TARGET_GRADE3_COUNT) { console.log("Цель уже достигнута, выходим."); return; }

  const need = TARGET_GRADE3_COUNT - current3;
  // Кандидаты — сейчас grade=4 (меньше всего неверных ответов среди
  // "не идеальных" сдач), детерминированный порядок по id для воспроизводимости.
  const candidates = submissions
    .filter((s) => s.grade === 4)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, need);
  if (candidates.length < need) {
    console.warn(`  !! Кандидатов с grade=4 меньше, чем нужно (${candidates.length}/${need}) — перебалансирую сколько есть.`);
  }

  let ok = 0;
  for (const sub of candidates) {
    const { data: answers, error: aErr } = await db.from("test_answers")
      .select("id, question_id, selected_option_id, is_correct")
      .eq("submission_id", sub.id);
    if (aErr) { console.error(`  !! ${sub.id} test_answers read failed: ${aErr.message}`); continue; }

    const currentlyCorrect = answers.filter((a) => a.is_correct);
    const alreadyWrong = answers.length - currentlyCorrect.length;
    const WRONG_NEEDED = 3; // "3+ ошибки" — минимально удовлетворяющее значение
    const toFlip = Math.max(0, WRONG_NEEDED - alreadyWrong);
    const flipTargets = currentlyCorrect.slice(0, toFlip);

    let flipFailed = false;
    for (const ans of flipTargets) {
      const { data: wrongOpt, error: optErr } = await db.from("test_question_options")
        .select("id").eq("question_id", ans.question_id).eq("is_correct", false).limit(1).maybeSingle();
      if (optErr || !wrongOpt) {
        console.error(`  !! ${sub.id} нет неверного варианта для вопроса ${ans.question_id}: ${optErr?.message ?? "не найден"}`);
        flipFailed = true; break;
      }
      const { error: updAnsErr } = await db.from("test_answers")
        .update({ selected_option_id: wrongOpt.id, is_correct: false }).eq("id", ans.id);
      if (updAnsErr) { console.error(`  !! ${sub.id} update test_answers failed: ${updAnsErr.message}`); flipFailed = true; break; }
    }
    if (flipFailed) continue;

    const newWrong = alreadyWrong + toFlip;
    const newScore = answers.length - newWrong;
    const { error: updSubErr } = await db.from("test_submissions")
      .update({ score: newScore, grade: 3 }).eq("id", sub.id);
    if (updSubErr) { console.error(`  !! ${sub.id} update test_submissions failed: ${updSubErr.message}`); continue; }
    ok++;
    console.log(`  [${sub.id}] grade 4→3, score ${sub.score}/${sub.max_score} → ${newScore}/${sub.max_score} (${newWrong} неверных из ${answers.length})`);
  }

  console.log(`\nГотово: перебалансировано ${ok}/${candidates.length}.`);

  const { data: after } = await db.from("test_submissions").select("grade").eq("school_id", SCHOOL_ID);
  const dist = {};
  for (const r of after) dist[r.grade] = (dist[r.grade] ?? 0) + 1;
  console.log(`Итоговое распределение grade (${after.length} сдач): ${JSON.stringify(dist)}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
