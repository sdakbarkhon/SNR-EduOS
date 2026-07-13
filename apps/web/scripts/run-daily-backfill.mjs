#!/usr/bin/env node
// Промт 7.4 Часть 4 — общий раннер: прогоняет все backfill-*.mjs за
// диапазон дат одной командой. Каждый под-скрипт сам идемпотентен
// (пропускает уже наполненное), так что повторный запуск раннера безопасен.
//
// Гейт по "реально прошло" (хотфикс после Промта 7.4) живёт внутри каждого
// под-скрипта — toDate можно смело передавать далеко в будущее (например,
// до конца расписания), раннер не сгенерирует данные на ещё не наступившие
// уроки/дни, они просто останутся в очереди на следующий запуск.
//
// node run-daily-backfill.mjs [fromDate] [toDate]

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeServiceRoleClient } from "./_backfill-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fromDate = process.argv[2] ?? "2026-07-13";
const toDate = process.argv[3] ?? "2026-07-25";

const STEPS = [
  { name: "backfill-grades.mjs", args: [fromDate, toDate] },
  { name: "backfill-attendance.mjs", args: [fromDate, toDate] },
  { name: "backfill-homework.mjs", args: [] }, // не зависит от диапазона — обрабатывает всё ДЗ, идемпотентно (см. комментарий в файле)
  { name: "backfill-announcements.mjs", args: [fromDate, toDate] },
  { name: "backfill-chat-messages.mjs", args: [fromDate, toDate] },
];

async function countTable(db, table) {
  const { count } = await db.from(table).select("id", { count: "exact", head: true });
  return count ?? null;
}

async function main() {
  const db = makeServiceRoleClient();
  const tables = ["lesson_grades", "attendance", "homework_submissions", "announcements", "chat_messages"];
  const before = {};
  for (const t of tables) before[t] = await countTable(db, t);

  console.log(`=== Промт 7.4: ежедневное наполнение платформы, ${fromDate}..${toDate} ===`);
  for (const { name, args } of STEPS) {
    console.log(`\n--- ${name}${args.length ? " " + args.join(" ") : ""} ---`);
    try {
      execFileSync(process.execPath, [path.join(__dirname, name), ...args], { stdio: "inherit" });
    } catch (e) {
      console.error(`!! ${name} завершился с ошибкой: ${e.message}`);
    }
  }

  console.log(`\n=== SQL COUNT: до → после ===`);
  for (const t of tables) {
    const after = await countTable(db, t);
    console.log(`  ${t}: ${before[t]} → ${after} (+${after - before[t]})`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
