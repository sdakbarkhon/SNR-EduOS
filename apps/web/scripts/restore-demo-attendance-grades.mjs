#!/usr/bin/env node
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 4: посещаемость и оценки для уроков,
// созданных заново после аварии ночного отката.
//
// ОХВАТ — уроки 27, 28 и 29 июля. Не «завершённые по статусу», а именно эти
// три дня: живой запрос по уцелевшему эталону показал, что посещаемость и
// оценки там стоят у ВСЕХ 28 уроков, включая те, что по расписанию ещё не
// начались (13:45 29.07 при замороженном «сейчас» 10:15). Восстанавливаем
// как было, а не как логичнее — иначе журнал у половины дня опустеет.
// 30.07-02.08 не трогаем: в эталоне там пусто.
//
// РАСПРЕДЕЛЕНИЯ взяты из уцелевших записей и воспроизводятся КВОТАМИ, а не
// случайным броском — так доля гарантирована, а не «примерно такая»:
//   посещаемость: present 96.6%, absent_excused 3.1%, absent_unexcused 0.3%
//   оценки:       «2» 5.8%, «3» 26.1%, «4» 36.3%, «5» 31.9%
//   оценку получают 95.5% присутствовавших (отсутствующие — никогда)
//
// КОММЕНТАРИИ к оценкам берутся из уцелевших оценок той же величины (293 из
// 295 эталонных оценок с комментарием). Свои не сочиняем и ИИ не зовём:
// тон и длина тогда гарантированно совпадут с эталоном, а стоимость — ноль.
//
// ДЕТЕРМИНИРОВАННОСТЬ: кому какой статус и какая оценка достанется, решает
// хеш от (lesson_id + student_id), а не случайность. Поэтому холостой
// прогон показывает ровно то, что потом запишется, и повторный запуск даёт
// тот же результат.
//
// ЗАПУСК (из apps/web):
//   node scripts/restore-demo-attendance-grades.mjs           # холостой прогон
//   node scripts/restore-demo-attendance-grades.mjs --apply   # запись

import fs from "node:fs";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const D = SCHOOL_ID;
const APPLY = process.argv.includes("--apply");
const IDS_PATH = new URL("./.restored-lessons.json", import.meta.url);
const OUT_PATH = new URL("./.restored-attendance.json", import.meta.url);

const DAYS = ["2026-07-27", "2026-07-28", "2026-07-29"];
const ATT_SHARE = { present: 0.966, absent_excused: 0.031, absent_unexcused: 0.003 };
const GRADE_SHARE = { 2: 0.058, 3: 0.261, 4: 0.363, 5: 0.319 };
const GRADED_SHARE = 0.955;

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

/** Устойчивый хеш строки в [0,1). Нужен только для воспроизводимого
 *  перемешивания — криптостойкость тут не при чём. */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000000) / 1000000;
}

/** Раздаёт значения по точным квотам: сортируем по хешу и режем по долям. */
function allocate(items, shares) {
  const keys = Object.keys(shares);
  const sorted = [...items].sort((a, b) => hash01(a.key) - hash01(b.key));
  const out = new Map();
  let idx = 0;
  keys.forEach((k, i) => {
    const n = i === keys.length - 1 ? sorted.length - idx : Math.round(sorted.length * shares[k]);
    for (let j = 0; j < n && idx < sorted.length; j++, idx++) out.set(sorted[idx].key, k);
  });
  for (const it of sorted) if (!out.has(it.key)) out.set(it.key, keys[keys.length - 1]);
  return out;
}

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

const restoredIds = JSON.parse(fs.readFileSync(IDS_PATH, "utf8")).map((r) => r.id);
if (restoredIds.length !== 49) fail(`в списке восстановленных ${restoredIds.length} уроков вместо 49`);

const { data: lessons, error: lErr } = await db
  .from("lessons").select("id, topic, starts_at, ends_at, group_id, subject:subjects(name, teacher_id), group:groups(name)")
  .in("id", restoredIds).order("starts_at");
if (lErr) fail(`чтение уроков: ${lErr.message}`);

const inDays = lessons.filter((l) => DAYS.some((d) => l.starts_at.startsWith(d) || new Date(new Date(l.starts_at).getTime() + 5 * 3600e3).toISOString().startsWith(d)));
if (inDays.length === 0) fail("не нашлось ни одного урока за 27-29.07 среди восстановленных");

// ── ученики по группам ──────────────────────────────────────────────────────
const { data: links, error: sgErr } = await db
  .from("student_groups").select("student_id, group_id").eq("school_id", D);
if (sgErr) fail(`чтение состава групп: ${sgErr.message}`);
const studentsOf = {};
for (const r of links) (studentsOf[r.group_id] ??= []).push(r.student_id);

// ── уже существующее — не дублируем ─────────────────────────────────────────
const lessonIds = inDays.map((l) => l.id);
const { data: attExisting } = await db.from("attendance").select("lesson_id, student_id").in("lesson_id", lessonIds);
const { data: grExisting } = await db.from("lesson_grades").select("lesson_id, student_id").in("lesson_id", lessonIds);
const attHave = new Set((attExisting ?? []).map((r) => `${r.lesson_id}|${r.student_id}`));
const grHave = new Set((grExisting ?? []).map((r) => `${r.lesson_id}|${r.student_id}`));

// ── комментарии из уцелевших оценок ─────────────────────────────────────────
const { data: refGrades, error: rgErr } = await db
  .from("lesson_grades").select("grade, comment").eq("school_id", D).not("comment", "is", null).limit(1000);
if (rgErr) fail(`чтение эталонных комментариев: ${rgErr.message}`);
const commentsBy = {};
for (const g of refGrades) {
  if (!commentsBy[g.grade]) commentsBy[g.grade] = [];
  if (!commentsBy[g.grade].includes(g.comment)) commentsBy[g.grade].push(g.comment);
}
for (const v of [2, 3, 4, 5]) {
  if (!commentsBy[v]?.length) fail(`нет эталонных комментариев для оценки «${v}» — не из чего брать`);
}
console.log("Комментариев в эталоне по оценкам: " +
  [2, 3, 4, 5].map((v) => `«${v}» ${commentsBy[v].length}`).join(", "));

// ── раскладка ───────────────────────────────────────────────────────────────
const pairs = [];
for (const l of inDays) {
  for (const sid of studentsOf[l.group_id] ?? []) {
    pairs.push({ key: `${l.id}|${sid}`, lesson: l, student_id: sid });
  }
}
if (!pairs.length) fail("не нашлось учеников для этих уроков");

const attStatus = allocate(pairs, ATT_SHARE);
const present = pairs.filter((p) => attStatus.get(p.key) === "present");
// оценку получают не все присутствовавшие
const gradedSet = new Set(
  [...present].sort((a, b) => hash01("g" + a.key) - hash01("g" + b.key))
    .slice(0, Math.round(present.length * GRADED_SHARE)).map((p) => p.key),
);
const graded = present.filter((p) => gradedSet.has(p.key));
const gradeOf = allocate(graded, GRADE_SHARE);

const attRows = [], grRows = [];
for (const p of pairs) {
  if (!attHave.has(p.key)) {
    attRows.push({
      lesson_id: p.lesson.id, student_id: p.student_id, status: attStatus.get(p.key),
      marked_at: p.lesson.starts_at, marked_by: p.lesson.subject?.teacher_id ?? null,
      is_finalized: true, school_id: D,
    });
  }
  if (gradedSet.has(p.key) && !grHave.has(p.key)) {
    const value = Number(gradeOf.get(p.key));
    const pool = commentsBy[value];
    grRows.push({
      lesson_id: p.lesson.id, student_id: p.student_id, grade: value,
      comment: pool[Math.floor(hash01("c" + p.key) * pool.length)],
      graded_by: p.lesson.subject?.teacher_id ?? null,
      graded_at: p.lesson.ends_at, school_id: D,
    });
  }
}

if (attRows.some((r) => !r.marked_by) || grRows.some((r) => !r.graded_by)) {
  fail("у какого-то предмета не указан учитель — некому отметить");
}

// ── показ ───────────────────────────────────────────────────────────────────
console.log(`\nУроков в охвате (27-29.07): ${inDays.length} из 49 восстановленных`);
console.table(DAYS.map((d) => {
  const inDay = inDays.filter((l) => new Date(new Date(l.starts_at).getTime() + 5 * 3600e3).toISOString().startsWith(d));
  const ids = new Set(inDay.map((l) => l.id));
  return {
    день: d.slice(5), уроков: inDay.length,
    посещаемость: attRows.filter((r) => ids.has(r.lesson_id)).length,
    оценок: grRows.filter((r) => ids.has(r.lesson_id)).length,
  };
}));

const attDist = attRows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
const grDist = grRows.reduce((a, r) => ((a[r.grade] = (a[r.grade] ?? 0) + 1), a), {});
console.log("\nстатусы посещаемости:", JSON.stringify(attDist));
console.log("   в эталоне доли:", JSON.stringify(ATT_SHARE));
console.log("оценки:", JSON.stringify(grDist));
console.log(`   всего оценок ${grRows.length} на ${present.length} присутствовавших (${Math.round(100 * grRows.length / Math.max(1, present.length))}%)`);
console.log(`\nБудет создано: посещаемости ${attRows.length}, оценок ${grRows.length}`);
if (attRows.length === 0 && grRows.length === 0) { console.log("Нечего делать — всё уже есть."); process.exit(0); }

if (!APPLY) {
  console.log("\nПример трёх записей:");
  for (const r of grRows.slice(0, 3)) {
    const l = inDays.find((x) => x.id === r.lesson_id);
    console.log(`   ${l.group?.name?.replace(" класс", "")} · ${l.topic} → «${r.grade}» ${r.comment.slice(0, 60)}…`);
  }
  console.log("\nХолостой прогон. Запуск с --apply запишет их.");
  process.exit(0);
}

// ── запись ──────────────────────────────────────────────────────────────────
const written = { attendance: [], grades: [] };
for (let i = 0; i < attRows.length; i += 50) {
  const { data, error } = await db.from("attendance").insert(attRows.slice(i, i + 50)).select("id");
  if (error) { fs.writeFileSync(OUT_PATH, JSON.stringify(written, null, 1)); fail(`посещаемость, позиция ${i}: ${error.message}`); }
  written.attendance.push(...data);
}
for (let i = 0; i < grRows.length; i += 50) {
  const { data, error } = await db.from("lesson_grades").insert(grRows.slice(i, i + 50)).select("id");
  if (error) { fs.writeFileSync(OUT_PATH, JSON.stringify(written, null, 1)); fail(`оценки, позиция ${i}: ${error.message}`); }
  written.grades.push(...data);
}
fs.writeFileSync(OUT_PATH, JSON.stringify(written, null, 1));

const { count: attAfter } = await db.from("attendance").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds);
const { count: grAfter } = await db.from("lesson_grades").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds);
console.log(`\nСоздано: посещаемости ${written.attendance.length}, оценок ${written.grades.length}`);
console.log(`У этих уроков теперь: посещаемости ${attAfter}, оценок ${grAfter}`);
if (attAfter !== pairs.length) fail(`посещаемости ${attAfter}, ожидалось ${pairs.length} (по числу пар урок×ученик)`);
if (written.grades.length !== grRows.length) fail("записано оценок меньше, чем планировалось");
console.log("\nГОТОВО. Цифры сошлись.");
