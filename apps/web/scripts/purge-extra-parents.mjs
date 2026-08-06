#!/usr/bin/env node
// Удаляет демо-родителей parent_rakhimov/parent_karimov (со всеми связанными
// данными) и переименовывает их 5 бывших детей в demo_student_XX. Оставлен
// для истории (по требованию задачи), не для повторного использования as-is
// (список username/паролей и т.п. специфичен для этого разового захода).
//
// node apps/web/scripts/purge-extra-parents.mjs recon    — только чтение
// node apps/web/scripts/purge-extra-parents.mjs execute  — recon + запись
//
// ВАЖНО про FK — разведка по supabase/migrations/*.sql (74_parents_and_invites.sql,
// 78_chat_infrastructure.sql, 20260619000034_announcements_notifications.sql,
// 20260624000048_announcement_user_reads.sql, 110_single_session_and_demo_flag.sql,
// 133_demo_leases.sql) показала: ПОЧТИ ВСЁ связанное с parent.user_id висит на
// `REFERENCES auth.users(id) ON DELETE CASCADE` — parents, parent_students (через
// parents.id), parent_invites (через parents.id), chat_participants, chat_read_state,
// notifications.recipient_user_id, user_sessions, demo_leases,
// announcement_user_reads. Единственное исключение — chat_messages.sender_id
// это `ON DELETE SET NULL` (сообщения СОХРАНЯЮТСЯ, только автор обнуляется —
// осознанный дизайн схемы, не баг). Поэтому основная удаляющая операция —
// ОДИН supabase.auth.admin.deleteUser(userId) на родителя, а не ручной
// многошаговый DELETE по каждой таблице — реестр таблиц ниже используется
// только для разведки (посчитать что затронется). Сам DELETE по этим
// таблицам НЕ выполняется отдельно — по решению пользователя после
// разведки, deleteUser() + каскад достаточно.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const text = fs.readFileSync(path.join(WEB_ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOOMED_PARENT_USERNAMES = ["parent_rakhimov", "parent_karimov"];
const CHILD_USERNAMES = ["nodira_07", "rustam_03", "aziz_03", "farrukh_10", "malika_07"];
const STUDENT_EMAIL_DOMAIN = "students.snr.local";

function fail(msg) {
  console.error(`\n[STOP] ${msg}`);
  process.exit(1);
}

async function findAuthUsersByUsername(usernames) {
  // auth.users не доступен через обычный PostgREST-клиент — только
  // auth.admin.listUsers(). perPage=200 хватает с запасом (в проекте ~40 юзеров).
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 });
  if (error) fail(`auth.admin.listUsers: ${error.message}`);
  const byUsername = new Map();
  for (const u of data.users) {
    const uname = u.user_metadata?.username;
    if (uname && usernames.includes(uname)) byUsername.set(uname, u);
  }
  return byUsername;
}

async function recon() {
  console.log("=== 1.1 Родители parent_rakhimov / parent_karimov ===");
  const authByUsername = await findAuthUsersByUsername(DOOMED_PARENT_USERNAMES);
  for (const uname of DOOMED_PARENT_USERNAMES) {
    const u = authByUsername.get(uname);
    console.log(uname, "->", u ? `auth.users.id=${u.id}, email=${u.email}` : "НЕ НАЙДЕН");
  }
  if (authByUsername.size !== 2) {
    fail(`Ожидалось 2 родителя, найдено ${authByUsername.size}. См. вывод выше.`);
  }
  const parentAuthIds = DOOMED_PARENT_USERNAMES.map((u) => authByUsername.get(u).id);

  const { data: parentRows, error: parentsErr } = await db
    .from("parents")
    .select("id, user_id, full_name, phone, school_id")
    .in("user_id", parentAuthIds);
  if (parentsErr) fail(`parents select: ${parentsErr.message}`);
  console.log("public.parents rows:", JSON.stringify(parentRows, null, 2));
  if (parentRows.length !== 2) {
    fail(`Ожидалось 2 строки в public.parents, найдено ${parentRows.length}.`);
  }
  const parentTableIds = parentRows.map((p) => p.id);

  console.log("\n=== 1.2 Пятеро детей ===");
  const { data: childRows, error: childErr } = await db
    .from("students")
    .select("id, user_id, username, full_name, school_id, status, grade")
    .in("username", CHILD_USERNAMES);
  if (childErr) fail(`students select: ${childErr.message}`);
  console.log("students rows:", JSON.stringify(childRows, null, 2));
  if (childRows.length !== 5) {
    fail(`Ожидалось 5 детей, найдено ${childRows.length}. См. вывод выше.`);
  }
  const nullSchoolId = childRows.filter((c) => !c.school_id);
  if (nullSchoolId.length > 0) {
    fail(`У детей school_id = NULL: ${nullSchoolId.map((c) => c.username).join(", ")}`);
  }

  const childIds = childRows.map((c) => c.id);
  const { data: sgRows, error: sgErr } = await db
    .from("student_groups")
    .select("student_id, group_id, groups(name)")
    .in("student_id", childIds);
  if (sgErr) fail(`student_groups select: ${sgErr.message}`);
  const groupByStudent = new Map(sgRows.map((r) => [r.student_id, r.groups?.name]));
  for (const c of childRows) {
    console.log(
      `  ${c.username}: school_id=${c.school_id} status=${c.status} grade=${c.grade} group=${groupByStudent.get(c.id) ?? "(нет группы!)"}`,
    );
  }
  const noGroup = childRows.filter((c) => !groupByStudent.has(c.id));
  if (noGroup.length > 0) {
    fail(`У детей нет строки в student_groups: ${noGroup.map((c) => c.username).join(", ")}`);
  }

  console.log("\n=== 1.3 Нумерация demo_student_{класс}_{номер} — по решению пользователя, не плоская ===");
  // Реальная схема — demo_student_{grade}_{seq} (подтверждено живым SELECT в
  // прошлом заходе разведки: demo_student_10_08.., demo_student_3_01..,
  // demo_student_7_01..). Новые имена — явно заданы пользователем после
  // разведки, продолжают нумерацию внутри своего класса (не плоско).
  const RENAME_MAP = {
    farrukh_10: "demo_student_10_29",
    rustam_03: "demo_student_3_31",
    aziz_03: "demo_student_3_32",
    nodira_07: "demo_student_7_31",
    malika_07: "demo_student_7_32",
  };
  console.log("Карта переименования (задана пользователем):", RENAME_MAP);

  console.log("\n=== 1.4 FK-связи (только подсчёт, не удаляем) ===");
  const tableChecks = [
    { table: "parent_students", col: "parent_id", ids: parentTableIds },
    { table: "parent_invites", col: "parent_id", ids: parentTableIds },
    { table: "chat_participants", col: "user_id", ids: parentAuthIds },
    { table: "chat_read_state", col: "user_id", ids: parentAuthIds },
    { table: "chat_messages", col: "sender_id", ids: parentAuthIds },
    { table: "notifications", col: "recipient_user_id", ids: parentAuthIds },
    { table: "user_sessions", col: "user_id", ids: parentAuthIds },
    { table: "demo_leases", col: "user_id", ids: parentAuthIds },
    { table: "announcement_user_reads", col: "user_id", ids: parentAuthIds },
  ];
  const counts = {};
  for (const { table, col, ids } of tableChecks) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(col, ids);
    if (error) {
      console.log(`  ${table}.${col}: ОШИБКА ЗАПРОСА (таблица/колонка может не существовать) — ${error.message}`);
      continue;
    }
    counts[table] = count;
    console.log(`  ${table}.${col} IN (родители): ${count} строк`);
  }
  console.log(
    "\nВсе перечисленные таблицы каскадируются от auth.users(id) ON DELETE CASCADE, КРОМЕ chat_messages " +
      "(ON DELETE SET NULL — сообщения сохранятся, sender_id станет NULL). По решению пользователя — " +
      "только supabase.auth.admin.deleteUser() на 2 родителей, без ручного DELETE по таблицам.",
  );

  console.log("\n=== 1.5 Хардкод username детей в коде (apps/, packages/) ===");
  // Примечание: сам grep выполняется отдельно инструментом Grep в вызывающей
  // сессии (пусто/непусто передаётся в отчёт) — здесь только фиксируем список
  // для читателя лога, т.к. grep -r по всему репо не входит в задачи Node-скрипта.
  console.log("  (см. отдельный вывод Grep в отчёте сессии)");

  console.log("\n=== 1.6 Хардкод в apps/mobile-parent ===");
  console.log("  (см. отдельный вывод Grep в отчёте сессии)");

  return { authByUsername, parentAuthIds, parentTableIds, parentRows, childRows, RENAME_MAP };
}

async function execute(reconResult) {
  const { childRows, RENAME_MAP } = reconResult;

  console.log("\n\n=== 3.1 Переименование 5 детей ===");
  const renameResults = [];
  for (const child of childRows) {
    const newUsername = RENAME_MAP[child.username];
    if (!newUsername) {
      console.error(`  ${child.username}: НЕТ в RENAME_MAP — пропускаю (не должно случиться, все 5 заданы явно)`);
      renameResults.push({ old: child.username, new: null, ok: false, step: "RENAME_MAP lookup" });
      continue;
    }
    const newEmail = `${newUsername}@${STUDENT_EMAIL_DOMAIN}`;

    // students.username — источник для UI/claim_demo_slot-возврата.
    const { error: updErr } = await db.from("students").update({ username: newUsername }).eq("id", child.id);
    if (updErr) {
      console.error(`  ${child.username} -> ${newUsername}: ОШИБКА students.update: ${updErr.message}`);
      renameResults.push({ old: child.username, new: newUsername, ok: false, step: "students.update" });
      continue;
    }

    // auth.users: email (используется signInWithUsername → usernameToEmail) +
    // user_metadata.username (используется claim_demo_slot и другими RPC).
    const { data: authUser, error: getErr } = await db.auth.admin.getUserById(child.user_id);
    if (getErr) {
      console.error(`  ${child.username} -> ${newUsername}: ОШИБКА auth.admin.getUserById: ${getErr.message}`);
      renameResults.push({ old: child.username, new: newUsername, ok: false, step: "auth.getUserById" });
      continue;
    }
    const { error: authUpdErr } = await db.auth.admin.updateUserById(child.user_id, {
      email: newEmail,
      user_metadata: { ...authUser.user.user_metadata, username: newUsername },
    });
    if (authUpdErr) {
      console.error(`  ${child.username} -> ${newUsername}: ОШИБКА auth.admin.updateUserById: ${authUpdErr.message}`);
      renameResults.push({ old: child.username, new: newUsername, ok: false, step: "auth.updateUserById" });
      continue;
    }

    console.log(`  ${child.username} -> ${newUsername} (email -> ${newEmail}): OK`);
    renameResults.push({ old: child.username, new: newUsername, ok: true });
  }

  console.log("\n=== 3.3 Удаление родителей (auth.admin.deleteUser, каскад) ===");
  const deleteResults = [];
  for (const uname of DOOMED_PARENT_USERNAMES) {
    const authId = reconResult.authByUsername.get(uname).id;
    const { error } = await db.auth.admin.deleteUser(authId);
    if (error) {
      console.error(`  ${uname} (${authId}): ОШИБКА deleteUser: ${error.message}`);
      deleteResults.push({ username: uname, ok: false, error: error.message });
      continue;
    }
    console.log(`  ${uname} (${authId}): удалён (auth.users + каскад parents/parent_students/parent_invites/chat_participants/chat_read_state/notifications/user_sessions/demo_leases/announcement_user_reads)`);
    deleteResults.push({ username: uname, ok: true });
  }

  return { renameResults, deleteResults };
}

const mode = process.argv[2];
if (mode !== "recon" && mode !== "execute") {
  console.error('Использование: node purge-extra-parents.mjs recon|execute');
  process.exit(1);
}

const reconResult = await recon();
console.log("\n\n=== RECON ЗАВЕРШЁН ===");

if (mode === "execute") {
  await execute(reconResult);
  console.log("\n=== EXECUTE ЗАВЕРШЁН ===");
}
