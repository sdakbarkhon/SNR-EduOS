#!/usr/bin/env node
// 09.08.2026 — ХОЛОСТОЙ ПРОГОН НОЧНОГО ОТКАТА. Только чтение, ничего не
// удаляет и не меняет.
//
// Повторяет отбор из app/api/cron/_lib/restore-demo-shape.ts:
//   1) purgeNonBaseline — что механизм счёл бы «лишним» и удалил;
//   2) фазы формы — сколько уроков он бы переписал.
// Здоровое состояние после восстановления: и то и другое ноль.
//
// ЧТЕНИЕ СНИМКА — ПОСТРАНИЧНОЕ, со сверкой с точным count. Именно эта деталь
// стоила 49 уроков 08.08: обычный select молча вернул 1000 строк из 1217,
// и недостающие 217 идентификаторов механизм счёл лишними. Здесь проверка
// повторена ровно в том же виде — если снимок прочитан не целиком, скрипт
// говорит об этом вместо того, чтобы делать выводы по обрезку.
//
// ЗАПУСК (из apps/web):
//   node scripts/check-demo-rollback-dry.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const D = SCHOOL_ID;
const PAGE = 1000;

const WEEK_FROM = "2026-07-27T00:00:00+05:00";
const WEEK_TO = "2026-08-03T00:00:00+05:00";
const PAST_DAYS = ["2026-07-27", "2026-07-28"];
const FROZEN_DAY = "2026-07-29";
const FUTURE_DAYS = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
const PURGE_ORDER = ["lesson", "lesson_stage", "lesson_material", "homework"];
const PURGE_TABLE = { lesson: "lessons", lesson_stage: "lesson_stages", lesson_material: "lesson_materials", homework: "homework" };

const tashkentDay = (iso) => new Date(new Date(iso).getTime() + 5 * 3600e3).toISOString().slice(0, 10);
const fail = (msg) => { console.error(`\n!!! ${msg}`); process.exit(1); };

console.log("ХОЛОСТОЙ ПРОГОН ОТКАТА — только чтение\n");

// ── 1. снимок, постранично + сверка с count ─────────────────────────────────
const { count: baselineCount, error: cErr } = await db
  .from("demo_baseline").select("entity_id", { count: "exact", head: true }).eq("school_id", D);
if (cErr) fail(`count снимка: ${cErr.message}`);

const rows = [];
for (let from = 0; from < (baselineCount ?? 0); from += PAGE) {
  const { data, error } = await db
    .from("demo_baseline").select("entity_type, entity_id").eq("school_id", D)
    .order("entity_id").range(from, from + PAGE - 1);
  if (error) fail(`чтение снимка: ${error.message}`);
  rows.push(...(data ?? []));
}
console.log(`Снимок: count говорит ${baselineCount}, прочитано ${rows.length}`);
if (rows.length !== baselineCount) fail(`снимок прочитан не целиком — механизм в этом случае НИЧЕГО не удаляет и пишет ошибку`);
if (rows.length < 500) fail(`в снимке ${rows.length} записей (<500) — механизм пропустил бы удаление`);

const byType = new Map(PURGE_ORDER.map((t) => [t, new Set()]));
for (const r of rows) byType.get(r.entity_type)?.add(r.entity_id);
console.log("в снимке по видам:", JSON.stringify(Object.fromEntries(PURGE_ORDER.map((t) => [t, byType.get(t).size]))));

// ── 2. что механизм счёл бы лишним ──────────────────────────────────────────
const { data: lessonRows, error: lErr } = await db.from("lessons").select("id").eq("school_id", D);
if (lErr) fail(`чтение уроков: ${lErr.message}`);
const lessonIds = lessonRows.map((l) => l.id);

/** Постраничное чтение — таблиц с >1000 строк тут две, и обрезок дал бы
 *  ровно ту же ложную картину «лишнего», что и в аварию. */
async function readAll(table, column, values) {
  const out = [];
  for (let i = 0; i < values.length; i += 40) {
    const chunk = values.slice(i, i + 40);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select("id").in(column, chunk).order("id").range(from, from + PAGE - 1);
      if (error) fail(`чтение ${table}: ${error.message}`);
      out.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }
  }
  return out;
}

const report = [];
for (const type of PURGE_ORDER) {
  const keep = byType.get(type);
  let present;
  if (type === "lesson") present = lessonRows;
  else if (type === "homework") {
    const { data, error } = await db.from("homework").select("id").eq("school_id", D);
    if (error) fail(`чтение homework: ${error.message}`);
    present = data ?? [];
  } else present = await readAll(PURGE_TABLE[type], "lesson_id", lessonIds);

  const presentIds = present.map((r) => r.id);
  const extra = presentIds.filter((id) => !keep.has(id));
  const missing = [...keep].filter((id) => !presentIds.includes(id));
  report.push({ вид: type, в_базе: presentIds.length, в_снимке: keep.size, удалил_бы: extra.length, нет_в_базе: missing.length });
}

console.log("\n── ЧТО СДЕЛАЛ БЫ ОТКАТ ──");
console.table(report);

const wouldDelete = report.reduce((a, r) => a + r.удалил_бы, 0);
const stale = report.reduce((a, r) => a + r.нет_в_базе, 0);

// ── 3. форма ────────────────────────────────────────────────────────────────
const { data: lessons, error: wErr } = await db
  .from("lessons").select("id, group_id, starts_at, ends_at, status, started_at, ended_at")
  .eq("school_id", D).gte("starts_at", WEEK_FROM).lt("starts_at", WEEK_TO).order("starts_at");
if (wErr) fail(`чтение недели: ${wErr.message}`);

const targetFor = (status, l) =>
  status === "completed" ? { status, started_at: l.starts_at, ended_at: l.ends_at }
  : status === "in_progress" ? { status, started_at: l.starts_at, ended_at: null }
  : { status: "scheduled", started_at: null, ended_at: null };
const needsChange = (l, t) =>
  l.status !== t.status || (l.started_at ?? null) !== (t.started_at ?? null) || (l.ended_at ?? null) !== (t.ended_at ?? null);

const frozenByGroup = new Map();
for (const l of lessons.filter((x) => tashkentDay(x.starts_at) === FROZEN_DAY)) {
  if (!frozenByGroup.has(l.group_id)) frozenByGroup.set(l.group_id, []);
  frozenByGroup.get(l.group_id).push(l);
}
for (const arr of frozenByGroup.values()) arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

let shapeChanges = 0;
for (const l of lessons) {
  const day = tashkentDay(l.starts_at);
  let want;
  if (PAST_DAYS.includes(day)) want = "completed";
  else if (FUTURE_DAYS.includes(day)) want = "scheduled";
  else {
    const arr = frozenByGroup.get(l.group_id) ?? [];
    const idx = arr.findIndex((x) => x.id === l.id);
    want = idx === 0 ? "completed" : idx === 1 ? "in_progress" : "scheduled";
  }
  if (needsChange(l, targetFor(want, l))) shapeChanges++;
}

console.log(`\nУроков, которым откат переписал бы форму: ${shapeChanges} (из ${lessons.length})`);

// ── итог ────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
if (wouldDelete === 0 && shapeChanges === 0 && stale === 0) {
  console.log("ЧИСТО: откат удалил бы 0 записей и не изменил бы ни одного урока.");
  console.log("Снимок описывает ровно текущее состояние — механизм можно включать.");
} else {
  if (wouldDelete > 0) console.log(`ВНИМАНИЕ: откат удалил бы ${wouldDelete} записей — снимок не соответствует базе.`);
  if (stale > 0) console.log(`ВНИМАНИЕ: ${stale} записей снимка отсутствуют в базе — снимок устарел.`);
  if (shapeChanges > 0) console.log(`ВНИМАНИЕ: ${shapeChanges} уроков не в эталонной форме.`);
  console.log("Механизм включать НЕЛЬЗЯ, пока это не сойдётся в ноль.");
  process.exit(1);
}
