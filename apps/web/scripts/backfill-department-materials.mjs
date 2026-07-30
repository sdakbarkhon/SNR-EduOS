#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 12 — наполнение "Материалы кафедры"
// (teacher_library_materials) из существующих 10 книг библиотеки (books).
//
// ОТКЛОНЕНИЕ ОТ ПРОМТА ("файл не дублируется, просто ссылается"): у
// teacher_library_materials нет kb_bucket-колонки (в отличие от
// lesson_materials — миграция 115) — storage_path у неё ВСЕГДА
// резолвится в бакет "materials" (захардкожено в getLibraryMaterialUrl,
// packages/core/src/queries/library.ts). Миграция 153 (написана в этом
// же заходе) добавляет такую колонку, но НЕ ПРИМЕНЕНА к прод-базе — в
// этой среде нет доступа к прямому Postgres-подключению/привязанному
// Supabase CLI, только PostgREST/Storage через SUPABASE_SERVICE_ROLE_KEY,
// которым DDL не выполнить. Поэтому здесь — прагматичный обходной путь,
// работающий на ЖИВОЙ (не мигрированной) схеме: скачиваем байты файла из
// бакета "books" и заливаем копию в бакет "materials" по тому же
// путь-паттерну, что и обычная ручная загрузка (<teacher_id>/library/
// <material_id>/<filename>, см. LibraryUploadModal). Это ДЕЙСТВИТЕЛЬНО
// дублирует байты в Storage — сознательный компромисс ради того, чтобы
// демо работало сегодня без ручного шага заказчика. После применения
// миграции 153 это можно переделать на настоящую ссылку (kb_bucket=
// 'books', storage_path = путь книги как есть, без copy).
//
// Идемпотентно: пропускает книгу, если материал с таким же title уже
// есть в teacher_library_materials для того же subject_slug.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/backfill-department-materials.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

async function main() {
  console.log(`Наполнение "Материалы кафедры" из books — демо-школа (${SCHOOL_ID})\n`);

  const { data: books, error: bErr } = await db
    .from("books")
    .select("id, title, subject, author, file_storage_path, file_size_bytes")
    .eq("school_id", SCHOOL_ID);
  if (bErr) fail(`Ошибка запроса books: ${bErr.message}`);
  console.log(`Книг в БЗ: ${books.length} (ожидание 10).`);

  const { data: teachers, error: tErr } = await db
    .from("teachers")
    .select("id, subject_slug, full_name")
    .eq("school_id", SCHOOL_ID)
    .not("subject_slug", "is", null);
  if (tErr) fail(`Ошибка запроса teachers: ${tErr.message}`);
  const teacherBySlug = new Map(teachers.map((t) => [t.subject_slug, t]));
  for (const b of books) {
    if (!teacherBySlug.has(b.subject)) console.warn(`  !! Нет учителя с subject_slug='${b.subject}' (книга "${b.title}") — эта книга будет пропущена.`);
  }

  const { data: existing, error: exErr } = await db.from("teacher_library_materials").select("title, subject_slug").eq("school_id", SCHOOL_ID);
  if (exErr) fail(`Ошибка проверки существующих материалов: ${exErr.message}`);
  const existingKeys = new Set(existing.map((r) => `${r.subject_slug}|${r.title}`));

  let inserted = 0, skipped = 0, errors = 0;
  for (const book of books) {
    const teacher = teacherBySlug.get(book.subject);
    if (!teacher) { errors++; continue; }
    const key = `${book.subject}|${book.title}`;
    if (existingKeys.has(key)) { console.log(`  [${book.subject}] "${book.title}" → ПРОПУСК (уже есть)`); skipped++; continue; }

    const { data: fileBlob, error: dlErr } = await db.storage.from("books").download(book.file_storage_path);
    if (dlErr) { console.error(`  !! скачивание "${book.title}" (${book.file_storage_path}) упало: ${dlErr.message}`); errors++; continue; }

    const materialId = crypto.randomUUID();
    const originalName = book.file_storage_path.split("/").pop() || `${materialId}.pdf`;
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newPath = `${teacher.id}/library/${materialId}/${safeName}`;

    const { error: upErr } = await db.storage.from("materials").upload(newPath, fileBlob, { contentType: "application/pdf", upsert: false });
    if (upErr) { console.error(`  !! загрузка копии "${book.title}" в materials упала: ${upErr.message}`); errors++; continue; }

    const { error: insErr } = await db.from("teacher_library_materials").insert({
      id: materialId,
      school_id: SCHOOL_ID,
      uploaded_by: teacher.id,
      subject_slug: book.subject,
      title: book.title,
      content_type: "file",
      storage_path: newPath,
      file_type: "application/pdf",
      file_size_bytes: book.file_size_bytes,
    });
    if (insErr) { console.error(`  !! insert "${book.title}" упал: ${insErr.message}`); errors++; continue; }

    console.log(`  [${book.subject}] "${book.title}" → OK (учитель: ${teacher.full_name})`);
    inserted++;
  }

  console.log(`\nГотово: вставлено ${inserted}, пропущено (уже было) ${skipped}, ошибок ${errors}.`);

  const { count: totalCount } = await db.from("teacher_library_materials").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { data: bySubject } = await db.from("teacher_library_materials").select("subject_slug").eq("school_id", SCHOOL_ID);
  const subjectCounts = {};
  for (const r of bySubject ?? []) subjectCounts[r.subject_slug] = (subjectCounts[r.subject_slug] ?? 0) + 1;
  console.log(`\nПроверка: teacher_library_materials для демо-школы всего — ${totalCount} (ожидание 10).`);
  console.log(`По предметам: ${JSON.stringify(subjectCounts)} (ожидание {"programming":3,"robotics":3,"math":2,"english":1,"russian":1}).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
