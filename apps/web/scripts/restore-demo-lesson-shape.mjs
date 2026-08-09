#!/usr/bin/env node
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 5: форма уроков демо-школы.
//
// Повторяет фазы из app/api/cron/_lib/restore-demo-shape.ts БЕЗ удаления:
// сам механизм ночного отката запускать нельзя, пока восстановление не
// закончено и снимок не переснят, а форму навести надо сейчас — после
// создания 49 уроков позиции внутри дня сдвинулись.
//
// ЦЕЛЬ:
//   27-28.07           — completed  (started_at = начало, ended_at = конец)
//   29.07, слот 1      — completed
//   29.07, слот 2      — in_progress (started_at = начало, ended_at пуст)
//   29.07, слоты 3-6   — scheduled  (обе метки пусты)
//   30.07-02.08        — scheduled
// Номер слота считается ВНУТРИ ГРУППЫ — это правило 1/2/3+.
//
// ПОРЯДОК ФАЗ ЖЁСТКИЙ, и это не стилистика. На lessons висит
// trg_close_other_in_progress_lessons (AFTER UPDATE OF status): переводя урок
// в in_progress, он ставит остальным in_progress-урокам ТОЙ ЖЕ ГРУППЫ
// status='completed' и ended_at = настоящий now() — то есть 09.08.2026, что
// сразу видно в интерфейсе как урок, законченный в будущем. Поэтому in_progress
// выставляется ПОСЛЕДНИМ: к этому моменту закрывать триггеру уже нечего.
//
// Идемпотентно: урок, уже стоящий в целевом состоянии, не трогается вовсе.
//
// ЗАПУСК (из apps/web):
//   node scripts/restore-demo-lesson-shape.mjs           # холостой прогон
//   node scripts/restore-demo-lesson-shape.mjs --apply   # запись

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const D = SCHOOL_ID;
const APPLY = process.argv.includes("--apply");

const WEEK_FROM = "2026-07-27T00:00:00+05:00";
const WEEK_TO = "2026-08-03T00:00:00+05:00";
const PAST_DAYS = ["2026-07-27", "2026-07-28"];
const FROZEN_DAY = "2026-07-29";
const FUTURE_DAYS = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };
const tashkentDay = (iso) => new Date(new Date(iso).getTime() + 5 * 3600e3).toISOString().slice(0, 10);

const targetFor = (status, l) => {
  if (status === "completed") return { status, started_at: l.starts_at, ended_at: l.ends_at };
  if (status === "in_progress") return { status, started_at: l.starts_at, ended_at: null };
  return { status: "scheduled", started_at: null, ended_at: null };
};
const needsChange = (l, t) =>
  l.status !== t.status || (l.started_at ?? null) !== (t.started_at ?? null) || (l.ended_at ?? null) !== (t.ended_at ?? null);

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

const { data: lessons, error } = await db
  .from("lessons").select("id, group_id, starts_at, ends_at, status, started_at, ended_at")
  .eq("school_id", D).gte("starts_at", WEEK_FROM).lt("starts_at", WEEK_TO).order("starts_at");
if (error) fail(`чтение уроков: ${error.message}`);
if (lessons.length !== 126) fail(`в неделе ${lessons.length} уроков вместо 126`);

const { data: groups } = await db.from("groups").select("id, name").eq("school_id", D);
const gName = new Map(groups.map((g) => [g.id, g.name.replace(" класс", "")]));

const onDay = (day) => lessons.filter((l) => tashkentDay(l.starts_at) === day);

const frozenByGroup = new Map();
for (const l of onDay(FROZEN_DAY)) {
  if (!frozenByGroup.has(l.group_id)) frozenByGroup.set(l.group_id, []);
  frozenByGroup.get(l.group_id).push(l);
}
for (const arr of frozenByGroup.values()) arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

for (const [gid, arr] of frozenByGroup) {
  if (arr.length !== 6) fail(`у группы ${gName.get(gid)} на 29.07 ${arr.length} уроков вместо 6 — форму считать не по чему`);
}

// ── план по фазам, в том же порядке, что применяется ────────────────────────
const plan = [];
for (const day of PAST_DAYS) for (const l of onDay(day)) plan.push({ l, t: targetFor("completed", l), phase: "прошедшие дни" });
for (const day of FUTURE_DAYS) for (const l of onDay(day)) plan.push({ l, t: targetFor("scheduled", l), phase: "будущие дни" });
for (const arr of frozenByGroup.values()) for (const l of arr.slice(2)) plan.push({ l, t: targetFor("scheduled", l), phase: "29.07 слоты 3+" });
for (const arr of frozenByGroup.values()) if (arr[0]) plan.push({ l: arr[0], t: targetFor("completed", arr[0]), phase: "29.07 слот 1" });
for (const arr of frozenByGroup.values()) if (arr[1]) plan.push({ l: arr[1], t: targetFor("in_progress", arr[1]), phase: "29.07 слот 2" });

if (plan.length !== 126) fail(`план покрывает ${plan.length} уроков вместо 126`);

const changing = plan.filter((p) => needsChange(p.l, p.t));
console.log("── ЧТО ИЗМЕНИТСЯ ──");
console.table(["прошедшие дни", "будущие дни", "29.07 слоты 3+", "29.07 слот 1", "29.07 слот 2"].map((ph) => ({
  фаза: ph,
  уроков: plan.filter((p) => p.phase === ph).length,
  меняется: changing.filter((p) => p.phase === ph).length,
})));

console.log("\n── 29.07 ПОСЛЕ ИЗМЕНЕНИЯ, ПО ГРУППАМ ──");
for (const [gid, arr] of frozenByGroup) {
  const line = arr.map((l, i) => {
    const t = i === 0 ? "completed" : i === 1 ? "in_progress" : "scheduled";
    const mark = l.status === t ? " " : "*";
    return `${l.starts_at.slice(11, 16) === "04:00" ? "09:00" : new Date(new Date(l.starts_at).getTime() + 5 * 3600e3).toISOString().slice(11, 16)}${mark}${t === "completed" ? "завершён" : t === "in_progress" ? "идёт" : "ждёт"}`;
  }).join("  ");
  console.log(`  ${gName.get(gid).padEnd(4)} ${line}`);
}
console.log("  (* — статус меняется)");

const after = { completed: 0, in_progress: 0, scheduled: 0 };
for (const p of plan) after[p.t.status]++;
console.log(`\nСтанет по школе: завершено ${after.completed}, идёт ${after.in_progress}, ждёт ${after.scheduled}`);
const frozen = plan.filter((p) => tashkentDay(p.l.starts_at) === FROZEN_DAY);
const fr = { completed: 0, in_progress: 0, scheduled: 0 };
for (const p of frozen) fr[p.t.status]++;
console.log(`Из них на 29.07: ${fr.completed} / ${fr.in_progress} / ${fr.scheduled} — правило требует 3 / 3 / 12`);
if (fr.completed !== 3 || fr.in_progress !== 3 || fr.scheduled !== 12) fail("форма замороженного дня не сходится с правилом 1/2/3+");

console.log(`\nУроков к изменению: ${changing.length} из 126`);
if (changing.length === 0) { console.log("Всё уже в нужной форме."); process.exit(0); }

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply применит форму.");
  process.exit(0);
}

// ── применение, строго по порядку фаз ───────────────────────────────────────
const byPhase = {};
let changed = 0;
for (const p of plan) {
  if (!needsChange(p.l, p.t)) continue;
  const { error: upErr } = await db.from("lessons")
    .update({ status: p.t.status, started_at: p.t.started_at, ended_at: p.t.ended_at }).eq("id", p.l.id);
  if (upErr) fail(`урок ${p.l.id} (${p.phase}): ${upErr.message}`);
  byPhase[p.phase] = (byPhase[p.phase] ?? 0) + 1;
  changed++;
}
console.log(`\nИзменено уроков: ${changed}`);
console.log("по фазам:", JSON.stringify(byPhase));

// ── проверка после записи ───────────────────────────────────────────────────
const { data: fresh, error: fErr } = await db
  .from("lessons").select("id, group_id, starts_at, ends_at, status, started_at, ended_at")
  .eq("school_id", D).gte("starts_at", WEEK_FROM).lt("starts_at", WEEK_TO).order("starts_at");
if (fErr) fail(`перечитывание: ${fErr.message}`);

const counts = { completed: 0, in_progress: 0, scheduled: 0 };
for (const l of fresh) counts[l.status] = (counts[l.status] ?? 0) + 1;
console.log("\nСтало по школе:", JSON.stringify(counts));

const frozenNow = fresh.filter((l) => tashkentDay(l.starts_at) === FROZEN_DAY);
const fc = { completed: 0, in_progress: 0, scheduled: 0 };
for (const l of frozenNow) fc[l.status] = (fc[l.status] ?? 0) + 1;
console.log(`На 29.07: завершено ${fc.completed}, идёт ${fc.in_progress}, ждёт ${fc.scheduled}`);

const wrong = [];
for (const l of fresh) {
  const day = tashkentDay(l.starts_at);
  let want;
  if (PAST_DAYS.includes(day)) want = "completed";
  else if (FUTURE_DAYS.includes(day)) want = "scheduled";
  else {
    const arr = frozenNow.filter((x) => x.group_id === l.group_id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const idx = arr.findIndex((x) => x.id === l.id);
    want = idx === 0 ? "completed" : idx === 1 ? "in_progress" : "scheduled";
  }
  const t = targetFor(want, l);
  if (needsChange(l, t)) wrong.push(`${day} ${gName.get(l.group_id)} — ${l.status}, ожидалось ${want}`);
}
if (wrong.length) { console.log("\nНЕ СОШЛОСЬ:"); for (const w of wrong.slice(0, 10)) console.log("   ", w); fail(`${wrong.length} уроков не в целевой форме`); }
if (fc.completed !== 3 || fc.in_progress !== 3 || fc.scheduled !== 12) fail("на 29.07 форма не 3/3/12");

console.log("\nГОТОВО. Форма сошлась, правило 1/2/3+ выполняется у всех трёх групп.");
