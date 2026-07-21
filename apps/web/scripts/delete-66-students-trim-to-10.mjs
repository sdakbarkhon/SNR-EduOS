// ОДНОРАЗОВЫЙ скрипт — удаление 66 утверждённых учеников (Шаг 2 из 2,
// сокращение групп 10-А/7-А/3-А до 10 учеников каждая, план утверждён
// менеджером по отчёту Шага 1). Использует ТОТ ЖЕ путь удаления, что
// apps/web/lib/admin-api.ts:deleteStudent() — supabase.auth.admin.deleteUser(user_id)
// — каскадно сносит students + все 24 связанные таблицы (FK ON DELETE
// CASCADE, подтверждено отдельным исследованием миграций) + notifications/
// chat_participants/chat_read_state в ГРУППОВЫХ чатах (эти завязаны на
// auth.users, не на students.id напрямую — обычный DELETE FROM students их
// бы не тронул, поэтому используется именно auth.admin.deleteUser, как в
// приложении).
//
// БЕЗОПАСНОСТЬ:
// - Список REMOVE_USERNAMES ниже — ТОЧНО утверждённые менеджером 66
//   username из отчёта Шага 1. Список НЕ пересчитывается на лету (не
//   "нижние 22 по score сейчас") — так удалятся именно те, кого одобрил
//   менеджер, даже если данные изменились с момента диагностики.
// - Перед удалением: резолвит username → student/user_id, требует РОВНО 66
//   найденных строк, проверяет что ни один из PROTECTED_USERNAMES (6
//   "наполненных" аккаунтов) не попал в резолвленный список — при любом
//   расхождении СТОП, ничего не удаляет.
// - Dry-run по умолчанию. Реальное удаление — только с CONFIRM=YES.
// - SUPABASE_SERVICE_ROLE_KEY читается молча из .env.local (через общий
//   _backfill-shared.mjs хелпер) — нигде не логируется и не печатается.
//
// ЗАПУСК (из apps/web):
//   node scripts/delete-66-students-trim-to-10.mjs                 — dry-run
//   CONFIRM=YES node scripts/delete-66-students-trim-to-10.mjs     — реальное удаление

import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const REMOVE_USERNAMES = [
  // 10-А класс (22)
  "demo_student_10_01", "demo_student_10_02", "demo_student_10_03", "demo_student_10_04",
  "demo_student_10_05", "demo_student_10_06", "demo_student_10_07", "demo_student_10_09",
  "demo_student_10_10", "demo_student_10_11", "demo_student_10_12", "demo_student_10_15",
  "demo_student_10_18", "demo_student_10_19", "demo_student_10_20", "demo_student_10_21",
  "demo_student_10_22", "demo_student_10_25", "demo_student_10_26", "demo_student_10_27",
  "demo_student_10_29", "demo_student_10_30",
  // 7-А класс (22)
  "demo_student_7_02", "demo_student_7_03", "demo_student_7_04", "demo_student_7_05",
  "demo_student_7_06", "demo_student_7_07", "demo_student_7_09", "demo_student_7_12",
  "demo_student_7_13", "demo_student_7_15", "demo_student_7_16", "demo_student_7_17",
  "demo_student_7_18", "demo_student_7_19", "demo_student_7_20", "demo_student_7_22",
  "demo_student_7_23", "demo_student_7_24", "demo_student_7_25", "demo_student_7_26",
  "demo_student_7_27", "demo_student_7_28",
  // 3-А класс (22)
  "demo_student_3_02", "demo_student_3_03", "demo_student_3_04", "demo_student_3_05",
  "demo_student_3_06", "demo_student_3_07", "demo_student_3_09", "demo_student_3_10",
  "demo_student_3_11", "demo_student_3_12", "demo_student_3_13", "demo_student_3_15",
  "demo_student_3_17", "demo_student_3_18", "demo_student_3_19", "demo_student_3_20",
  "demo_student_3_21", "demo_student_3_23", "demo_student_3_24", "demo_student_3_26",
  "demo_student_3_27", "demo_student_3_29",
];

// 6 "наполненных" аккаунтов (топ-2 score каждой группы, отчёт Шага 1) — не
// должны появиться в REMOVE_USERNAMES ни при каких обстоятельствах.
// Проверяется и статически ниже, и по резолвленным данным из БД.
const PROTECTED_USERNAMES = ["sherzod_10", "farrukh_10", "malika_07", "nodira_07", "aziz_03", "rustam_03"];

const EXPECTED_COUNT = 66;

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}\n!!! Ничего не удалено.`);
  process.exit(1);
}

// Статические проверки ДО любого обращения к БД.
if (REMOVE_USERNAMES.length !== EXPECTED_COUNT) {
  fail(`REMOVE_USERNAMES содержит ${REMOVE_USERNAMES.length} username, ожидалось ${EXPECTED_COUNT}.`);
}
if (new Set(REMOVE_USERNAMES).size !== REMOVE_USERNAMES.length) {
  fail("В REMOVE_USERNAMES есть дубликаты.");
}
for (const p of PROTECTED_USERNAMES) {
  if (REMOVE_USERNAMES.includes(p)) fail(`Защищённый username "${p}" присутствует в REMOVE_USERNAMES.`);
}

const CONFIRMED = process.env.CONFIRM === "YES" || process.argv.includes("--confirm");

async function main() {
  const db = makeServiceRoleClient();

  console.log(`Режим: ${CONFIRMED ? "РЕАЛЬНОЕ УДАЛЕНИЕ (CONFIRM=YES)" : "DRY-RUN (ничего не удаляется)"}`);
  console.log(`Утверждённый список на удаление: ${REMOVE_USERNAMES.length} username.\n`);

  // 1. Резолвим username → student_id/user_id/группа.
  const { data: candidates, error: candErr } = await db
    .from("students")
    .select("id, user_id, username, full_name, student_groups(group_id, groups(name))")
    .in("username", REMOVE_USERNAMES);
  if (candErr) fail(`Ошибка запроса students: ${candErr.message}`);

  console.log(`Найдено в БД по username: ${candidates.length} из ${EXPECTED_COUNT} ожидаемых.\n`);
  if (candidates.length !== EXPECTED_COUNT) {
    const foundUsernames = new Set(candidates.map((c) => c.username));
    const missing = REMOVE_USERNAMES.filter((u) => !foundUsernames.has(u));
    fail(`Найдено ${candidates.length}, ожидалось ${EXPECTED_COUNT}. Не найдены: ${missing.join(", ") || "(нет — возможно дубли username в БД)"}`);
  }

  // 2. Явная проверка пересечения с защищённым списком по резолвленным
  // данным из БД (не только по статическому массиву выше).
  const foundUsernamesSet = new Set(candidates.map((c) => c.username));
  const overlap = PROTECTED_USERNAMES.filter((p) => foundUsernamesSet.has(p));
  if (overlap.length > 0) {
    fail(`Резолвленный список пересекается с защищёнными username: ${overlap.join(", ")}`);
  }

  // 3. Любой резолвленный кандидат без user_id (auth-аккаунта) — тоже стоп,
  // deleteUser без него бессмыслен.
  const noUserId = candidates.filter((c) => !c.user_id);
  if (noUserId.length > 0) {
    fail(`У ${noUserId.length} кандидатов нет user_id: ${noUserId.map((c) => c.username).join(", ")}`);
  }

  // 4. Печатаем полный список для визуальной проверки менеджером.
  console.log("Кандидаты на удаление (username | ФИО | группа):");
  for (const c of [...candidates].sort((a, b) => a.username.localeCompare(b.username))) {
    const groupName = c.student_groups?.[0]?.groups?.name ?? "?";
    console.log(`  ${c.username} | ${c.full_name} | ${groupName}`);
  }
  console.log(`\nЗащищённые username (не должны встретиться выше): ${PROTECTED_USERNAMES.join(", ")}`);
  console.log("Проверка пересечения с защищёнными: OK, пересечений нет.\n");

  if (!CONFIRMED) {
    console.log("=== DRY-RUN ЗАВЕРШЁН ===");
    console.log(`Было бы удалено: ${candidates.length} аккаунтов (через supabase.auth.admin.deleteUser).`);
    console.log("Для реального удаления запустите: CONFIRM=YES node scripts/delete-66-students-trim-to-10.mjs");
    return;
  }

  // 5. Реальное удаление — по одному, с логом каждого результата.
  console.log("=== РЕАЛЬНОЕ УДАЛЕНИЕ НАЧАТО ===\n");
  let deleted = 0;
  const failures = [];
  for (const c of candidates) {
    const { error } = await db.auth.admin.deleteUser(c.user_id);
    if (error) {
      console.error(`  ОШИБКА: ${c.username} — ${error.message}`);
      failures.push({ username: c.username, error: error.message });
    } else {
      deleted++;
      console.log(`  OK: ${c.username} удалён`);
    }
  }

  console.log(`\n=== ИТОГ: удалено ${deleted}/${EXPECTED_COUNT} ===`);
  if (failures.length > 0) {
    console.log(`Ошибки (${failures.length}):`);
    for (const f of failures) console.log(`  ${f.username}: ${f.error}`);
  }

  const { count: remainingCount } = await db.from("students").select("id", { count: "exact", head: true });
  console.log(`\nВсего учеников в системе после удаления: ${remainingCount} (ожидается 30)`);
}

main().catch((e) => {
  console.error("Необработанная ошибка:", e?.message ?? e);
  process.exit(1);
});
