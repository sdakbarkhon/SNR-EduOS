#!/usr/bin/env node
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 3: материалы из базы знаний для 49
// уроков, созданных заново после аварии ночного отката.
//
// Механизм тот же, что в интерфейсе учителя: AiGenerateStagesModal после
// вставки этапов вызывает attachBooksFromKnowledgeBase — берёт до трёх книг
// того же предмета и цепляет их к уроку. Здесь это повторено на служебном
// клиенте, потому что из скрипта модалка недоступна.
//
// Сопоставление предмета со slug библиотеки — getSubjectKeyByLabel
// (packages/core/src/config/subjects.ts), тот же источник, что у интерфейса.
// Дублируется здесь строкой, потому что .mjs не импортирует TS без сборки;
// список сверен с файлом 09.08.
//
// Форма строки повторяет linkLessonMaterialFromKnowledgeBase
// (packages/core): from_knowledge_base=true, kb_bucket='books',
// visibility='all', file_original_name = title. content_type и school_id
// проставляются умолчаниями базы — как у 94 уцелевших материалов
// (проверено живым запросом: все 94 имеют content_type='file').
//
// Книг в библиотеке: robotics 3, programming 4, math 2, russian 1,
// english 1 — поэтому уроки получат разное число материалов, и это норма:
// у уцелевших ровно так же (0-3 на урок).
//
// ДОПОЛНЕНИЕ, А НЕ ПРОПУСК. Модалка пропускает урок, у которого уже есть хоть
// один материал из books. Здесь иначе: урок дополняется до положенных ему
// книг, а недостающие определяются по file_storage_path. Причина — авария
// 08.08 сняла у уцелевших уроков 75 материалов ЧАСТИЧНО: у робототехники
// осталось 36 из 51, у программирования 29 из 63. Правило модалки увидело бы
// «материалы есть» и не восстановило ничего.
//
// ИДЕМПОТЕНТНОСТЬ: повторный прогон найдёт ноль недостающих.
//
// ЗАПУСК (из apps/web):
//   node scripts/restore-demo-materials.mjs                      # прогон по восстановленным
//   node scripts/restore-demo-materials.mjs --target=survivors   # по уцелевшим
//   node scripts/restore-demo-materials.mjs --target=all         # по всем 126
//   node scripts/restore-demo-materials.mjs --target=all --apply # запись

import fs from "node:fs";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const APPLY = process.argv.includes("--apply");
const TARGET = (process.argv.find((a) => a.startsWith("--target=")) ?? "--target=restored").split("=")[1];
if (!["restored", "survivors", "all"].includes(TARGET)) {
  console.error("!!! --target принимает restored | survivors | all");
  process.exit(1);
}
const IDS_PATH = new URL("./.restored-lessons.json", import.meta.url);
const OUT_PATH = new URL("./.restored-materials.json", import.meta.url);
const MAX_BOOKS = 3;

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

/** RU-название предмета → ключ конфига subjects (он же books.subject). */
const SUBJECT_KEY = {
  "Робототехника": "robotics", "Информатика": "informatics", "Программирование": "programming",
  "Математика": "math", "Физика": "physics", "Английский язык": "english",
  "Русский язык": "russian", "История": "history", "Биология": "biology", "Химия": "chemistry",
};

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

const restoredIds = JSON.parse(fs.readFileSync(IDS_PATH, "utf8")).map((r) => r.id);
if (restoredIds.length !== 49) fail(`в списке восстановленных ${restoredIds.length} уроков вместо 49`);

const { data: weekLessons, error: wErr } = await db
  .from("lessons").select("id, topic, subject_id, group:groups(name), subject:subjects(name, teacher_id)")
  .eq("school_id", SCHOOL_ID)
  .gte("starts_at", "2026-07-27T00:00:00+05:00").lt("starts_at", "2026-08-03T00:00:00+05:00")
  .order("starts_at");
if (wErr) fail(`чтение уроков: ${wErr.message}`);
if (weekLessons.length !== 126) fail(`в неделе ${weekLessons.length} уроков вместо 126`);

const restoredSet = new Set(restoredIds);
const lessons =
  TARGET === "restored" ? weekLessons.filter((l) => restoredSet.has(l.id))
  : TARGET === "survivors" ? weekLessons.filter((l) => !restoredSet.has(l.id))
  : weekLessons;
console.log(`Цель: ${TARGET} — уроков ${lessons.length}\n`);

// Что уже прикреплено — по каждому уроку, чтобы дополнять недостающим.
const lessonIds = lessons.map((l) => l.id);
const already = [];
for (let i = 0; i < lessonIds.length; i += 40) {
  const { data, error: aErr } = await db
    .from("lesson_materials").select("lesson_id, file_storage_path")
    .in("lesson_id", lessonIds.slice(i, i + 40)).eq("kb_bucket", "books");
  if (aErr) fail(`проверка существующих материалов: ${aErr.message}`);
  already.push(...(data ?? []));
}
const havePaths = new Map();
for (const r of already) {
  if (!havePaths.has(r.lesson_id)) havePaths.set(r.lesson_id, new Set());
  havePaths.get(r.lesson_id).add(r.file_storage_path);
}

const { data: books, error: bErr } = await db
  .from("books").select("id, title, subject, file_storage_path, file_size_bytes")
  .not("file_storage_path", "is", null).order("created_at", { ascending: true });
if (bErr) fail(`чтение библиотеки: ${bErr.message}`);

const booksBySlug = {};
for (const b of books) (booksBySlug[b.subject] ??= []).push(b);

const rows = [];
const skipped = [];
for (const l of lessons) {
  const subjectName = l.subject?.name ?? null;
  const slug = SUBJECT_KEY[subjectName];
  if (!slug) { skipped.push(`${l.topic} — предмет «${subjectName}» не сопоставлен со slug`); continue; }
  const have = havePaths.get(l.id) ?? new Set();
  // Дополняем до положенного: берём книги предмета, которых у урока нет.
  const pick = (booksBySlug[slug] ?? []).slice(0, MAX_BOOKS).filter((b) => !have.has(b.file_storage_path));
  if (!pick.length) continue;
  const teacherId = l.subject?.teacher_id ?? null;
  if (!teacherId) { skipped.push(`${l.topic} — у предмета нет учителя`); continue; }
  for (const b of pick) {
    rows.push({
      lesson_id: l.id, title: b.title, file_storage_path: b.file_storage_path,
      file_size_bytes: b.file_size_bytes, file_original_name: b.title,
      uploaded_by: teacherId, visibility: "all", from_knowledge_base: true, kb_bucket: "books",
      // school_id и content_type в интерфейсе проставляются по сессии
      // учителя, а у служебной роли сессии нет — задаём явно. Без school_id
      // вставка падает на NOT NULL (проверено), content_type='file' — как у
      // всех 94 уцелевших материалов.
      school_id: SCHOOL_ID, content_type: "file",
      _label: `${l.group?.name?.replace(" класс", "")} · ${subjectName} · ${l.topic}`,
    });
  }
}

console.log("── ЧЕГО НЕДОСТАЁТ, ПО ПРЕДМЕТАМ ──");
const bySubject = {};
for (const l of lessons) {
  const s = l.subject?.name ?? "—";
  const want = Math.min((booksBySlug[SUBJECT_KEY[s]] ?? []).length, MAX_BOOKS);
  bySubject[s] ??= { уроков: 0, положено: 0, есть: 0, добавим: 0 };
  bySubject[s].уроков++;
  bySubject[s].положено += want;
  bySubject[s].есть += (havePaths.get(l.id) ?? new Set()).size;
}
for (const r of rows) {
  const s = lessons.find((l) => l.id === r.lesson_id)?.subject?.name ?? "—";
  bySubject[s].добавим++;
}
console.table(Object.entries(bySubject).map(([k, v]) => ({ предмет: k, ...v })));

if (skipped.length) {
  console.log(`\nПропущено уроков: ${skipped.length}`);
  for (const s of skipped) console.log("   ", s);
}
console.log(`\nВсего материалов к созданию: ${rows.length}`);

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply прикрепит их.");
  process.exit(0);
}

/** Счёт материалов у целевых уроков — партиями: .in() с сотней с лишним
 *  идентификаторов упирается в длину URL. */
async function countMaterials() {
  let n = 0;
  for (let i = 0; i < lessonIds.length; i += 40) {
    const { count, error } = await db.from("lesson_materials")
      .select("id", { count: "exact", head: true }).in("lesson_id", lessonIds.slice(i, i + 40));
    if (error) fail(`подсчёт материалов: ${error.message}`);
    n += count ?? 0;
  }
  return n;
}
const before = await countMaterials();

const payload = rows.map(({ _label, ...r }) => r);
const created = [];
for (let i = 0; i < payload.length; i += 20) {
  const { data, error } = await db.from("lesson_materials").insert(payload.slice(i, i + 20)).select("id");
  if (error) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(created, null, 1));
    fail(`вставка на позиции ${i}: ${error.message}\nСозданное записано в ${OUT_PATH.pathname}`);
  }
  created.push(...data);
}
fs.writeFileSync(OUT_PATH, JSON.stringify(created, null, 1));

const after = await countMaterials();
console.log(`\nСоздано материалов: ${created.length}; у ${lessons.length} уроков было ${before}, стало ${after}.`);
if (after - before !== created.length) fail(`прирост ${after - before} не совпал с числом созданных ${created.length}`);

const { data: check } = await db.from("lesson_materials")
  .select("content_type, from_knowledge_base, kb_bucket").in("id", created.map((r) => r.id));
const bad = (check ?? []).filter((m) => m.content_type !== "file" || !m.from_knowledge_base || m.kb_bucket !== "books");
console.log(`Проверка формы: ${bad.length === 0 ? "все как у уцелевших (file / из базы знаний / books)" : `${bad.length} строк с другой формой`}`);
if (bad.length) fail("форма созданных материалов отличается от уцелевших");
console.log("\nГОТОВО. Цифры сошлись.");
