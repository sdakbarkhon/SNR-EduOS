#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 3 — расписание недели 27.07-02.08 демо-школы:
// 126 уроков (3 группы × 7 дней × 6 слотов), из тем 15 учебных планов
// (Этап 2). Запускается сразу (без --confirm) — INSERT в пустую после
// Этапа 1 таблицу lessons, не разрушительно.
//
// ВАЖНАЯ ПОПРАВКА К ПРОМТУ: у `lessons` НЕТ колонки `teacher_id` вообще
// (проверено по packages/core/src/database.types.ts + миграциям) —
// учитель урока всегда выводится на лету через subject_id → subjects.
// teacher_id (тот же паттерн, что во всех существующих lesson-скриптах
// этого репозитория, например regenerate-jul27-aug2.mjs). Ничего в
// lessons не пишем для учителя — это не пробел, это архитектура схемы.
//
// СХЕМА (supabase/migrations/20260614000003_lessons.sql +
// 20260617000024_lessons_module.sql + 116_curriculum_plans.sql +
// 20260618000026_lesson_status.sql + 20260620000036_auto_schedule.sql):
//   - status CHECK IN ('scheduled','in_progress','completed') — только эти
//     3 значения, 'in_progress' сюда никогда не пишем (по требованию —
//     это состояние живого урока, стартует учитель кнопкой).
//   - trg_compute_lesson_end (BEFORE INSERT/UPDATE) сам считает
//     ends_at = starts_at + duration_minutes*interval — ends_at не
//     передаём вообще, он будет молча перезаписан триггером в любом случае.
//   - curriculum_topic_id — nullable FK → curriculum_plan_topics(id)
//     ON DELETE SET NULL — заполняем реальным id темы из Этапа 2.
//   - topic/title — два отдельных nullable text-поля, оба существующие
//     скрипты заполняют одинаковым значением — делаем так же.
//   - school_id NOT NULL, DEFAULT current_school_id() НЕ резолвится под
//     service-role (auth.uid() = null) — передаём явно (SCHOOL_ID).
//   - Уникального constraint на lessons нет вообще — идемпотентность
//     через прикладную проверку (group_id + нормализованный ISO starts_at).
//
// ЛОГИКА РАСПРЕДЕЛЕНИЯ (по промту):
//   - Правило A (темы): день недели N (0=27.07 Пн ... 6=02.08 Вс) →
//     тема с order_index=N из плана этого предмета×группы. Если предмет
//     идёт в этот день дважды — ОБА урока получают одну и ту же тему
//     (specification: "лучше просто одинаковую тему", без "теория"/
//     "практика"-суффиксов).
//   - Правило B (порядок предметов): 5 предметов на 6 слотов — все 5 по
//     разу + 1 случайный предмет повторно. Порядок и повтор —
//     детерминированный псевдослучайный (seed = дата+группа, xmur3+
//     mulberry32) — воспроизводимо при повторном запуске с теми же входами.
//
// ИДЕМПОТЕНТНОСТЬ: перед вставкой каждого слота проверяем, есть ли уже
// урок (group_id, starts_at) в этом диапазоне недели — если есть,
// обновляем (subject_id/topic/title/curriculum_topic_id/status/room), а
// не дублируем. Повторный запуск безопасен.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-schedule-week.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];
const SUBJECT_NAMES = ["Программирование", "Робототехника", "Математика", "Английский язык", "Русский язык"];
const ROOM = "Кабинет 101";
const TZ = "+05:00";

// day index (0=Пн 27.07 ... 6=Вс 02.08) — соответствует order_index темы в плане.
const DAYS = [
  { date: "2026-07-27", dayIndex: 0 },
  { date: "2026-07-28", dayIndex: 1 },
  { date: "2026-07-29", dayIndex: 2 },
  { date: "2026-07-30", dayIndex: 3 },
  { date: "2026-07-31", dayIndex: 4 },
  { date: "2026-08-01", dayIndex: 5 },
  { date: "2026-08-02", dayIndex: 6 },
];

const SLOT_TIMES = [
  ["09:00", "09:45"],
  ["09:55", "10:40"],
  ["10:50", "11:35"],
  ["11:55", "12:40"],
  ["12:50", "13:35"],
  ["13:45", "14:30"],
];

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

// ── детерминированный PRNG (xmur3 seed hash + mulberry32) ──────────────────
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
function seededRng(seedStr) {
  return mulberry32(xmur3(seedStr)());
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const now = new Date();
  console.log(`Расписание недели 27.07–02.08 — демо-школа (${SCHOOL_ID})`);
  console.log(`Текущее время (для статусов): ${now.toISOString()}\n`);

  // ── Резолв groups/subjects/planы/темы ────────────────────────────────────
  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  for (const n of CLASS_NAMES) if (!groupByName.has(n)) fail(`Группа "${n}" не найдена.`);

  const { data: subjects, error: sErr } = await db
    .from("subjects")
    .select("id, name, group_id, teacher_id")
    .in("name", SUBJECT_NAMES)
    .in("group_id", groups.map((g) => g.id))
    .eq("is_active", true);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const subjectByGroupAndName = new Map(subjects.map((s) => [`${s.group_id}|${s.name}`, s]));
  for (const className of CLASS_NAMES) {
    const gid = groupByName.get(className).id;
    for (const subjName of SUBJECT_NAMES) {
      if (!subjectByGroupAndName.has(`${gid}|${subjName}`)) fail(`Не найден активный предмет "${subjName}" для "${className}".`);
    }
  }

  const { data: plans, error: pErr } = await db
    .from("curriculum_plans")
    .select("id, group_id, subject_id")
    .eq("school_id", SCHOOL_ID);
  if (pErr) fail(`Ошибка запроса curriculum_plans: ${pErr.message}`);
  if (plans.length !== 15) fail(`Ожидалось 15 curriculum_plans, найдено ${plans.length}. Запусти Этап 2 сначала.`);
  const planByGroupAndSubject = new Map(plans.map((p) => [`${p.group_id}|${p.subject_id}`, p.id]));

  const { data: topics, error: tErr } = await db
    .from("curriculum_plan_topics")
    .select("id, plan_id, order_index, title")
    .in("plan_id", plans.map((p) => p.id))
    .order("order_index");
  if (tErr) fail(`Ошибка запроса curriculum_plan_topics: ${tErr.message}`);
  const topicsByPlan = new Map();
  for (const t of topics) {
    if (!topicsByPlan.has(t.plan_id)) topicsByPlan.set(t.plan_id, []);
    topicsByPlan.get(t.plan_id).push(t);
  }
  for (const [planId, arr] of topicsByPlan) {
    if (arr.length !== 7) fail(`У плана ${planId} не 7 тем (${arr.length}).`);
  }

  function topicFor(groupId, subjectId, dayIndex) {
    const planId = planByGroupAndSubject.get(`${groupId}|${subjectId}`);
    if (!planId) fail(`Не найден план для group=${groupId} subject=${subjectId}.`);
    const arr = topicsByPlan.get(planId);
    return arr[dayIndex];
  }

  // ── Существующие уроки недели (идемпотентность) ──────────────────────────
  const WEEK_START = `2026-07-27T00:00:00${TZ}`;
  const WEEK_END_EXCL = `2026-08-03T00:00:00${TZ}`;
  const { data: existingLessons, error: exErr } = await db
    .from("lessons")
    .select("id, group_id, starts_at")
    .in("group_id", groups.map((g) => g.id))
    .gte("starts_at", WEEK_START)
    .lt("starts_at", WEEK_END_EXCL);
  if (exErr) fail(`Ошибка запроса existing lessons: ${exErr.message}`);
  const existingByKey = new Map(existingLessons.map((l) => [`${l.group_id}|${new Date(l.starts_at).toISOString()}`, l.id]));
  console.log(`Уже существующих уроков в диапазоне недели: ${existingLessons.length}\n`);

  // ── Построение 126 слотов ────────────────────────────────────────────────
  let created = 0, updated = 0, completedCount = 0, scheduledCount = 0;
  const sampleDay = []; // для отчёта — распределение одного дня одной группы

  for (const className of CLASS_NAMES) {
    const group = groupByName.get(className);
    for (const { date, dayIndex } of DAYS) {
      const rng = seededRng(`${date}|${className}`);
      const order = shuffle(SUBJECT_NAMES, rng); // 5 предметов, слоты 1-5
      const doubleIdx = Math.floor(rng() * 5);
      const slotSubjects = [...order, order[doubleIdx]]; // 6 слотов

      for (let slot = 0; slot < 6; slot++) {
        const subjectName = slotSubjects[slot];
        const subject = subjectByGroupAndName.get(`${group.id}|${subjectName}`);
        const topic = topicFor(group.id, subject.id, dayIndex);
        const [startTime] = SLOT_TIMES[slot];
        const startsAt = `${date}T${startTime}:00${TZ}`;

        const status = new Date(startsAt) <= now ? "completed" : "scheduled";
        if (status === "completed") completedCount++; else scheduledCount++;

        const row = {
          group_id: group.id,
          subject_id: subject.id,
          school_id: SCHOOL_ID,
          starts_at: startsAt,
          duration_minutes: 45,
          topic: topic.title,
          title: topic.title,
          curriculum_topic_id: topic.id,
          room: ROOM,
          status,
        };

        const key = `${group.id}|${new Date(startsAt).toISOString()}`;
        const existingId = existingByKey.get(key);
        if (existingId) {
          const { error: updErr } = await db.from("lessons").update(row).eq("id", existingId);
          if (updErr) fail(`Ошибка обновления урока (${className}, ${date}, слот ${slot + 1}): ${updErr.message}`);
          updated++;
        } else {
          const { error: insErr } = await db.from("lessons").insert(row);
          if (insErr) fail(`Ошибка создания урока (${className}, ${date}, слот ${slot + 1}): ${insErr.message}`);
          created++;
        }

        if (className === "7-А класс" && date === "2026-07-27") {
          sampleDay.push({ slot: slot + 1, time: SLOT_TIMES[slot][0], subject: subjectName, topic: topic.title, status });
        }
      }
    }
  }

  console.log(`Готово: создано ${created}, обновлено ${updated} уроков (итого ${created + updated}).`);
  console.log(`По статусам при построении: completed=${completedCount}, scheduled=${scheduledCount}\n`);

  console.log(`── Пример распределения (7-А класс, Пн 27.07) ──`);
  for (const s of sampleDay) console.log(`  ${s.slot}. ${s.time} — ${s.subject}: «${s.topic}» [${s.status}]`);

  const { count: total } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: completedTotal } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).eq("status", "completed");
  const { count: scheduledTotal } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).eq("status", "scheduled");
  const { count: inProgressTotal } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID).eq("status", "in_progress");
  console.log(`\nПроверка: lessons всего=${total} (ожидание 126), completed=${completedTotal}, scheduled=${scheduledTotal}, in_progress=${inProgressTotal} (ожидание 0).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
