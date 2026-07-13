#!/usr/bin/env node
// Промт 7.3 Часть 3 (гейт исправлен хотфиксом после Промта 7.4) — сдача и
// проверка домашних заданий.
//
// homework.lesson_id is NULL for all current rows (confirmed live) — ДЗ
// не привязаны к уроку напрямую, только через group_id/due_date/created_at.
// Все текущие ДЗ созданы в прошлом, но due_date может быть далеко в
// будущем (до конца августа) — этот скрипт никогда не был датно-гейтирован
// (обрабатывает всё ДЗ безусловно), из-за чего randomTimeBetween(created_at,
// due_date)/randomTimeBetween(due_date, due_date+3) мог выдать submitted_at/
// graded_at ПОСЛЕ реального "сейчас" — баг, найденный после Промта 7.4.
// Исправление: окно сдачи капается на now(); если окно ещё не наступило
// (due_date/created_at в будущем) — сдачи для этого ДЗ на этот прогон не
// генерируются (не "пропустил", а "ещё рано").
//
// Двухшаговое обновление при проверке ДЗ: триггер set_grading_meta()
// (BEFORE UPDATE) сам ставит graded_at:=now() и graded_by:=current_teacher_id()
// при первом появлении grade — но current_teacher_id() резолвится через
// auth.uid(), которого под service-role нет (NULL), так что graded_by
// затирается в NULL. Шаг 2 — отдельный UPDATE, не трогающий grade/status,
// поэтому триггер на нём не срабатывает и наши явные graded_by/graded_at
// (нужен строго submitted_at+1-48ч, а не "сейчас") остаются как заданы.
import {
  makeServiceRoleClient, SCHOOL_ID, REAL_STUDENT_USERNAMES, HOMEWORK_PROFILES, DEMO_HOMEWORK_PROFILE,
  GRADE_PROFILES, DEMO_GRADE_PROFILE, weightedPick, randomInt, randomTimeBetween, addMinutes,
  HOMEWORK_SUBMISSION_TEXTS, HOMEWORK_TEACHER_COMMENTS, maybeComment, pick,
} from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

function addDaysIso(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

async function runConcurrent(items, limit, worker) {
  let idx = 0;
  const results = [];
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function main() {
  const { data: homeworks, error: hwErr } = await db
    .from("homework")
    .select("id, group_id, teacher_id, due_date, created_at")
    .order("created_at", { ascending: true });
  if (hwErr) throw hwErr;
  console.log(`Всего ДЗ: ${homeworks.length}`);

  const groupIds = [...new Set(homeworks.map((h) => h.group_id))];
  const { data: sgRows } = await db.from("student_groups").select("student_id, group_id").in("group_id", groupIds);
  const { data: students } = await db.from("students").select("id, username").in("id", (sgRows ?? []).map((r) => r.student_id));
  const usernameByStudent = new Map((students ?? []).map((s) => [s.id, s.username]));
  const studentsByGroup = new Map();
  for (const r of sgRows ?? []) {
    const arr = studentsByGroup.get(r.group_id) ?? [];
    arr.push(r.student_id);
    studentsByGroup.set(r.group_id, arr);
  }

  // ── Часть А: вставка submissions (сдал / не сдал по профилю) ──
  const nowMs = Date.now();
  const submissionRows = [];
  let skippedNotDueYet = 0;
  for (const hw of homeworks) {
    const dueDate = hw.due_date ?? addDaysIso(hw.created_at, 7);
    const studentIds = studentsByGroup.get(hw.group_id) ?? [];
    for (const studentId of studentIds) {
      const username = usernameByStudent.get(studentId);
      const profile = REAL_STUDENT_USERNAMES.includes(username) ? HOMEWORK_PROFILES[username] : DEMO_HOMEWORK_PROFILE;
      const outcome = weightedPick({ onTime: profile.onTime, late: profile.late, missed: profile.missed });
      if (outcome === "missed") continue;

      const windowStart = outcome === "onTime" ? hw.created_at : dueDate;
      const windowEnd = outcome === "onTime" ? dueDate : addDaysIso(dueDate, 3);
      if (new Date(windowStart).getTime() > nowMs) {
        skippedNotDueYet++; // окно сдачи ещё не наступило — рано генерировать
        continue;
      }
      const cappedEnd = new Date(windowEnd).getTime() < nowMs ? windowEnd : new Date(nowMs).toISOString();
      const submittedAt = randomTimeBetween(windowStart, cappedEnd);

      submissionRows.push({
        homework_id: hw.id,
        student_id: studentId,
        answer_text: pick(HOMEWORK_SUBMISSION_TEXTS),
        file_url: null,
        status: "submitted",
        submitted_at: submittedAt,
        school_id: SCHOOL_ID,
        is_demo: !REAL_STUDENT_USERNAMES.includes(username),
        _teacherId: hw.teacher_id,
        _username: username,
      });
    }
  }
  console.log(`Кандидатов на сдачу (submission): ${submissionRows.length} (пропущено, окно ещё не наступило: ${skippedNotDueYet})`);

  const CHUNK = 500;
  let submittedCount = 0;
  const insertedIds = [];
  for (let i = 0; i < submissionRows.length; i += CHUNK) {
    const chunk = submissionRows.slice(i, i + CHUNK).map(({ _teacherId, _username, ...row }) => row);
    const { data, error } = await db
      .from("homework_submissions")
      .upsert(chunk, { onConflict: "homework_id,student_id", ignoreDuplicates: true })
      .select("id, homework_id, student_id");
    if (error) { console.error(`Чанк сдачи ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    submittedCount += data?.length ?? 0;
    insertedIds.push(...(data ?? []));
    console.log(`  чанк сдачи ${i}-${i + chunk.length}: +${data?.length ?? 0}`);
  }
  console.log(`ИТОГО новых homework_submissions вставлено: ${submittedCount}`);

  // ── Часть Б: проверка 90% сданных (только те, что реально вставились сейчас) ──
  const teacherByPair = new Map(submissionRows.map((r) => [`${r.homework_id}:${r.student_id}`, { teacherId: r._teacherId, username: r._username }]));
  const toGrade = insertedIds.filter(() => Math.random() < 0.90);
  console.log(`К проверке (90% от новых сдач): ${toGrade.length}`);

  let gradedCount = 0;
  await runConcurrent(toGrade, 15, async (row) => {
    const meta = teacherByPair.get(`${row.homework_id}:${row.student_id}`);
    if (!meta?.teacherId) return; // ДЗ без teacher_id — некому проверить, пропускаем честно
    const profile = REAL_STUDENT_USERNAMES.includes(meta.username) ? GRADE_PROFILES[meta.username] : DEMO_GRADE_PROFILE;
    const grade = Number(weightedPick(profile));
    const comment = maybeComment(HOMEWORK_TEACHER_COMMENTS, 0.3) || null;

    const { data: subRow } = await db.from("homework_submissions").select("submitted_at").eq("id", row.id).single();
    if (!subRow) return;
    const proposedGradedAt = addMinutes(subRow.submitted_at, randomInt(60, 48 * 60));
    // Проверка не может случиться в будущем — капаем на "сейчас".
    const gradedAt = new Date(proposedGradedAt).getTime() > Date.now() ? new Date().toISOString() : proposedGradedAt;

    // Шаг 1: триггер стамплит graded_at:=now(), graded_by:=NULL (ожидаемо).
    const { error: e1 } = await db.from("homework_submissions")
      .update({ grade, status: "graded", teacher_comment: comment })
      .eq("id", row.id);
    if (e1) { console.error(`  grade step1 failed for ${row.id}: ${e1.message}`); return; }

    // Шаг 2: не трогает grade/status → триггер не срабатывает → наши значения остаются.
    const { error: e2 } = await db.from("homework_submissions")
      .update({ graded_by: meta.teacherId, graded_at: gradedAt })
      .eq("id", row.id);
    if (e2) { console.error(`  grade step2 failed for ${row.id}: ${e2.message}`); return; }

    gradedCount++;
  });

  console.log(`ИТОГО проверено (grade+graded_by+graded_at выставлены): ${gradedCount}`);

  const { count: subAfter } = await db.from("homework_submissions").select("id", { count: "exact", head: true });
  const { count: gradedAfter } = await db.from("homework_submissions").select("id", { count: "exact", head: true }).eq("status", "graded");
  console.log(`homework_submissions всего: ${subAfter}, из них проверено: ${gradedAfter}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
