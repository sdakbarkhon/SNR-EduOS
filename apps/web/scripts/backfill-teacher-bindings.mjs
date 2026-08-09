#!/usr/bin/env node
// Z.2.5, 09.08.2026 — приводит поверхности привязки учителя к согласованному
// виду: заполняет `group_teachers` из объединения `subjects.teacher_id`
// (кто ведёт предмет) и `groups.teacher_id` (куратор).
//
// ЧТО ЭТО ЧИНИТ. `group_teachers` — предикат is_my_teacher_group(), то есть
// «какие группы учитель ВИДИТ». До Z.2.4 в неё не писал никто, поэтому
// учитель мог вести предмет и не видеть группу. Код теперь держит обе
// поверхности вместе; здесь выравниваются те строки, что накопились раньше.
//
// ЧАТ-ТРИГГЕР НЕ ПРОСЫПАЕТСЯ. trg_subject_teacher_direct_chats висит на
// `subjects` (AFTER INSERT OR UPDATE OF teacher_id). Скрипт `subjects` не
// трогает вовсе — только вставляет в `group_teachers`, а на ней триггеров
// нет ни одного (проверено запросом к information_schema.triggers). То есть
// ни одного нового чата бэкфилл не создаёт.
//
// ТОЛЬКО ДОПОЛНЯЕТ. Лишние строки `group_teachers` — те, где связи по
// предметам и кураторству уже нет, — НЕ удаляются: доступ к группе мог быть
// выдан осознанно (второй учитель, замена), и отбирать его молча нельзя.
// Скрипт их показывает и оставляет.
//
// school_id передаётся явно: колонка NOT NULL DEFAULT current_school_id(), а
// под service-role клиентом auth.uid() пуст и дефолт даёт NULL.
//
// ЗАПУСК (из apps/web):
//   node scripts/backfill-teacher-bindings.mjs           # холостой прогон
//   node scripts/backfill-teacher-bindings.mjs --apply   # запись

import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const APPLY = process.argv.includes("--apply");

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

const [{ data: schools }, { data: subjects }, { data: groups }, { data: links }, { data: teachers }] =
  await Promise.all([
    db.from("schools").select("id, name"),
    db.from("subjects").select("id, name, group_id, teacher_id, school_id"),
    db.from("groups").select("id, name, teacher_id, school_id"),
    db.from("group_teachers").select("group_id, teacher_id, school_id"),
    db.from("teachers").select("id, full_name, school_id"),
  ]);
if (!schools || !subjects || !groups || !links || !teachers) fail("не удалось прочитать данные");

const sName = new Map(schools.map((s) => [s.id, s.name]));
const gName = new Map(groups.map((g) => [g.id, g.name]));
const gSchool = new Map(groups.map((g) => [g.id, g.school_id]));
const tName = new Map(teachers.map((t) => [t.id, t.full_name]));

// ── чего не хватает ─────────────────────────────────────────────────────────
const have = new Set(links.map((l) => `${l.group_id}|${l.teacher_id}`));
const want = new Map();
const note = (groupId, teacherId, source, schoolId) => {
  if (!groupId || !teacherId) return;
  const key = `${groupId}|${teacherId}`;
  if (!want.has(key)) want.set(key, { groupId, teacherId, sources: new Set(), schoolId });
  want.get(key).sources.add(source);
};
for (const s of subjects) note(s.group_id, s.teacher_id, `предмет «${s.name}»`, s.school_id ?? gSchool.get(s.group_id));
for (const g of groups) note(g.id, g.teacher_id, "куратор группы", g.school_id);

const missing = [...want.values()].filter((w) => !have.has(`${w.groupId}|${w.teacherId}`));
const extra = links.filter((l) => !want.has(`${l.group_id}|${l.teacher_id}`));

console.log("── СОСТОЯНИЕ ПО ШКОЛАМ ──");
console.table(schools.map((s) => ({
  школа: s.name,
  учителей: teachers.filter((t) => t.school_id === s.id).length,
  назначений_с_учителем: subjects.filter((x) => x.school_id === s.id && x.teacher_id).length,
  кураторств: groups.filter((g) => g.school_id === s.id && g.teacher_id).length,
  нужно_связей: [...want.values()].filter((w) => w.schoolId === s.id).length,
  есть_связей: links.filter((l) => l.school_id === s.id).length,
})));

if (missing.length === 0) {
  console.log("\nВсе связи согласованы — дополнять нечего.");
} else {
  console.log(`\n── НЕ ХВАТАЕТ СВЯЗЕЙ: ${missing.length} ──`);
  console.table(missing.map((m) => ({
    школа: sName.get(m.schoolId) ?? "—",
    группа: gName.get(m.groupId) ?? m.groupId,
    учитель: tName.get(m.teacherId) ?? m.teacherId,
    почему: [...m.sources].join(", "),
  })));
}

if (extra.length) {
  console.log(`\n── ЛИШНИЕ СТРОКИ (НЕ ТРОГАЕМ): ${extra.length} ──`);
  console.log("Доступ к группе без предмета и без кураторства. Мог быть выдан осознанно —");
  console.log("бэкфилл только дополняет, снимать доступ молча нельзя.");
  console.table(extra.slice(0, 20).map((l) => ({
    группа: gName.get(l.group_id) ?? l.group_id, учитель: tName.get(l.teacher_id) ?? l.teacher_id,
  })));
}

// ── чат-триггер ─────────────────────────────────────────────────────────────
// Пишем только в group_teachers, а триггер живёт на subjects. Проверяем это
// фактом, а не памятью: если триггер вдруг появится, прогон должен встать.
const { data: subjectsTouched } = await db
  .from("subjects").select("id", { count: "exact", head: true }).limit(1);
void subjectsTouched;
console.log("\nЧатов будет создано: 0 — скрипт не трогает subjects, а на group_teachers триггеров нет.");

if (missing.length === 0) process.exit(0);

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply добавит недостающие связи.");
  process.exit(0);
}

// ── запись ──────────────────────────────────────────────────────────────────
const rows = missing.map((m) => ({
  group_id: m.groupId, teacher_id: m.teacherId,
  school_id: m.schoolId ?? gSchool.get(m.groupId) ?? null,
}));
const noSchool = rows.filter((r) => !r.school_id);
if (noSchool.length) fail(`${noSchool.length} строк без school_id — колонка NOT NULL, вставка упала бы`);

const { data: inserted, error } = await db
  .from("group_teachers")
  .upsert(rows, { onConflict: "group_id,teacher_id" })
  .select("group_id, teacher_id");
if (error) fail(`вставка: ${error.message}`);

console.log(`\nДобавлено связей: ${inserted?.length ?? 0}`);

// ── проверка после записи ───────────────────────────────────────────────────
const { data: after } = await db.from("group_teachers").select("group_id, teacher_id");
const haveAfter = new Set((after ?? []).map((l) => `${l.group_id}|${l.teacher_id}`));
const stillMissing = [...want.values()].filter((w) => !haveAfter.has(`${w.groupId}|${w.teacherId}`));
console.log(`Связей в group_teachers: было ${links.length}, стало ${after?.length ?? 0}`);
console.log(`Осталось несогласованных: ${stillMissing.length} (ожидание 0)`);
if (stillMissing.length) fail("после записи остались недостающие связи");

const { data: subjAfter } = await db.from("subjects").select("id, teacher_id");
const changed = (subjAfter ?? []).filter((s) => {
  const before = subjects.find((x) => x.id === s.id);
  return before && before.teacher_id !== s.teacher_id;
});
console.log(`Изменённых строк subjects: ${changed.length} (ожидание 0 — чат-триггер не будили)`);
if (changed.length) fail("subjects изменились, хотя не должны были");

console.log("\nГОТОВО. Цифры сошлись.");
