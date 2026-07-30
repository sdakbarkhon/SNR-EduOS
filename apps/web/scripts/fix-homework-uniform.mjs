#!/usr/bin/env node
// ФИКС ЭТАПА 7 — выравнивание всех 30 демо-учеников до показательного
// уровня aziz_03 (все сдачи 'graded', оценки 4-5, вовремя, положительные
// комментарии), т.к. демо-кнопка "Демо ученик" на /login (claim_demo_slot,
// p_grade_level=3/7/10) отдаёт СЛУЧАЙНОГО ученика ВНУТРИ выбранного класса
// — заказчик может кликнуть любую из 3 карточек класса и попасть на
// любого из 10 учеников этого класса.
//
// РАСХОЖДЕНИЯ С ПРОМТОМ (после проверки live-состояния перед записью):
//
//   1) "SELECT COUNT homework_submissions WHERE status='graded' = 896" —
//      не совпадает с реальностью. Всего homework_submissions = 279, и
//      ВСЕ 279 УЖЕ status='graded' (Этап 7 всегда писал status:'graded'
//      сразу при вставке — там просто нет других значений в этой
//      таблице). "Обновить status у НЕграженых" — нечего обновлять по
//      этому полю, 0 таких строк. Реальная проблема — не статус, а:
//      (а) 19 строк с оценкой 2/3 (заниженный балл — по замыслу Этапа 7
//      это была реалистичная вариация, теперь просят убрать), (б) часть
//      строк имеет submitted_at > due_date ("с опозданием" — тоже
//      намеренно из Этапа 7, теперь тоже убираем), (в) ГЛАВНОЕ — 43
//      (homework, ученик) пары вообще НЕ ИМЕЮТ строки (это и есть 5%
//      "not_submitted" из Этапа 7 — там это отсутствие строки, а не
//      status='not_submitted', такого значения в enum submission_status
//      нет). Их нужно НЕ обновлять, а ВСТАВЛЯТЬ.
//
//   2) Промт просил трогать только homework_submissions. Но 12 из 46 ДЗ —
//      content_type='test', их сдачи живут в ОТДЕЛЬНОЙ паре
//      test_submissions/test_answers (архитектурное решение Этапа 7,
//      см. resheniya_2.md — реальный student-facing TestPlayer.tsx читает
//      именно эти таблицы, не homework_submissions). Демо-кнопка может
//      с равной вероятностью привести заказчика на ЛЮБОЕ из 46 ДЗ, включая
//      тестовые — если оставить test_submissions как есть (там тоже есть
//      оценки 2/3 и propущенные), "любой случайный ученик выглядит
//      красиво" не выполнится для тестовых ДЗ. Поэтому test_submissions
//      выравнивается по той же логике (без учительского комментария —
//      колонки для него в этой таблице нет, см. resheniya_2.md Этап 7).
//
//   3) "рандом с seed=student_id" — буквально означало бы, что у одного
//      ученика ВСЕГДА одна и та же оценка на любом ДЗ (весь seed зависит
//      только от student_id, не от homework) — то есть один ученик был
//      бы либо ВЕЗДЕ 5, либо ВЕЗДЕ 4, без вариации. Для правдоподобного
//      журнала оценок это выглядело бы механически. Используется seed =
//      `${homeworkId}|${studentId}` — воспроизводимо при повторном
//      запуске (идемпотентно), но с естественной вариацией 80/20 по
//      каждому ДЗ отдельно, как и должно быть у реального ученика.
//
// ЛОГИКА (на каждую из 43 не-Wokwi ДЗ × 10 учеников её группы):
//   - Уже есть строка, оценка >=4, submitted_at <= due_date, (для
//     homework_submissions) status='graded' → УЖЕ ХОРОШО, не трогаем
//     (идемпотентно).
//   - Иначе — INSERT (если строки не было) или UPDATE (если была, но не
//     соответствовала критериям): grade = 5 (80%) или 4 (20%, seeded),
//     submitted_at — случайно между created_at и due_date (гарантированно
//     вовремя), graded_at = due_date + 1 час, status='graded' (только
//     homework_submissions), teacher_comment — случайный из пула ниже
//     (только homework_submissions). Для test_submissions — score/
//     test_answers тоже пересчитываются под новую оценку (иначе
//     score=8/12 с grade=5 выглядело бы нелогично на экране ученика).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fix-homework-uniform.mjs

import { makeServiceRoleClient, SCHOOL_ID, pick, randomInt, addMinutes, randomTimeBetween } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const TEACHER_COMMENTS = [
  "Хорошая работа! Продолжай в том же духе.",
  "Отличный результат. Так держать!",
  "Молодец! Всё верно, только оформление можно улучшить.",
  "Правильно решено. Обрати внимание на комментарии в коде.",
  "Хорошо справился с заданием.",
  "Отлично! Задача выполнена аккуратно.",
  "Прекрасная работа. Можно чуть-чуть оптимизировать.",
  "Молодец! Показал глубокое понимание темы.",
  "Правильно, только форматирование можно улучшить.",
  "Хорошая работа. Продолжай учиться.",
  "Отличный подход к решению!",
  "Молодец! Проверил все тестовые случаи.",
  "Хорошо, но постарайся быть внимательнее к деталям.",
  "Правильное решение, аккуратно оформлено.",
  "Отлично! Ты понял тему на 5+.",
];
const ANSWER_TEXTS = [
  "Выполнил все задания, могу объяснить на уроке.",
  "Решил все задачи, ответы приложены.",
  "Сделал упражнения, было интересно!",
  "Готово, самостоятельно проверил ответы.",
];
const GRADE_WEIGHTS = { 5: 0.8, 4: 0.2 };
const CORRECTNESS_BY_GRADE = { 5: 0.95, 4: 0.82 };

// ── seeded PRNG (xmur3+mulberry32) — тот же паттерн, что и в create-schedule-week.mjs ──
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(seedStr) { return mulberry32(xmur3(seedStr)())(); }
function seededWeightedPick(seedStr, weights) {
  const r = seededRng(seedStr);
  let acc = 0;
  for (const [key, w] of Object.entries(weights)) { acc += w; if (r <= acc) return key; }
  return Object.keys(weights)[Object.keys(weights).length - 1];
}
function seededPick(seedStr, list) { return list[Math.floor(seededRng(seedStr) * list.length)]; }

function isLate(submittedAt, dueDate) { return new Date(submittedAt) > new Date(dueDate); }

async function main() {
  console.log(`Выравнивание демо-учеников до показательного уровня — демо-школа (${SCHOOL_ID})\n`);

  const { data: homeworkAll, error: hwErr } = await db
    .from("homework")
    .select("id, content_type, group_id, due_date, created_at, starter_code, programming_language, subject:subjects(teacher_id)")
    .eq("school_id", SCHOOL_ID);
  if (hwErr) fail(`Ошибка запроса homework: ${hwErr.message}`);
  const homeworks = homeworkAll.filter((h) => h.content_type !== "wokwi");
  console.log(`Всего ДЗ: ${homeworkAll.length}. Не-Wokwi (участвуют в выравнивании): ${homeworks.length}.\n`);

  const { data: students, error: stErr } = await db
    .from("students").select("id, username, student_groups(group_id)")
    .eq("school_id", SCHOOL_ID);
  if (stErr) fail(`Ошибка запроса students: ${stErr.message}`);
  const studentsByGroupId = new Map();
  for (const s of students) {
    const gid = s.student_groups?.[0]?.group_id;
    if (!gid) continue;
    if (!studentsByGroupId.has(gid)) studentsByGroupId.set(gid, []);
    studentsByGroupId.get(gid).push({ id: s.id, username: s.username });
  }

  const now = new Date();
  let inserted = 0, updated = 0, alreadyGood = 0, errors = 0;

  for (const hw of homeworks) {
    const groupStudents = studentsByGroupId.get(hw.group_id) ?? [];
    const teacherId = hw.subject?.teacher_id ?? null;
    const isTest = hw.content_type === "test";
    const onTimeCap = new Date(Math.min(now.getTime(), new Date(hw.due_date).getTime())).toISOString();

    if (isTest) {
      const { data: questions, error: qErr } = await db.from("test_questions").select("id").eq("homework_id", hw.id);
      if (qErr) { console.error(`  !! ошибка test_questions для ${hw.id}: ${qErr.message}`); errors++; continue; }
      const { data: options, error: oErr } = await db.from("test_question_options").select("id, question_id, is_correct").in("question_id", questions.map((q) => q.id));
      if (oErr) { console.error(`  !! ошибка test_question_options для ${hw.id}: ${oErr.message}`); errors++; continue; }
      const optionsByQuestion = new Map();
      for (const o of options) { if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []); optionsByQuestion.get(o.question_id).push(o); }
      const questionIds = questions.map((q) => q.id);

      const { data: existingRows, error: exErr } = await db.from("test_submissions").select("id, student_id, grade, submitted_at").eq("homework_id", hw.id);
      if (exErr) { console.error(`  !! ошибка test_submissions для ${hw.id}: ${exErr.message}`); errors++; continue; }
      const existingByStudent = new Map(existingRows.map((r) => [r.student_id, r]));

      for (const student of groupStudents) {
        const existing = existingByStudent.get(student.id);
        const good = existing && Number(existing.grade) >= 4 && !isLate(existing.submitted_at, hw.due_date);
        if (good) { alreadyGood++; continue; }

        const seed = `${hw.id}|${student.id}`;
        const grade = Number(seededWeightedPick(seed, GRADE_WEIGHTS));
        const correctness = CORRECTNESS_BY_GRADE[grade];
        const submittedAt = randomTimeBetween(hw.created_at, onTimeCap);
        const gradedAt = addMinutes(hw.due_date, 60);

        let correctCount = 0;
        const answerRows = questionIds.map((qId, qi) => {
          const opts = optionsByQuestion.get(qId) ?? [];
          const correctOpt = opts.find((o) => o.is_correct);
          const isCorrectRoll = seededRng(`${seed}|q${qi}`) < correctness;
          const chosen = isCorrectRoll ? correctOpt : (seededPick(`${seed}|q${qi}|d`, opts.filter((o) => !o.is_correct)) ?? correctOpt);
          if (chosen?.is_correct) correctCount++;
          return { question_id: qId, school_id: SCHOOL_ID, selected_option_id: chosen?.id ?? null, is_correct: !!chosen?.is_correct };
        });

        let submissionId;
        if (existing) {
          const { error: upErr } = await db.from("test_submissions").update({
            submitted_at: submittedAt, score: correctCount, max_score: questionIds.length, grade,
            graded_at: gradedAt, graded_by: teacherId,
          }).eq("id", existing.id);
          if (upErr) { console.error(`  !! test_submissions update failed (${student.username}): ${upErr.message}`); errors++; continue; }
          submissionId = existing.id;
          const { error: delErr } = await db.from("test_answers").delete().eq("submission_id", submissionId);
          if (delErr) console.error(`  !! test_answers delete failed (${student.username}): ${delErr.message}`);
          updated++;
        } else {
          const { data: newSub, error: insErr } = await db.from("test_submissions").insert({
            homework_id: hw.id, student_id: student.id, school_id: SCHOOL_ID,
            submitted_at: submittedAt, started_at: addMinutes(submittedAt, -randomInt(5, 15)),
            score: correctCount, max_score: questionIds.length, grade,
            graded_at: gradedAt, graded_by: teacherId,
          }).select("id").single();
          if (insErr) { console.error(`  !! test_submissions insert failed (${student.username}): ${insErr.message}`); errors++; continue; }
          submissionId = newSub.id;
          inserted++;
        }
        const { error: ansErr } = await db.from("test_answers").insert(answerRows.map((a) => ({ ...a, submission_id: submissionId })));
        if (ansErr) console.error(`  !! test_answers insert failed (${student.username}): ${ansErr.message}`);
      }
      console.log(`  [test] homework_id=${hw.id.slice(0, 8)} — обработано.`);
    } else {
      const { data: existingRows, error: exErr } = await db.from("homework_submissions").select("id, student_id, grade, status, submitted_at").eq("homework_id", hw.id);
      if (exErr) { console.error(`  !! ошибка homework_submissions для ${hw.id}: ${exErr.message}`); errors++; continue; }
      const existingByStudent = new Map(existingRows.map((r) => [r.student_id, r]));

      for (const student of groupStudents) {
        const existing = existingByStudent.get(student.id);
        const good = existing && existing.status === "graded" && Number(existing.grade) >= 4 && !isLate(existing.submitted_at, hw.due_date);
        if (good) { alreadyGood++; continue; }

        const seed = `${hw.id}|${student.id}`;
        const grade = Number(seededWeightedPick(seed, GRADE_WEIGHTS));
        const submittedAt = randomTimeBetween(hw.created_at, onTimeCap);
        const gradedAt = addMinutes(hw.due_date, 60);
        const comment = seededPick(`${seed}|c`, TEACHER_COMMENTS);

        if (existing) {
          const { error: upErr } = await db.from("homework_submissions").update({
            status: "graded", grade, teacher_comment: comment, submitted_at: submittedAt, graded_at: gradedAt, graded_by: teacherId,
          }).eq("id", existing.id);
          if (upErr) { console.error(`  !! homework_submissions update failed (${student.username}): ${upErr.message}`); errors++; continue; }
          updated++;
        } else {
          const row = {
            homework_id: hw.id, student_id: student.id, school_id: SCHOOL_ID,
            submitted_at: submittedAt, status: "graded", grade, teacher_comment: comment,
            graded_at: gradedAt, graded_by: teacherId,
          };
          if (hw.content_type === "programming" && hw.starter_code) {
            const marker = hw.programming_language === "cpp" ? "// решение ученика (сдано)" : "# решение ученика (сдано)";
            row.code_text = `${hw.starter_code}\n\n${marker}`;
          } else {
            row.answer_text = seededPick(`${seed}|a`, ANSWER_TEXTS);
          }
          const { error: insErr } = await db.from("homework_submissions").insert(row);
          if (insErr) { console.error(`  !! homework_submissions insert failed (${student.username}): ${insErr.message}`); errors++; continue; }
          inserted++;
        }
      }
      console.log(`  [file/programming] homework_id=${hw.id.slice(0, 8)} — обработано.`);
    }
  }

  console.log(`\nГотово: вставлено ${inserted}, обновлено ${updated}, уже были хорошими (пропущено) ${alreadyGood}, ошибок ${errors}.`);

  // ── финальная проверка ──
  const { data: hsAll } = await db.from("homework_submissions").select("grade, status, submitted_at, homework:homework(due_date)").eq("school_id", SCHOOL_ID);
  const { data: tsAll } = await db.from("test_submissions").select("grade, submitted_at, homework:homework(due_date)").eq("school_id", SCHOOL_ID);
  const allGrades = [...hsAll.map((r) => Number(r.grade)), ...tsAll.map((r) => Number(r.grade))];
  const avgGrade = allGrades.reduce((a, b) => a + b, 0) / allGrades.length;
  const nonGraded = hsAll.filter((r) => r.status !== "graded").length;
  const lowGrades = allGrades.filter((g) => g < 4).length;
  const lateOnes = [...hsAll, ...tsAll].filter((r) => r.homework?.due_date && isLate(r.submitted_at, r.homework.due_date)).length;

  console.log(`\nПроверка: homework_submissions всего — ${hsAll.length} (все status='graded': ${nonGraded === 0 ? "ДА" : `НЕТ, ${nonGraded} не graded`}).`);
  console.log(`test_submissions всего — ${tsAll.length}.`);
  console.log(`Средняя оценка (обе таблицы вместе): ${avgGrade.toFixed(2)} (ожидание 4.7-4.9).`);
  console.log(`Оценок ниже 4: ${lowGrades} (ожидание 0). Сдач с опозданием: ${lateOnes} (ожидание 0).`);

  const nonWokwiHwIds = homeworks.map((h) => h.id);
  const totalStudentsAcrossGroups = homeworks.reduce((sum, h) => sum + (studentsByGroupId.get(h.group_id)?.length ?? 0), 0);
  console.log(`Ожидаемое общее число сдач (43 ДЗ × 10 учеников их группы): ${totalStudentsAcrossGroups}. Фактически: ${hsAll.length + tsAll.length}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
