#!/usr/bin/env node
// 22.08.2026 — РАЗОВАЯ УБОРКА: открытая копия у мёртвых кодов входа родителя.
//
// 26.08.2026 — ПОЧЕМУ У ЭТОГО СКРИПТА НЕТ АРГУМЕНТА --school.
// Таблица parent_phone_codes школы не знает вовсе: колонки school_id в ней
// нет. Коды входа общие на всю базу, потому что телефон уникален глобально.
// Требовать аргумент, который некуда подставить, значило бы изобразить
// защиту вместо неё. Скрипт правит ровно одну колонку у уже погашенных
// кодов и ничего не удаляет.
//
// ЗАЧЕМ. Колонка code_plain существует по делу: SMS-провайдера нет, родителю
// приходит не код, а разрешённая тестовая фраза, и админ диктует код голосом
// из карточки родителя — прочитать его больше неоткуда. Но до правки от
// 22.08.2026 открытая копия ПЕРЕЖИВАЛА сам код: код протух или был
// использован, а четыре цифры оставались лежать в базе без срока.
//
// Правка закрыла будущее — теперь копия обнуляется во всех пяти точках, где
// код гаснет (см. шапку apps/web/lib/parent-sms.ts). Накопленное она не
// трогает намеренно: двенадцать строк уже помечены использованными, и ни один
// живой путь к ним больше не возвращается. Этот скрипт убирает именно их.
//
// ЧТО СЧИТАЕТСЯ МЁРТВЫМ: код использован (used_at заполнен) ИЛИ просрочен
// (expires_at в прошлом). Живой неиспользованный код не трогается — иначе
// админу нечего было бы продиктовать родителю, который ждёт звонка прямо
// сейчас.
//
// СТРОКИ НЕ УДАЛЯЮТСЯ. Обнуляется одна колонка. Сам код остаётся в базе
// зашифрованным (code_hash), вместе с телефоном, временем и числом попыток —
// история входов не теряется.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/clear-dead-plain-codes.mjs            ← холостой
//   node --env-file=.env.local scripts/clear-dead-plain-codes.mjs --confirm  ← запись

import { createClient } from "@supabase/supabase-js";

const CONFIRM = process.argv.includes("--confirm");

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} отсутствует — запускай с --env-file=.env.local из apps/web`);
  return v;
}

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await db
  .from("parent_phone_codes")
  .select("id, phone, expires_at, used_at, created_at")
  .not("code_plain", "is", null);
if (error) throw new Error(error.message);

const dead = (rows ?? []).filter((r) => r.used_at !== null || Date.parse(r.expires_at) < Date.now());
const alive = (rows ?? []).filter((r) => r.used_at === null && Date.parse(r.expires_at) >= Date.now());

const tail = (p) => `…${String(p).slice(-4)}`;

console.log(`\nСтрок с открытой копией : ${rows?.length ?? 0}`);
console.log(`  мёртвых (под очистку) : ${dead.length}`);
console.log(`  живых (не трогаем)    : ${alive.length}`);

if (dead.length > 0) {
  const used = dead.filter((r) => r.used_at !== null).length;
  console.log(`\nИз мёртвых: использовано ${used}, только просрочено ${dead.length - used}`);
  console.log("Номера показаны хвостом — сами коды не печатаем:");
  for (const r of dead) {
    console.log(
      `  ${tail(r.phone)}  заведён ${String(r.created_at).slice(0, 16).replace("T", " ")}  ` +
        `${r.used_at ? "использован" : "просрочен"}`,
    );
  }
}

// process.exit здесь не зовём намеренно: он рвёт ещё живое соединение
// supabase-js, и Node на Windows дописывает к выводу пугающую строку про
// assertion failed. Ветвимся обычным условием.
if (!CONFIRM) {
  console.log("\nЭто ХОЛОСТОЙ прогон: в базу не писали. Запись — той же командой с --confirm.\n");
} else if (dead.length === 0) {
  console.log("\nЧистить нечего.\n");
} else {
  // Пишем по списку идентификаторов, а не условием: список ровно тот, что
  // показан выше, и между показом и записью в него ничего не добавится.
  const { error: updErr, count } = await db
    .from("parent_phone_codes")
    .update({ code_plain: null }, { count: "exact" })
    .in("id", dead.map((r) => r.id));
  if (updErr) throw new Error(updErr.message);

  const { count: leftOpen } = await db
    .from("parent_phone_codes")
    .select("*", { count: "exact", head: true })
    .not("code_plain", "is", null);

  console.log(`\nОчищено строк             : ${count ?? dead.length}`);
  console.log(`Осталось с открытой копией: ${leftOpen ?? 0} (это живые коды, если они есть)`);
  console.log(`Время                     : ${new Date().toISOString()}\n`);
}
