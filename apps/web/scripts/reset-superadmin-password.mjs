#!/usr/bin/env node
// Z.1, 06.08.2026 — сброс пароля СУЩЕСТВУЮЩЕГО суперадмина.
//
// Аккаунт superadmin@admins.snr.local создан ещё миграцией 71 (04.07.2026) и
// живёт в public.super_admins. Пароль к нему был ротирован вне репозитория —
// в миграции лежит только плейсхолдер '__ROTATED_AFTER_APPLY__', то есть
// фактический пароль не знает никто. Без него нельзя ни открыть /superadmin,
// ни проверить результат Z.1. Этот скрипт генерирует новый и печатает его
// ОДИН РАЗ.
//
// Скрипт НЕ создаёт новых пользователей и НЕ трогает public.super_admins —
// роль, аккаунт и страницы уже существуют (см. разведку Z.1). Только
// auth.admin.updateUserById по конкретному email.
//
// ЗАПУСК (из apps/web):
//   node scripts/reset-superadmin-password.mjs
//   node scripts/reset-superadmin-password.mjs --show-only   # ничего не менять, только проверить наличие аккаунта
//
// Идемпотентность: повторный запуск просто выдаёт ЕЩЁ ОДИН новый пароль
// (сброс по своей природе не идемпотентен). Если аккаунта нет — скрипт
// останавливается и ничего не создаёт, потому что создание суперадмина это
// отдельное решение, а не побочный эффект сброса пароля.

import crypto from "crypto";
import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const SHOW_ONLY = process.argv.includes("--show-only");
const EMAIL = "superadmin@admins.snr.local";
const USERNAME = "superadmin";

// 16 символов, только буквы+цифры — по требованию заказчика без спецсимволов,
// чтобы не мучиться при ручном вводе. Исключены визуально неоднозначные
// 0/O/o/1/l/I — тот же приём, что generateInviteCode() в lib/admin-api.ts.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 16) {
  const bytes = crypto.randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const idx = bytes[i] % 256;
    if (idx < 256 - (256 % ALPHABET.length)) out += ALPHABET[idx % ALPHABET.length];
  }
  return out.length === length ? out : generatePassword(length);
}

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

async function main() {
  const db = makeServiceRoleClient();

  // 1) Найти auth-пользователя по email (listUsers + фильтр: getUserByEmail в
  //    supabase-js v2 отсутствует).
  let target = null;
  for (let page = 1; page <= 20 && !target; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    if (!data.users.length) break;
    target = data.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL) ?? null;
  }
  if (!target) fail(`Пользователь ${EMAIL} не найден. Скрипт НЕ создаёт аккаунт — это отдельное решение.`);

  // 2) Убедиться, что он действительно суперадмин.
  const { data: saRow, error: saErr } = await db
    .from("super_admins")
    .select("id, full_name")
    .eq("user_id", target.id)
    .maybeSingle();
  if (saErr) fail(`super_admins: ${saErr.message}`);
  if (!saRow) fail(`${EMAIL} существует в auth, но строки в public.super_admins нет — не трогаю пароль.`);

  console.log(`Найден суперадмин: ${saRow.full_name} <${EMAIL}>`);
  console.log(`  user_id: ${target.id}`);
  console.log(`  email подтверждён: ${target.email_confirmed_at ? "да" : "НЕТ"}`);
  console.log(`  заблокирован: ${target.banned_until ? "ДА — " + target.banned_until : "нет"}`);

  if (SHOW_ONLY) {
    console.log("\n--show-only: пароль не менялся.");
    return;
  }

  // 3) Сброс пароля.
  const password = generatePassword(16);
  const { error: updErr } = await db.auth.admin.updateUserById(target.id, { password });
  if (updErr) fail(`updateUserById: ${updErr.message}`);

  const line = "═".repeat(64);
  console.log(`\n${line}`);
  console.log("  ДОСТУП СУПЕРАДМИНА — СОХРАНИТЕ, ПОВТОРНО НЕ ПОКАЗЫВАЕТСЯ");
  console.log(line);
  console.log(`  Логин:   ${USERNAME}`);
  console.log(`  Пароль:  ${password}`);
  console.log(`  (email для входа резолвится автоматически: ${EMAIL})`);
  console.log(`${line}\n`);
  console.log("Вход — обычная форма /login, поле «логин» = superadmin.");
  console.log("После входа редирект на /superadmin/dashboard (middleware пиннит суперадмина на этот раздел).");
}

main().catch((e) => fail(e.stack ?? String(e)));
