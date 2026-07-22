// ОДНОРАЗОВЫЙ скрипт — восстанавливает посещаемость (attendance) и оценки за
// уроки (lesson_grades) за уже прошедшие дни, где данных нет. Причина пробела:
// побочные эффекты автозавершения уроков (посещаемость+оценки) раньше ставила
// fn_auto_end_lessons(), отключённая миграцией 143 (ручное управление уроками
// — осознанное решение, НЕ возвращать). Полуночный крон close-past-lessons
// теперь досоздаёт их за недавние дни автоматически; этот скрипт — разовый
// добор за исторический период.
//
// ЧТО ДЕЛАЕТ (для каждого прошедшего урока — ends_at < начало сегодня по
// Ташкенту — гейт ПО ВРЕМЕНИ, не по статусу; реф хотфикс 7.4.1):
//   - attendance для учеников группы урока, У КОГО ЕЩЁ НЕТ отметки на этот
//     урок: present≈90% / absent_unexcused≈8% / absent_excused≈2% (рандом).
//   - lesson_grades для ~35% ПРИСУТСТВОВАВШИХ учеников урока, у кого ещё нет
//     оценки за этот урок: 5≈30% / 4≈40% / 3≈25% / 2≈5%. Отсутствовавшим — нет.
//   - ИДЕМПОТЕНТНО для нормальных дней: (student,lesson) с уже существующей
//     отметкой/оценкой пропускаются, дублей нет (ON CONFLICT DO NOTHING).
//   - «МУСОРНЫЕ ДНИ» (за день есть отметки, но НИ ОДНОГО present — битые данные,
//     жалоба «все без причины отсутствовали») распознаются ПО ДАННЫМ (даты не
//     хардкодятся) и ПЕРЕЗАПИСЫВАЮТСЯ целиком по нормальному распределению
//     (ON CONFLICT DO UPDATE). Оценки на них ставятся по обновлённой посещаемости.
//   - Всё кодом, БЕЗ AI. school_id задаётся ЯВНО из students.school_id
//     (реф миграция 71 — под service-role DEFAULT current_school_id() → NULL).
//   - graded_by = учитель группы (groups.teacher_id); уроки без учителя —
//     оценки пропускаются (graded_by NOT NULL), посещаемость всё равно ставится.
//
// БЕЗОПАСНОСТЬ: dry-run по умолчанию (НИ ОДНОГО запроса на запись), реальная
// запись — только CONFIRM=YES. Ошибки не глотаются. Скрипт НЕ запускать —
// запустит менеджер.
//
// ЗАПУСК (PowerShell, из apps/web):
//   node scripts/backfill-attendance-grades.mjs                     — dry-run
//   $env:CONFIRM="YES"; node scripts/backfill-attendance-grades.mjs — реально
// ЗАПУСК (bash, из apps/web):
//   node scripts/backfill-attendance-grades.mjs                     — dry-run
//   CONFIRM=YES node scripts/backfill-attendance-grades.mjs         — реально

import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const CONFIRMED = process.env.CONFIRM === "YES" || process.argv.includes("--confirm");
const TZ_MS = 5 * 60 * 60 * 1000;
const dayKey = (iso) => new Date(new Date(iso).getTime() + TZ_MS).toISOString().slice(0, 10);

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }
function pickAttStatus(r) { if (r < 0.9) return "present"; if (r < 0.98) return "absent_unexcused"; return "absent_excused"; }
function pickGrade(r) { if (r < 0.3) return 5; if (r < 0.7) return 4; if (r < 0.95) return 3; return 2; }

async function main() {
  const db = makeServiceRoleClient();
  console.log(`Режим: ${CONFIRMED ? "РЕАЛЬНАЯ ЗАПИСЬ (CONFIRM=YES)" : "DRY-RUN (ничего не пишется)"}\n`);

  // Начало сегодняшнего дня по Ташкенту (гейт по времени).
  const nowUtc = new Date();
  const tNow = new Date(nowUtc.getTime() + TZ_MS);
  const cutoff = new Date(Date.UTC(tNow.getUTCFullYear(), tNow.getUTCMonth(), tNow.getUTCDate()) - TZ_MS).toISOString();

  const { data: pastLessons, error: plErr } = await db
    .from("lessons").select("id, group_id, starts_at, ends_at").lt("ends_at", cutoff).order("starts_at");
  if (plErr) fail(`lessons: ${plErr.message}`);
  console.log(`Прошедших уроков (ends_at < ${cutoff}): ${pastLessons.length}`);
  if (pastLessons.length === 0) { console.log("Нечего заполнять."); return; }

  const lessonIds = pastLessons.map((l) => l.id);
  const groupIds = [...new Set(pastLessons.map((l) => l.group_id))];

  const { data: sgRows, error: sgErr } = await db.from("student_groups").select("group_id, student_id").in("group_id", groupIds);
  if (sgErr) fail(`student_groups: ${sgErr.message}`);
  const studentIds = [...new Set(sgRows.map((r) => r.student_id))];
  const { data: studentRows, error: stErr } = await db.from("students").select("id, school_id").in("id", studentIds);
  if (stErr) fail(`students: ${stErr.message}`);
  const schoolByStudent = new Map(studentRows.map((s) => [s.id, s.school_id]));
  const studentsByGroup = new Map();
  for (const r of sgRows) { if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []); studentsByGroup.get(r.group_id).push(r.student_id); }

  const { data: groupRows, error: gErr } = await db.from("groups").select("id, teacher_id").in("id", groupIds);
  if (gErr) fail(`groups: ${gErr.message}`);
  const teacherByGroup = new Map(groupRows.map((g) => [g.id, g.teacher_id]));

  // Существующие attendance/оценки (чанками — lessonIds может быть длинным).
  const attByLesson = new Map(); // lesson -> Map(student -> status)
  const lgByLesson = new Map();  // lesson -> Set(student)
  for (let i = 0; i < lessonIds.length; i += 200) {
    const chunk = lessonIds.slice(i, i + 200);
    const { data: aRows, error: aErr } = await db.from("attendance").select("lesson_id, student_id, status").in("lesson_id", chunk);
    if (aErr) fail(`attendance read: ${aErr.message}`);
    for (const r of aRows) { if (!attByLesson.has(r.lesson_id)) attByLesson.set(r.lesson_id, new Map()); attByLesson.get(r.lesson_id).set(r.student_id, r.status); }
    const { data: lRows, error: lErr } = await db.from("lesson_grades").select("lesson_id, student_id").in("lesson_id", chunk);
    if (lErr) fail(`lesson_grades read: ${lErr.message}`);
    for (const r of lRows) { if (!lgByLesson.has(r.lesson_id)) lgByLesson.set(r.lesson_id, new Set()); lgByLesson.get(r.lesson_id).add(r.student_id); }
  }

  // ─── Findings: с какой даты пропала посещаемость (present массово = 0) ───
  const byDay = {};
  for (const l of pastLessons) {
    const k = dayKey(l.starts_at);
    byDay[k] ??= { lessons: 0, expected: 0, existRows: 0, presentRows: 0 };
    byDay[k].lessons++;
    byDay[k].expected += (studentsByGroup.get(l.group_id)?.length ?? 0);
    const ex = attByLesson.get(l.id);
    if (ex) { byDay[k].existRows += ex.size; for (const st of ex.values()) if (st === "present") byDay[k].presentRows++; }
  }
  const daysSorted = Object.keys(byDay).sort();
  const firstNoPresent = daysSorted.find((k) => byDay[k].lessons > 0 && byDay[k].presentRows === 0) ?? null;

  // «МУСОРНЫЙ ДЕНЬ» — за день есть отметки посещаемости, но НИ ОДНОГО present
  // (existRows > 0 && presentRows === 0). Это битые данные (жалоба менеджера
  // «все без причины отсутствовали»). Критерий вычисляется ПО ДАННЫМ, даты не
  // хардкодятся. Для таких дней существующие отметки ПЕРЕЗАПИСЫВАЮТСЯ по
  // нормальному распределению (present≈90/8/2). Дни с existRows === 0 (совсем
  // нет отметок) — НЕ мусорные, заполняются обычным gap-fill'ом. Дни с
  // present > 0 (реальная посещаемость) — только дополняются, не трогаем.
  const garbageDays = new Set(daysSorted.filter((k) => byDay[k].existRows > 0 && byDay[k].presentRows === 0));

  console.log(`\n=== FINDINGS: покрытие посещаемости по дням (последние 18) ===`);
  for (const k of daysSorted.slice(-18)) {
    const s = byDay[k];
    const tag = garbageDays.has(k) ? " ← МУСОР (перезапишем)" : s.existRows === 0 ? " ← пусто (заполним)" : "";
    console.log(`  ${k}: уроков ${s.lessons}, ожидается отметок ${s.expected}, есть ${s.existRows} (present ${s.presentRows})${tag}`);
  }
  console.log(`\nПервый день, где present-отметок 0 (пробел начинается тут): ${firstNoPresent ?? "нет — present есть везде"}`);
  console.log(`Мусорных дней (есть отметки, но present=0): ${garbageDays.size}${garbageDays.size ? " → " + [...garbageDays].sort().join(", ") : ""}`);

  // ─── План заполнения ───
  // attGapRows      — обычные/пустые дни: дополняем недостающие (student,lesson), идемпотентно.
  // attOverwriteRows — мусорные дни: пересоздаём отметки ВСЕХ учеников по нормальному
  //                    распределению (upsert с обновлением на конфликте → перезапись absent→present).
  const attGapRows = [];
  const attOverwriteRows = [];
  const gradeRows = [];
  let skippedNoTeacher = 0, skippedNoSchool = 0;
  for (const lesson of pastLessons) {
    const isGarbage = garbageDays.has(dayKey(lesson.starts_at));
    const students = studentsByGroup.get(lesson.group_id) ?? [];
    const existing = attByLesson.get(lesson.id) ?? new Map();
    const presentStudents = [];

    if (isGarbage) {
      // Перезапись: всем ученикам группы — свежая отметка по нормальному распределению.
      for (const sid of students) {
        const school = schoolByStudent.get(sid);
        if (!school) { skippedNoSchool++; continue; }
        const status = pickAttStatus(Math.random());
        attOverwriteRows.push({ lesson_id: lesson.id, student_id: sid, status, school_id: school });
        if (status === "present") presentStudents.push(sid);
      }
    } else {
      // Обычный gap-fill: существующие отметки не трогаем, добавляем недостающие.
      for (const [sid, status] of existing) if (status === "present") presentStudents.push(sid);
      for (const sid of students) {
        if (existing.has(sid)) continue;
        const school = schoolByStudent.get(sid);
        if (!school) { skippedNoSchool++; continue; }
        const status = pickAttStatus(Math.random());
        attGapRows.push({ lesson_id: lesson.id, student_id: sid, status, school_id: school });
        if (status === "present") presentStudents.push(sid);
      }
    }

    // Оценки — по обновлённой посещаемости (present-набор пересчитан выше),
    // ~35% присутствовавших без уже существующей оценки за этот урок.
    const teacherId = teacherByGroup.get(lesson.group_id);
    if (!teacherId) { skippedNoTeacher++; continue; }
    const alreadyGraded = lgByLesson.get(lesson.id) ?? new Set();
    for (const sid of presentStudents) {
      if (alreadyGraded.has(sid)) continue;
      if (Math.random() >= 0.35) continue;
      const school = schoolByStudent.get(sid);
      if (!school) continue;
      gradeRows.push({ lesson_id: lesson.id, student_id: sid, grade: pickGrade(Math.random()), graded_by: teacherId, school_id: school });
    }
  }

  console.log(`\n=== ПЛАН ===`);
  console.log(`  attendance ПЕРЕЗАПИСАТЬ (мусорные дни): ${attOverwriteRows.length}`);
  console.log(`  attendance ДОБАВИТЬ обычным путём (пустые/частичные дни): ${attGapRows.length}`);
  console.log(`  lesson_grades к созданию (вкл. мусорные дни): ${gradeRows.length}`);
  console.log(`  уроков без учителя (оценки пропущены): ${skippedNoTeacher}; без school_id ученика: ${skippedNoSchool}`);

  if (!CONFIRMED) {
    console.log(`\n=== DRY-RUN ЗАВЕРШЁН — ничего не записано. Для записи: CONFIRM=YES ===`);
    return;
  }

  // Обычные/пустые дни — идемпотентно (ON CONFLICT DO NOTHING).
  console.log(`\nДобавляю attendance (обычным путём)…`);
  let attAdded = 0;
  for (let i = 0; i < attGapRows.length; i += 500) {
    const batch = attGapRows.slice(i, i + 500);
    const { error } = await db.from("attendance").upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: true });
    if (error) fail(`attendance gap insert (батч ${i}): ${error.message}`);
    attAdded += batch.length;
  }
  console.log(`  добавлено: ${attAdded}`);

  // Мусорные дни — ПЕРЕЗАПИСЬ (ON CONFLICT DO UPDATE: existing absent → нормальное распределение).
  console.log(`Перезаписываю attendance (мусорные дни)…`);
  let attOverwritten = 0;
  for (let i = 0; i < attOverwriteRows.length; i += 500) {
    const batch = attOverwriteRows.slice(i, i + 500);
    const { error } = await db.from("attendance").upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: false });
    if (error) fail(`attendance overwrite (батч ${i}): ${error.message}`);
    attOverwritten += batch.length;
  }
  console.log(`  перезаписано: ${attOverwritten}`);
  console.log(`Вставляю lesson_grades…`);
  let lg = 0;
  for (let i = 0; i < gradeRows.length; i += 500) {
    const batch = gradeRows.slice(i, i + 500);
    const { error } = await db.from("lesson_grades").upsert(batch, { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
    if (error) fail(`lesson_grades insert (батч ${i}): ${error.message}`);
    lg += batch.length;
  }
  console.log(`  lesson_grades вставлено: ${lg}`);

  const { count: attTotal } = await db.from("attendance").select("*", { count: "exact", head: true });
  const { count: lgTotal } = await db.from("lesson_grades").select("*", { count: "exact", head: true });
  console.log(`\n=== ГОТОВО. attendance в БД: ${attTotal}, lesson_grades: ${lgTotal} ===`);
}

main().catch((e) => { console.error("Необработанная ошибка:", e?.message ?? e); process.exit(1); });
