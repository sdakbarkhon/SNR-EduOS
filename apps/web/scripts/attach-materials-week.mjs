#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 6 — материалы уроков из Базы знаний.
//
// РАЗВЕДКА (см. отчёт): books.subject — простая text-колонка со слагом
// предмета (НЕ FK, НЕ junction table) — тот же маппинг имя→слаг, что уже
// использует существующий хелпер attachBooksToLesson() в
// _backfill-shared.mjs (SUBJECT_NAME_TO_BOOK_SLUG). lesson_materials —
// материал урока может быть либо реальным файлом (from_knowledge_base=
// false), либо ссылкой на файл, уже лежащий в БЗ (from_knowledge_base=
// true, kb_bucket='books', file_storage_path указывает в бакет books, а
// не lesson-materials) — "копирование по ссылке", миграция
// 115_lesson_materials_kb_link.sql. Живые данные демо-школы: 10 книг —
// {robotics:3, programming:3, math:2, russian:1, english:1} — ровно по
// слагам всех 5 предметов; lesson_materials сейчас пусто (0 строк).
//
// Существующий attachBooksToLesson() выбирает книги ДЕТЕРМИНИРОВАННО
// (created_at ascending, первые maxBooks) — здесь нужен воспроизводимый
// РАНДОМ с seed = lesson_id (та же схема xmur3+mulberry32, что и в
// create-schedule-week.mjs), плюс fallback на случайную книгу школы,
// если у предмета урока вообще нет книг (при текущих 10 книгах на 5 из
// 5 предметов это ветка не должна сработать ни разу — но по ТЗ обязана
// быть реализована).
//
// ЛОГИКА НА УРОК:
//   candidates = books школы с subject = слаг предмета урока
//   >= 3 книги  → перемешать (seeded shuffle) и взять первые 3
//   1-2 книги   → взять все
//   0 книг      → взять 1 случайную книгу школы (seeded), независимо от предмета
//
// ИДЕМПОТЕНТНОСТЬ: если у урока уже есть материал с kb_bucket='books' —
// пропускаем урок целиком (как и attachBooksToLesson()).
//
// БЕЗ --confirm (не разрушительно — только INSERT к урокам без книжных
// материалов).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/attach-materials-week.mjs

import { makeServiceRoleClient, SCHOOL_ID, SUBJECT_NAME_TO_BOOK_SLUG } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

// ── детерминированный PRNG (xmur3 seed hash + mulberry32) — как в create-schedule-week.mjs
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

function pickBooksForLesson(lessonId, subjectSlug, booksBySlug, allBooks) {
  const candidates = subjectSlug ? (booksBySlug.get(subjectSlug) ?? []) : [];
  const rng = seededRng(lessonId);
  if (candidates.length >= 3) return { books: shuffle(candidates, rng).slice(0, 3), fallback: false };
  if (candidates.length >= 1) return { books: candidates, fallback: false };
  if (allBooks.length === 0) return { books: [], fallback: false };
  const pick = allBooks[Math.floor(rng() * allBooks.length)];
  return { books: [pick], fallback: true };
}

async function main() {
  console.log(`Материалы уроков из БЗ — демо-школа (${SCHOOL_ID})\n`);

  const { data: books, error: bErr } = await db
    .from("books")
    .select("id, title, subject, file_storage_path, file_size_bytes")
    .eq("school_id", SCHOOL_ID);
  if (bErr) fail(`Ошибка запроса books: ${bErr.message}`);
  console.log(`Книг в Базе знаний демо-школы: ${books.length}.`);
  const booksBySlug = new Map();
  for (const b of books) {
    if (!booksBySlug.has(b.subject)) booksBySlug.set(b.subject, []);
    booksBySlug.get(b.subject).push(b);
  }
  const bySlugCounts = Object.fromEntries([...booksBySlug.entries()].map(([k, v]) => [k, v.length]));
  console.log(`По предметам (слаг): ${JSON.stringify(bySlugCounts)}\n`);

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, topic, group:groups(name), subject:subjects(name, teacher_id)")
    .eq("school_id", SCHOOL_ID)
    .order("starts_at");
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Всего уроков демо-школы: ${lessons.length} (ожидание 126).`);

  const lessonIds = lessons.map((l) => l.id);
  const { data: existingRows, error: exErr } = await db
    .from("lesson_materials")
    .select("lesson_id")
    .in("lesson_id", lessonIds)
    .eq("kb_bucket", "books");
  if (exErr) fail(`Ошибка проверки существующих материалов: ${exErr.message}`);
  const hasMaterials = new Set(existingRows.map((r) => r.lesson_id));
  const pending = lessons.filter((l) => !hasMaterials.has(l.id));
  console.log(`Уже с материалами из БЗ: ${hasMaterials.size}. В очереди: ${pending.length}.\n`);
  if (pending.length === 0) { console.log("Нечего делать."); return; }

  let done = 0, errors = 0, inserted = 0, fallbackCount = 0;
  for (const [i, lesson] of pending.entries()) {
    const groupName = lesson.group?.name ?? "—";
    const subjectName = lesson.subject?.name ?? "—";
    const teacherId = lesson.subject?.teacher_id ?? null;
    const slug = SUBJECT_NAME_TO_BOOK_SLUG[subjectName ?? ""];
    const logPrefix = `  [${i + 1}/${pending.length}] ${groupName} · ${subjectName} · "${lesson.topic ?? "—"}"`;

    const { books: chosen, fallback } = pickBooksForLesson(lesson.id, slug, booksBySlug, books);
    if (chosen.length === 0) {
      console.log(`${logPrefix} → пропуск (нет книг вообще в БЗ школы)`);
      continue;
    }

    const rows = chosen.map((b) => ({
      lesson_id: lesson.id,
      school_id: SCHOOL_ID,
      title: b.title,
      file_storage_path: b.file_storage_path,
      file_size_bytes: b.file_size_bytes,
      file_original_name: b.title,
      uploaded_by: teacherId,
      visibility: "all",
      from_knowledge_base: true,
      kb_bucket: "books",
    }));
    const { error: insErr } = await db.from("lesson_materials").insert(rows);
    if (insErr) { console.error(`${logPrefix} → ОШИБКА: ${insErr.message}`); errors++; continue; }

    if (fallback) fallbackCount++;
    inserted += rows.length;
    done++;
    console.log(`${logPrefix} → OK (${rows.length} материал(ов)${fallback ? ", fallback" : ""})`);
  }

  console.log(`\nГотово: обработано уроков ${done}, ошибок ${errors}, fallback-случаев ${fallbackCount}.`);
  console.log(`Вставлено записей lesson_materials: ${inserted}.`);

  const { count: totalMaterials } = await db
    .from("lesson_materials")
    .select("*", { count: "exact", head: true })
    .in("lesson_id", lessonIds);
  console.log(`\nПроверка: lesson_materials для демо-школы всего — ${totalMaterials} (ожидание 126-378).`);

  const { data: byLesson, error: gErr } = await db.from("lesson_materials").select("lesson_id").in("lesson_id", lessonIds);
  if (gErr) fail(`Ошибка финальной проверки: ${gErr.message}`);
  const countByLesson = new Map();
  for (const r of byLesson) countByLesson.set(r.lesson_id, (countByLesson.get(r.lesson_id) ?? 0) + 1);
  const zeroCount = lessonIds.filter((id) => !countByLesson.has(id)).length;
  console.log(`Проверка: уроков без ни одного материала — ${zeroCount} (ожидание 0).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
