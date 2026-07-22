// ОДНОРАЗОВЫЙ скрипт — досоздаёт test_answers (ответы по каждому вопросу) для
// уже существующих test_submissions, чтобы у ученика на сданном тесте кнопка
// «Просмотреть свои ответы» раскрывалась не в пустоту.
//
// ПОЧЕМУ ПУСТО СЕЙЧАС (две причины, обе чинятся здесь):
//   1. reset-homework-generate-new.mjs создавал test_submissions только со
//      score/max_score/grade — БЕЗ test_answers (сознательное упрощение).
//      Подтверждено: 150 test_submissions, 0 test_answers.
//   2. Те же сдачи создавались БЕЗ started_at (0/150). А RLS-политика
//      "student reads test questions" (миграция 31) требует, чтобы у ученика
//      была test_submission с started_at IS NOT NULL — иначе вопросы теста
//      ему не видны вообще. Плюс UI (TestPlayer.load) грузит вопросы только
//      при sub.started_at. Поэтому даже с ответами блок был бы пуст, пока
//      started_at не выставлен.
//
// ЧТО ДЕЛАЕТ (для каждой test_submission):
//   - Если у сдачи уже есть test_answers — ПРОПУСКАЕТ (идемпотентно, без дублей).
//   - Проставляет started_at = submitted_at, если started_at IS NULL.
//   - Досоздаёт ровно один test_answer на каждый single_choice вопрос задания:
//     РОВНО `score` вопросов получают ПРАВИЛЬНЫЙ вариант (is_correct=true),
//     остальные (max_score - score) — СЛУЧАЙНЫЙ неверный вариант из
//     test_question_options этого вопроса (is_correct=false). Так восстановленные
//     ответы согласованы с уже выставленным score.
//
// ЧТО НЕ ТРОГАЕТ: сам score/max_score/grade сдачи (не пересчитывает — ответы
//   подгоняются ПОД существующий score), homework, questions, options, любые
//   другие таблицы.
//
// БЕЗОПАСНОСТЬ:
//   - Dry-run по умолчанию — печатает точный план, НИ ОДНОГО запроса на запись.
//   - Реальное выполнение — только при CONFIRM=YES (или --confirm).
//   - SUPABASE_SERVICE_ROLE_KEY читается молча через _backfill-shared.mjs.
//   - Ошибки не глотаются — любая ошибка чтения/вставки печатается и
//     останавливает скрипт (реф 5222b73).
//   - КРИТИЧНО (миграция 71): test_answers.school_id NOT NULL DEFAULT
//     current_school_id(). Под service-role auth.uid() нет → дефолт молча
//     стал бы NULL и вставка бы упала. Поэтому school_id задаётся ЯВНО из
//     самой test_submission (у всех 150 он уже проставлен).
//
// ЗАПУСК (PowerShell, из apps/web):
//   node scripts/backfill-test-answers.mjs                      — dry-run
//   $env:CONFIRM="YES"; node scripts/backfill-test-answers.mjs  — реально
// ЗАПУСК (bash, из apps/web):
//   node scripts/backfill-test-answers.mjs                      — dry-run
//   CONFIRM=YES node scripts/backfill-test-answers.mjs          — реально

import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const CONFIRMED = process.env.CONFIRM === "YES" || process.argv.includes("--confirm");

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const db = makeServiceRoleClient();
  console.log(`Режим: ${CONFIRMED ? "РЕАЛЬНАЯ ЗАПИСЬ (CONFIRM=YES)" : "DRY-RUN (ничего не пишется)"}\n`);

  // 1. Все сдачи тестов.
  const { data: subs, error: subErr } = await db
    .from("test_submissions")
    .select("id, homework_id, student_id, score, max_score, started_at, submitted_at, school_id");
  if (subErr) fail(`Ошибка запроса test_submissions: ${subErr.message}`);
  console.log(`test_submissions всего: ${subs.length}`);

  // 2. Какие сдачи уже имеют ответы — пропускаем (идемпотентность).
  const { data: existingAns, error: exErr } = await db.from("test_answers").select("submission_id");
  if (exErr) fail(`Ошибка запроса test_answers: ${exErr.message}`);
  const haveAnswers = new Set((existingAns ?? []).map((r) => r.submission_id));
  console.log(`test_answers сейчас: ${existingAns?.length ?? 0} (сдач с ответами: ${haveAnswers.size})`);

  // 3. Вопросы+варианты по всем заданиям (одним запросом, кешируем по homework_id).
  const hwIds = [...new Set(subs.map((s) => s.homework_id))];
  const { data: questions, error: qErr } = await db
    .from("test_questions")
    .select("id, homework_id, question_type, order_index, options:test_question_options(id, is_correct)")
    .in("homework_id", hwIds)
    .order("order_index");
  if (qErr) fail(`Ошибка запроса test_questions: ${qErr.message}`);
  const questionsByHw = new Map();
  for (const q of questions) {
    if (q.question_type !== "single_choice") continue; // текущие тесты только single_choice
    if (!questionsByHw.has(q.homework_id)) questionsByHw.set(q.homework_id, []);
    questionsByHw.get(q.homework_id).push(q);
  }

  let planAnswers = 0;
  let planStartedAt = 0;
  let planSubs = 0;
  let skipped = 0;
  const startedAtUpdates = []; // { id, started_at }
  const answerRows = [];       // test_answers rows

  for (const sub of subs) {
    if (haveAnswers.has(sub.id)) { skipped++; continue; }

    const qs = questionsByHw.get(sub.homework_id) ?? [];
    if (qs.length === 0) {
      console.warn(`  ⚠ у сдачи ${sub.id} (homework ${sub.homework_id}) нет single_choice-вопросов — пропуск`);
      skipped++;
      continue;
    }
    if (!sub.school_id) fail(`У test_submission ${sub.id} нет school_id — не могу задать его для test_answers.`);

    // started_at: если пусто — ставим = submitted_at (тест был пройден и сдан).
    if (!sub.started_at) {
      startedAtUpdates.push({ id: sub.id, started_at: sub.submitted_at });
      planStartedAt++;
    }

    // Ровно `score` вопросов — правильные, остальные — неверные.
    const score = Math.max(0, Math.min(sub.score ?? 0, qs.length));
    const order = shuffle(qs.map((_, i) => i));
    const correctIdx = new Set(order.slice(0, score));

    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const correctOpt = q.options.find((o) => o.is_correct);
      const wrongOpts = q.options.filter((o) => !o.is_correct);
      if (!correctOpt) { fail(`Вопрос ${q.id} без правильного варианта — не могу построить согласованный ответ.`); }

      let selectedId;
      let isCorrect;
      if (correctIdx.has(i)) {
        selectedId = correctOpt.id;
        isCorrect = true;
      } else if (wrongOpts.length > 0) {
        selectedId = wrongOpts[Math.floor(Math.random() * wrongOpts.length)].id;
        isCorrect = false;
      } else {
        // Вопрос без неверных вариантов (маловероятно) — оставляем правильный,
        // но помечаем неверным, чтобы сумма is_correct сошлась со score.
        selectedId = correctOpt.id;
        isCorrect = false;
      }

      answerRows.push({
        submission_id: sub.id,
        question_id: q.id,
        selected_option_id: selectedId,
        open_text: null,
        is_correct: isCorrect,
        school_id: sub.school_id,
      });
      planAnswers++;
    }
    planSubs++;
  }

  console.log(`\nПЛАН:`);
  console.log(`  Сдач к обработке: ${planSubs} (пропущено уже готовых/без вопросов: ${skipped})`);
  console.log(`  test_answers к вставке: ${planAnswers}`);
  console.log(`  started_at к проставлению: ${planStartedAt}`);

  if (!CONFIRMED) {
    console.log(`\n=== DRY-RUN ЗАВЕРШЁН — ничего не записано. Для записи: CONFIRM=YES ===`);
    return;
  }

  // 4. started_at — по одной строке (разные значения submitted_at).
  console.log(`\nПроставляю started_at…`);
  for (const u of startedAtUpdates) {
    const { error } = await db.from("test_submissions").update({ started_at: u.started_at }).eq("id", u.id);
    if (error) fail(`Ошибка update started_at (${u.id}): ${error.message}`);
  }
  console.log(`  started_at проставлен: ${startedAtUpdates.length}`);

  // 5. test_answers — батчами по 500.
  console.log(`Вставляю test_answers…`);
  let inserted = 0;
  for (let i = 0; i < answerRows.length; i += 500) {
    const batch = answerRows.slice(i, i + 500);
    const { error } = await db.from("test_answers").insert(batch);
    if (error) fail(`Ошибка вставки test_answers (батч ${i}): ${error.message}`);
    inserted += batch.length;
  }
  console.log(`  test_answers вставлено: ${inserted}`);

  // 6. Финальная проверка.
  const { count: finalCount } = await db.from("test_answers").select("*", { count: "exact", head: true });
  console.log(`\n=== ГОТОВО. test_answers в БД теперь: ${finalCount} ===`);
}

main().catch((e) => {
  console.error("Необработанная ошибка:", e?.message ?? e);
  process.exit(1);
});
