#!/usr/bin/env node
// Пачка «240 пустых уроков», ЧАСТЬ 2 — простановка кабинета всем урокам
// 18-31 июля 2026, у которых поле room ещё пусто. Чистый UPDATE, БЕЗ
// Gemini. Идемпотентно: WHERE room IS NULL — уже проставленные кабинеты
// не трогает, повторный запуск безопасен (0 rows на втором прогоне).
//
// Живой прогон в этой сессии (напрямую, без --confirm): 240 из 240 уроков
// имели room=NULL, всем проставлено "Кабинет 101"; повторный прогон
// подтверждённо обновляет 0 строк.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/set-lesson-rooms-jul18-31.mjs --dry-run
//   node --env-file=.env.local scripts/set-lesson-rooms-jul18-31.mjs --confirm

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFallback() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const envFallback = loadEnvFallback();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFallback.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFallback.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const argv = process.argv.slice(2);
const CONFIRM = argv.includes("--confirm");
const DRY_RUN = !CONFIRM || argv.includes("--dry-run");

const RANGE_START = "2026-07-18T00:00:00+05:00";
const RANGE_END_EXCLUSIVE = "2026-08-01T00:00:00+05:00";
const ROOM_VALUE = "Кабинет 101";

async function main() {
  const { count: emptyCount, error: countErr } = await db
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .gte("starts_at", RANGE_START)
    .lt("starts_at", RANGE_END_EXCLUSIVE)
    .is("room", null);
  if (countErr) throw new Error(`count check: ${countErr.message}`);
  console.log(`Уроков 18-31.07 с пустым room: ${emptyCount}`);

  if (emptyCount === 0) {
    console.log("Нечего делать — все уроки в диапазоне уже имеют кабинет.");
    return;
  }

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Было бы проставлено room="${ROOM_VALUE}" для ${emptyCount} уроков.`);
    return;
  }

  const { data: updated, error } = await db
    .from("lessons")
    .update({ room: ROOM_VALUE })
    .gte("starts_at", RANGE_START)
    .lt("starts_at", RANGE_END_EXCLUSIVE)
    .is("room", null)
    .select("id");
  if (error) throw new Error(`update: ${error.message}`);
  console.log(`Проставлено room="${ROOM_VALUE}" для ${updated.length} уроков.`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
