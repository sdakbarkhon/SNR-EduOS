#!/usr/bin/env node
// Пачка 4, Путь А — пересборка расписания 18-31 июля 2026 (14 дней подряд,
// ВСЕ учебные, включая выходные) в новой структуре: 45-минутные уроки,
// старт 09:00 Ташкент, 5/6/7 уроков в день по классам. Пустые слоты БЕЗ
// контента — генерация отдельным заходом, когда вернётся Gemini-квота.
//
// Запускать ПОСЛЕ apps/web/scripts/cleanup-lessons-jul18-31.sql (иначе
// идемпотентность просто пропустит уже существующие 18-31 уроки старой
// структуры вместо создания новых — визуально расписание не изменится).
//
// Новый файл — НЕ замена generate-lessons-jul19-25.mjs (тот устарел под
// старую 3×190мин структуру, заменяется отдельным следующим промтом).
// Переиспользует service-role auth паттерн backfill-historical.mjs /
// generate-lessons-jul19-25.mjs (anon+teacher_karim не годится — миграция
// 131 не даёт куратору писать НЕ-demo уроки/этапы).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-lesson-slots-jul18-31.mjs --dry-run
//   node --env-file=.env.local scripts/create-lesson-slots-jul18-31.mjs --confirm
//
// Аргументы:
//   --confirm    обязателен для боевого запуска; без него — dry-run
//   --dry-run    явный dry-run (тоже работает без --confirm)
//
// СХЕМА (подтверждено live-запросами в этой сессии):
//   - lessons: НЕТ updated_at, НЕТ teacher_id (выводится через subject_id ->
//     subjects.teacher_id). status='scheduled'.
//   - lesson_stages: каждый урок получает scaffolding (position=0
//     stage_role='start' title='Старт', position=9999 stage_role='summary'
//     title='Итог') — создаём вручную, как в generate-lessons-jul19-25.mjs
//     (обычный flow создания урока это делает сам, при прямом insert
//     скриптом — нет). БЕЗ middle-этапов — контент отдельным заходом.
//   - Все таблицы (lesson_stages, quiz_questions, ...) имеют NOT NULL
//     school_id — баг с его пропуском уже ловили в предыдущем скрипте
//     (см. resheniya_2.md), здесь передан на каждый INSERT сразу.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── env + client (service-role) ────────────────────────────────────────
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
  console.error("Запускай так: node --env-file=.env.local scripts/create-lesson-slots-jul18-31.mjs [--dry-run|--confirm]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
const CONFIRM = flag("confirm");
const EXPLICIT_DRY = flag("dry-run");
const DRY_RUN = !CONFIRM || EXPLICIT_DRY;
if (CONFIRM && EXPLICIT_DRY) {
  console.warn("Указаны и --confirm, и --dry-run одновременно — выигрывает dry-run (безопаснее).");
}

console.log("═".repeat(70));
console.log("Пачка 4, Путь А — создание пустых слотов уроков 2026-07-18..31");
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД)" : "БОЕВОЙ (пишем в БД)"}`);
console.log("═".repeat(70));

// ── предметы (короткие коды для компактности таблицы ротации) ───────────
const P = "Программирование", R = "Робототехника", M = "Математика", RU = "Русский язык", EN = "Английский язык";
const GROUPS = ["3-А класс", "7-А класс", "10-А класс"];

// ── тайминг: 7 слотов по 45 мин, старт 09:00 Ташкент (=04:00 UTC), ───────
// перемены 10 мин, большая перемена 20 мин после 3-го урока (п. ТЗ).
const SLOT_TIMES_UTC = ["04:00", "04:55", "05:50", "06:55", "07:50", "08:45", "09:40"];

const WEEKENDS = new Set(["2026-07-18", "2026-07-19", "2026-07-25", "2026-07-26"]);
const ALL_DAYS = [
  "2026-07-18", "2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
  "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31",
];

// ── ротация — спроектирована и провалидирована отдельно (240 слотов,
// Прог+Робот гарантированно ≥1/день/группу, Мат/Рус/Англ ≥1/неделю/группу,
// порядок варьируется по дням). Полная таблица — в отчёте. ────────────────
const G3_WEEKDAY = {
  "2026-07-20": [P, R, M, RU, EN],
  "2026-07-21": [R, P, M, EN, RU],
  "2026-07-22": [P, M, R, RU, EN],
  "2026-07-23": [M, P, R, EN, RU],
  "2026-07-24": [R, P, RU, M, EN],
  "2026-07-27": [P, R, EN, M, RU],
  "2026-07-28": [R, P, RU, EN, M],
  "2026-07-29": [P, EN, R, M, RU],
  "2026-07-30": [EN, P, R, RU, M],
  "2026-07-31": [R, P, M, EN, RU],
};
const G3_WEEKEND = {
  "2026-07-18": [P, R, M, RU],
  "2026-07-19": [R, P, RU, EN],
  "2026-07-25": [P, R, EN, M],
  "2026-07-26": [R, P, RU, M],
};
const G7_WEEKDAY = {
  "2026-07-20": [P, R, M, RU, EN, P],
  "2026-07-21": [R, P, M, EN, RU, R],
  "2026-07-22": [P, RU, R, M, EN, P],
  "2026-07-23": [R, M, P, EN, RU, R],
  "2026-07-24": [P, EN, R, RU, M, P],
  "2026-07-27": [R, P, M, RU, EN, R],
  "2026-07-28": [P, R, RU, EN, M, P],
  "2026-07-29": [R, M, P, RU, EN, R],
  "2026-07-30": [P, EN, R, M, RU, P],
  "2026-07-31": [R, RU, P, EN, M, R],
};
const G7_WEEKEND = {
  "2026-07-18": [P, R, M, RU, EN],
  "2026-07-19": [R, P, RU, EN, M],
  "2026-07-25": [P, EN, R, M, RU],
  "2026-07-26": [R, M, P, RU, EN],
};
const G10_WEEKDAY = {
  "2026-07-20": [P, R, M, RU, EN, P, R],
  "2026-07-21": [R, P, M, EN, RU, R, P],
  "2026-07-22": [P, M, R, RU, EN, P, R],
  "2026-07-23": [R, M, P, EN, RU, R, P],
  "2026-07-24": [P, RU, R, M, EN, P, R],
  "2026-07-27": [R, P, EN, M, RU, R, P],
  "2026-07-28": [P, R, RU, EN, M, P, R],
  "2026-07-29": [R, M, P, RU, EN, R, P],
  "2026-07-30": [P, EN, R, M, RU, P, R],
  "2026-07-31": [R, RU, P, EN, M, R, P],
};
const G10_WEEKEND = {
  "2026-07-18": [P, R, M, RU, EN, P],
  "2026-07-19": [R, P, RU, EN, M, R],
  "2026-07-25": [P, EN, R, M, RU, P],
  "2026-07-26": [R, M, P, RU, EN, R],
};

function subjectsForDay(date, group) {
  const isWeekend = WEEKENDS.has(date);
  if (group === "3-А класс") return isWeekend ? G3_WEEKEND[date] : G3_WEEKDAY[date];
  if (group === "7-А класс") return isWeekend ? G7_WEEKEND[date] : G7_WEEKDAY[date];
  return isWeekend ? G10_WEEKEND[date] : G10_WEEKDAY[date];
}

// ── план: разворачиваем ротацию в конкретные (date, group, time, subject) ──
function buildPlan() {
  const plan = [];
  for (const date of ALL_DAYS) {
    for (const group of GROUPS) {
      const subjects = subjectsForDay(date, group);
      subjects.forEach((subject, i) => {
        plan.push({ date, group, time: SLOT_TIMES_UTC[i], subject });
      });
    }
  }
  return plan;
}

async function main() {
  const startedAt = Date.now();
  const plan = buildPlan();
  console.log(`\nВсего слотов в плане: ${plan.length} (ожидание: 240)`);
  const byGroup = {};
  for (const p of plan) byGroup[p.group] = (byGroup[p.group] ?? 0) + 1;
  for (const [g, n] of Object.entries(byGroup)) console.log(`  ${g}: ${n}`);

  // ── справочники: группы + предметы (по имени+group_id, как в предыдущем скрипте) ──
  const { data: groups, error: gErr } = await db.from("groups").select("id, name");
  if (gErr) throw new Error(`groups: ${gErr.message}`);
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

  const { data: subjects, error: sErr } = await db.from("subjects").select("id, name, group_id").eq("is_stub", false);
  if (sErr) throw new Error(`subjects: ${sErr.message}`);
  const subjectIdByKey = new Map(subjects.map((s) => [`${s.name}|${s.group_id}`, s.id]));

  // ── идемпотентность: какие (group_id, starts_at) уже существуют ─────────
  const { data: existingLessons, error: exErr } = await db
    .from("lessons")
    .select("group_id, starts_at")
    .gte("starts_at", "2026-07-18T00:00:00+05:00")
    .lt("starts_at", "2026-08-01T00:00:00+05:00");
  if (exErr) throw new Error(`existing lessons check: ${exErr.message}`);
  const existingKeys = new Set((existingLessons ?? []).map((l) => `${l.group_id}|${l.starts_at}`));

  let created = 0, skipped = 0, errors = 0;
  let i = 0;
  for (const slot of plan) {
    i++;
    const groupId = groupIdByName.get(slot.group);
    const subjectId = subjectIdByKey.get(`${slot.subject}|${groupId}`);
    const logPrefix = `[${i}/${plan.length}] ${slot.group} · ${slot.date} · ${slot.time} · ${slot.subject}`;
    if (!groupId || !subjectId) {
      console.error(`${logPrefix} → ERROR (не нашли group/subject)`);
      errors++;
      continue;
    }
    const startsAt = `${slot.date}T${slot.time}:00+00:00`;
    const key = `${groupId}|${new Date(startsAt).toISOString()}`;

    if (existingKeys.has(key)) {
      console.log(`${logPrefix} → SKIPPED (уже есть)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${logPrefix} → [DRY-RUN] would CREATE`);
      created++;
      continue;
    }

    const endsAt = new Date(new Date(startsAt).getTime() + 45 * 60000).toISOString();
    const { data: inserted, error: insErr } = await db
      .from("lessons")
      .insert({
        group_id: groupId,
        subject_id: subjectId,
        school_id: SCHOOL_ID,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "scheduled",
        topic: slot.subject,
        title: slot.subject,
        duration_minutes: 45,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error(`${logPrefix} → ERROR (lesson insert: ${insErr.message})`);
      errors++;
      continue;
    }

    const { error: scaffoldErr } = await db.from("lesson_stages").insert([
      { lesson_id: inserted.id, school_id: SCHOOL_ID, position: 0, stage_role: "start", title: "Старт", config: {} },
      { lesson_id: inserted.id, school_id: SCHOOL_ID, position: 9999, stage_role: "summary", title: "Итог", config: {} },
    ]);
    if (scaffoldErr) {
      console.error(`${logPrefix} → PARTIAL (lesson создан, scaffold failed: ${scaffoldErr.message})`);
      errors++;
      continue;
    }

    existingKeys.add(key);
    console.log(`${logPrefix} → OK`);
    created++;
  }

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  console.log(`  ${DRY_RUN ? "Было бы создано" : "Создано"}: ${created}`);
  console.log(`  Пропущено (уже существовали): ${skipped}`);
  console.log(`  Ошибок: ${errors}`);
  console.log(`  Время выполнения: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
