#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 5 — шаблонные (без Gemini) этапы для оставшихся
// уроков демо-школы: 27.07 (пн), 31.07 (пт), 1-2.08 (сб-вс) — 72 урока.
// 28-30.07 (54 урока) уже полностью заполнены Этапом 4 (AI-контент) —
// пропускаются автоматически идемпотентностью, отдельный фильтр по датам
// не нужен: выбираем ВСЕ уроки школы, обрабатываем только те, у кого ещё
// нет middle-этапов (это и есть ровно 72, т.к. 54 уже с middle).
//
// СХЕМА (см. отчёт Этапа 4, resheniya_2.md): content_type (не kind),
// quiz_questions (stage_id FK, options — jsonb-массив прямо в строке, не
// test_questions/test_question_options — те для ДЗ), slides — jsonb-
// массив {layout, title, content} прямо на lesson_stages (не
// payload.slides — payload как отдельного jsonb-поля с таким именем в
// схеме нет; slide-текст хранится в поле "content", не "body"). У каждого
// урока уже есть "Старт"(position 0)/"Итог"(position 9999) от триггера
// fn_create_default_stages — не трогаем "Старт", "Итог" ОБНОВЛЯЕМ (не
// дублируем), как и в Этапе 4.
//
// БЕЗ --confirm (не разрушительно — только добавление к урокам без
// middle-этапов). Никакого Gemini — чистые INSERT/UPDATE, быстро.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/generate-template-stages-remaining.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const SUBJECT_NAMES = ["Программирование", "Робототехника", "Математика", "Английский язык", "Русский язык"];
const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

function buildTemplateStages({ topic, groupName, subjectName }) {
  const theorySlides = [
    { layout: "default", title: topic, content: `Учитель представит материал по теме «${topic}».` },
    { layout: "default", title: "Ключевые понятия", content: "Основные концепции будут разобраны на уроке." },
  ];
  const demoSlides = [
    { layout: "default", title: "Практический пример", content: "Учитель покажет пример на доске или экране." },
  ];
  const practiceSlides = [
    { layout: "default", title: "Задание", content: `Практическая работа по теме «${topic}». Учитель даст задание в ходе урока.` },
  ];
  const summarySlides = [
    { layout: "default", title: "Итог урока", content: `- Изучили тему «${topic}»\n- Практика в классе\n- Следующий урок продолжит эту тему` },
  ];

  // Q2/Q3 — правильный вариант первым, остальные варианты — РЕАЛЬНЫЕ другие
  // классы/предметы этой демо-школы (не выдуманные "История" и т.п. из
  // черновика промта — таких предметов в демо-школе нет, вопрос был бы
  // неверным).
  const otherClasses = CLASS_NAMES.filter((c) => c !== groupName);
  const otherSubjects = SUBJECT_NAMES.filter((s) => s !== subjectName);
  const questions = [
    { question_text: "Какая тема сегодняшнего урока?", options: [topic, "Другая тема", "Ещё тема", "Другое"], correct_option_index: 0 },
    { question_text: "В каком классе изучается эта тема?", options: [groupName, ...otherClasses], correct_option_index: 0 },
    { question_text: "К какому предмету относится эта тема?", options: [subjectName, ...otherSubjects.slice(0, 3)], correct_option_index: 0 },
  ];

  return {
    middle: [
      { position: 1, stage_role: "middle", stage_type: "theory", content_type: "presentation", title: "Изучение материала", slides: theorySlides, difficulty: "medium", duration_min: 15 },
      { position: 2, stage_role: "middle", stage_type: "theory", content_type: "presentation", title: "Демонстрация учителя", slides: demoSlides, difficulty: "medium", duration_min: 10 },
      { position: 3, stage_role: "middle", stage_type: "task", content_type: "presentation", title: "Практическая работа", slides: practiceSlides, difficulty: "medium", duration_min: 12 },
      { position: 4, stage_role: "middle", stage_type: "task", content_type: "quiz_qia", title: "Проверка знаний", config: { time_limit_minutes: null, points_per_question: 1 }, difficulty: "medium", duration_min: 8 },
    ],
    questions,
    summarySlides,
  };
}

async function main() {
  console.log(`Шаблонные этапы для оставшихся уроков — демо-школа (${SCHOOL_ID})\n`);

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, topic, starts_at, group:groups(name), subject:subjects(name)")
    .eq("school_id", SCHOOL_ID)
    .order("starts_at");
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Всего уроков демо-школы: ${lessons.length} (ожидание 126).`);

  const lessonIds = lessons.map((l) => l.id);
  const { data: middleRows, error: mErr } = await db
    .from("lesson_stages").select("lesson_id").in("lesson_id", lessonIds).eq("stage_role", "middle");
  if (mErr) fail(`Ошибка проверки существующих middle-этапов: ${mErr.message}`);
  const hasMiddle = new Set(middleRows.map((r) => r.lesson_id));
  const pending = lessons.filter((l) => !hasMiddle.has(l.id));
  console.log(`Уже с middle-этапами (28-30.07, Этап 4): ${hasMiddle.size}. Без middle-этапов (в этом заходе): ${pending.length} (ожидание 72).\n`);
  if (pending.length === 0) { console.log("Нечего делать."); return; }

  let done = 0, errors = 0;
  for (const [i, lesson] of pending.entries()) {
    const topic = lesson.topic ?? lesson.subject?.name ?? "Урок";
    const groupName = lesson.group?.name ?? "—";
    const subjectName = lesson.subject?.name ?? "—";
    const logPrefix = `  [${i + 1}/${pending.length}] ${groupName} · ${subjectName} · "${topic}"`;

    const { middle, questions, summarySlides } = buildTemplateStages({ topic, groupName, subjectName });

    let quizStageId = null, writeOk = true;
    for (const stage of middle) {
      const { data: inserted, error: insErr } = await db
        .from("lesson_stages").insert({ lesson_id: lesson.id, school_id: SCHOOL_ID, ...stage }).select("id, content_type").single();
      if (insErr) { console.error(`  !! stage insert failed (${stage.title}): ${insErr.message}`); writeOk = false; continue; }
      if (inserted.content_type === "quiz_qia") quizStageId = inserted.id;
    }
    if (quizStageId) {
      const rows = questions.map((q, qi) => ({
        stage_id: quizStageId, school_id: SCHOOL_ID, position: qi,
        question_text: q.question_text, options: q.options, correct_option_index: q.correct_option_index,
        points: 1, time_per_question_seconds: 20,
      }));
      const { error: qErr } = await db.from("quiz_questions").insert(rows);
      if (qErr) { console.error(`  !! quiz_questions insert failed: ${qErr.message}`); writeOk = false; }
    } else {
      console.error(`  !! no quiz stage id — questions not inserted`);
      writeOk = false;
    }

    const { error: sumErr } = await db
      .from("lesson_stages")
      .update({ title: "Итог урока", content_type: "presentation", stage_type: "theory", slides: summarySlides })
      .eq("lesson_id", lesson.id).eq("position", 9999);
    if (sumErr) { console.error(`  !! summary update failed: ${sumErr.message}`); writeOk = false; }

    console.log(`${logPrefix} → ${writeOk ? "OK" : "PARTIAL"}`);
    if (writeOk) done++; else errors++;
  }

  console.log(`\nГотово: обработано ${done}, ошибок ${errors}.`);

  const { count: stagesTotal } = await db.from("lesson_stages").select("*", { count: "exact", head: true }).in("lesson_id", lessonIds);
  const { data: quizStagesAll } = await db.from("lesson_stages").select("id").in("lesson_id", lessonIds).eq("content_type", "quiz_qia");
  const { count: questionsTotal } = await db.from("quiz_questions").select("*", { count: "exact", head: true }).in("stage_id", (quizStagesAll ?? []).map((s) => s.id));
  console.log(`Проверка: lesson_stages для демо-школы — ${stagesTotal} (ожидание 756 = 126×6).`);
  console.log(`Проверка: quiz_questions для демо-школы — ${questionsTotal} (ожидание 432 = 216 Этап4 + 72×3 шаблонов).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
