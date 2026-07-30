#!/usr/bin/env node
// Фикс YouTube "ошибка 153" — youtube.com/embed/ID → youtube-nocookie.com/
// embed/ID?autoplay=0&modestbranding=1&rel=0 (apps/web/lib/video-url.ts,
// toEmbedUrl()). Та функция фиксит НОВЫЕ ссылки на будущее; этот скрипт —
// разовый бэкфилл уже СОХРАНЁННЫХ в БД embed-URL старого формата
// (lesson_materials.external_url, homework.attachment_external_url,
// teacher_library_materials.external_url) — все 3 места, где пользователь
// видел ошибку 153, рендерят iframe с ГОТОВЫМ URL из БД как есть (см.
// DemoMaterialContent.tsx/MaterialViewerModal/FileViewerModal — просто
// <iframe src={url}>, без трансформации на рендере), так что смена
// toEmbedUrl() одна НЕ чинит уже созданные записи.
//
// Идемпотентно: трогает только строки, чей URL всё ещё матчит старый
// youtube.com/embed/ паттерн — повторный запуск не находит что менять.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/fix-youtube-embed-urls.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const OLD_YOUTUBE_RE = /^https:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/;

function toNewUrl(oldUrl) {
  const m = oldUrl.match(OLD_YOUTUBE_RE);
  if (!m) return null;
  return `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=0&modestbranding=1&rel=0`;
}

async function fixTable(table, urlColumn) {
  const { data, error } = await db.from(table).select(`id, ${urlColumn}`).eq("school_id", SCHOOL_ID).not(urlColumn, "is", null);
  if (error) fail(`Ошибка запроса ${table}: ${error.message}`);

  let fixed = 0;
  for (const row of data ?? []) {
    const oldUrl = row[urlColumn];
    const newUrl = toNewUrl(oldUrl);
    if (!newUrl) continue; // не youtube.com/embed/ — уже новый формат, или rutube, или что-то другое
    const { error: updErr } = await db.from(table).update({ [urlColumn]: newUrl }).eq("id", row.id);
    if (updErr) { console.error(`  !! ${table}.${row.id} update failed: ${updErr.message}`); continue; }
    console.log(`  [${table}] ${row.id}: "${oldUrl}" → "${newUrl}"`);
    fixed++;
  }
  console.log(`${table}.${urlColumn}: проверено ${data?.length ?? 0}, исправлено ${fixed}.`);
  return fixed;
}

async function main() {
  console.log(`Фикс YouTube embed-URL — демо-школа (${SCHOOL_ID})\n`);
  const a = await fixTable("lesson_materials", "external_url");
  const b = await fixTable("homework", "attachment_external_url");
  const c = await fixTable("teacher_library_materials", "external_url");
  console.log(`\nГотово: всего исправлено ${a + b + c}.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
