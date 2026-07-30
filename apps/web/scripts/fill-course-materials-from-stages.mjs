#!/usr/bin/env node
// Восстановление презентаций уроков в "Материалах группы" — бэкфилл
// course_materials из уже существующих lesson_stages.
//
// РАЗВЕДКА (уточняющая) — механизм НЕ пропущен прошлой разведкой, он там
// уже был найден и описан: `addAiPresentationToGroupMaterials()` в
// packages/core/src/queries/index.ts:2776-2816, вызывается изнутри
// `addLessonStage()` (:2875-2881) сразу после вставки middle-этапа, если
// content_type='presentation' И slides непустой. Вставляет в
// course_materials строку БЕЗ файла: group_id, lesson_id, stage_id
// (FK → lesson_stages, добавлен именно под эту фичу миграцией
// 119_course_materials_stage_link.sql), title, type='presentation',
// subject, uploaded_by — сдача студенту через SlideViewer поверх
// lesson_stages.slides jsonb, а не через скачивание файла. Это ровно то,
// что описано в промте ("не PPTX-файл, а страница чтения").
//
// ПОЧЕМУ СЕЙЧАС ПУСТО (конкретная причина, не "разведка не нашла
// логику" — логика рабочая и ничего не отключено):
//   1) Этап 1 зачистки удалил все course_materials демо-школы.
//   2) ГЛАВНОЕ: все 756 lesson_stages текущей демо-недели созданы Этапами
//      4/5 через ПРЯМОЙ `db.from("lesson_stages").insert(...)` — в обход
//      `addLessonStage()`, а значит и в обход её побочного эффекта
//      `addAiPresentationToGroupMaterials`. Эта функция вызывается ТОЛЬКО
//      при создании этапа через настоящий путь приложения
//      (AiGenerateStagesModal → addLessonStage()) — для строк, вставленных
//      скриптом напрямую, она никогда не срабатывала. Дело не в
//      "отключено миграцией" — сам путь просто не был пройден.
//   Восстанавливать/чинить в коде приложения НЕЧЕГО — механизм рабочий
//   для новых уроков, создаваемых через реальный UI. Нужен только бэкфилл
//   для уже существующих данных.
//
// ОТКЛОНЕНИЕ ОТ БУКВАЛЬНОГО ЗЕРКАЛИРОВАНИЯ addAiPresentationToGroupMaterials:
//   Та функция дедуплицирует по (group_id, title, type='presentation') —
//   это работает в реальном приложении, где Gemini даёт каждой презентации
//   уникальное название. НО в этой демо-школе title этапов — фиксированные
//   шаблонные строки ("Изучение материала"/"Демонстрация учителя"/
//   "Практическая работа"/"Итог урока"), одинаковые для ВСЕХ 126 уроков
//   (проверено live-запросом: 466 presentation-этапов со слайдами, но
//   ВСЕГО 4 РАЗНЫХ title). Дедуп по title создал бы всего ~4 записи на
//   группу вместо 466 — students не смогли бы отличить материалы разных
//   уроков. Вместо этого: (а) title строки материала = "{тема урока} —
//   {заголовок этапа}" (различимо), (б) идемпотентность — по stage_id
//   (уникален по построению, есть отдельная FK-колонка именно под это).
//
// СКРИПТ: apps/web/scripts/fill-course-materials-from-stages.mjs
// Логика: SELECT lesson_stages(content_type='presentation', school_id=demo)
// с непустым slides → для каждого, если ещё нет course_materials с этим
// stage_id → INSERT. Идемпотентно, только INSERT.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fill-course-materials-from-stages.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

async function main() {
  console.log(`Бэкфилл course_materials из lesson_stages — демо-школа (${SCHOOL_ID})\n`);

  const { data: stages, error: sErr } = await db
    .from("lesson_stages")
    .select("id, title, slides, lesson:lessons!lesson_stages_lesson_id_fkey(id, group_id, topic, subject:subjects(name))")
    .eq("school_id", SCHOOL_ID)
    .eq("content_type", "presentation");
  if (sErr) fail(`Ошибка запроса lesson_stages: ${sErr.message}`);
  const withSlides = stages.filter((s) => Array.isArray(s.slides) && s.slides.length > 0 && s.lesson?.group_id);
  console.log(`presentation-этапов со слайдами: ${withSlides.length} (из ${stages.length} всего presentation-этапов).`);

  const { data: existing, error: exErr } = await db
    .from("course_materials")
    .select("stage_id")
    .eq("school_id", SCHOOL_ID)
    .not("stage_id", "is", null);
  if (exErr) fail(`Ошибка проверки существующих course_materials: ${exErr.message}`);
  const existingStageIds = new Set(existing.map((r) => r.stage_id));
  console.log(`Уже есть материал (по stage_id): ${existingStageIds.size}.\n`);

  const pending = withSlides.filter((s) => !existingStageIds.has(s.id));
  console.log(`К вставке: ${pending.length}.`);
  if (pending.length === 0) { console.log("Нечего делать."); return; }

  const rows = pending.map((s) => ({
    school_id: SCHOOL_ID,
    group_id: s.lesson.group_id,
    lesson_id: s.lesson.id,
    stage_id: s.id,
    title: s.lesson.topic ? `${s.lesson.topic} — ${s.title}` : s.title,
    type: "presentation",
    subject: s.lesson.subject?.name ?? null,
    uploaded_by: null,
  }));

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await db.from("course_materials").insert(chunk).select("id");
    if (error) { console.error(`  !! чанк ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    inserted += data?.length ?? 0;
    console.log(`  чанк ${i}-${i + chunk.length}: +${data?.length ?? 0}`);
  }
  console.log(`\nГотово: вставлено ${inserted} из ${rows.length}.`);

  const { count: totalCount } = await db.from("course_materials").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { data: byGroup } = await db.from("course_materials").select("group_id, group:groups(name)").eq("school_id", SCHOOL_ID);
  const groupCounts = {};
  for (const r of byGroup) {
    const name = r.group?.name ?? r.group_id;
    groupCounts[name] = (groupCounts[name] ?? 0) + 1;
  }
  console.log(`\nПроверка: course_materials для демо-школы всего — ${totalCount}.`);
  console.log(`По группам: ${JSON.stringify(groupCounts)}.`);

  const stageIdsNow = new Set((await db.from("course_materials").select("stage_id").eq("school_id", SCHOOL_ID).not("stage_id", "is", null)).data.map((r) => r.stage_id));
  const uncovered = withSlides.filter((s) => !stageIdsNow.has(s.id));
  console.log(`Presentation-этапов со слайдами БЕЗ материала: ${uncovered.length} (ожидание 0).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
