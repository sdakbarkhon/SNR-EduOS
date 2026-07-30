#!/usr/bin/env node
// Сброс демо-контента code_completion перед регенерацией.
//
// Зачем: первая генерация (Блок 6.5) дала код с КИРИЛЛИЧЕСКИМИ именами
// переменных («повторений = __GAP1__»), что выглядит неестественно.
// Промты обоих генераторов и их валидаторы теперь требуют английские
// идентификаторы (строки и комментарии по-прежнему русские), но старые
// записи от этого сами не исправятся — их надо снести и создать заново.
//
// Область: ТОЛЬКО демо-школа (SCHOOL_ID) и ТОЛЬКО content_type='code_completion'.
// Другие типы ДЗ/этапов (file/test/programming/wokwi/...) не затрагиваются.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/reset-code-completion.mjs --confirm

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

if (!process.argv.includes("--confirm")) {
  console.log("Это разрушительная операция. Перезапустите с флагом --confirm.");
  process.exit(0);
}

const { data: hw, error: hwErr } = await db
  .from("homework").select("id").eq("school_id", SCHOOL_ID).eq("content_type", "code_completion");
if (hwErr) fail(`homework select: ${hwErr.message}`);
const hwIds = (hw ?? []).map((h) => h.id);

let subsDeleted = 0;
if (hwIds.length) {
  const { data: subs, error: sErr } = await db
    .from("homework_submissions").select("id").in("homework_id", hwIds);
  if (sErr) fail(`submissions select: ${sErr.message}`);
  subsDeleted = (subs ?? []).length;
  if (subsDeleted) {
    const { error: delErr } = await db.from("homework_submissions").delete().in("homework_id", hwIds);
    if (delErr) fail(`submissions delete: ${delErr.message}`);
  }
  const { error: delHw } = await db.from("homework").delete().in("id", hwIds);
  if (delHw) fail(`homework delete: ${delHw.message}`);
}

const { data: st, error: stErr } = await db
  .from("lesson_stages").select("id").eq("school_id", SCHOOL_ID).eq("content_type", "code_completion");
if (stErr) fail(`lesson_stages select: ${stErr.message}`);
const stIds = (st ?? []).map((s) => s.id);
if (stIds.length) {
  const { error: delSt } = await db.from("lesson_stages").delete().in("id", stIds);
  if (delSt) fail(`lesson_stages delete: ${delSt.message}`);
}

console.log(`Удалено: сдач ${subsDeleted}, ДЗ ${hwIds.length}, этапов урока ${stIds.length}.`);
console.log("Теперь запустите: create-code-completion.mjs и create-code-completion-homework.mjs");
