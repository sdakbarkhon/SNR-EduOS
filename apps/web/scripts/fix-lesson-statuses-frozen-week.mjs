#!/usr/bin/env node
// Заказчик 06.08.2026 — привести статусы уроков демо-школы на неделе
// 27.07-02.08.2026 в соответствие с замороженным «сегодня» = среда
// 29.07.2026 **10:15** Ташкент (apps/web/lib/demo-date.ts).
//
// 07.08.2026 — якорь сдвинут с 10:50 на 10:15. На логику этого скрипта сдвиг
// не влияет: форма задаётся ПОРЯДКОВЫМ НОМЕРОМ слота внутри группы, а не
// сравнением с якорем, — но комментарий поправлен, чтобы не создавалось
// впечатление, будто якорь всё ещё стоит на границе слота (это и было
// причиной расхождения `>=` / `>`, см. demo-date.ts).
//
// Зачем: заморозку UI поставили 05.08, но статусы в БД остались от реального
// времени — крон morning-lesson-cycle тикал до отключения и пометил прошлые
// дни completed. Заказчик открывал замороженную среду и видел день, где ВСЕ
// 18 уроков уже завершены, без единого живого.
//
// ЗАПУСК (из apps/web):
//   node scripts/fix-lesson-statuses-frozen-week.mjs           # DRY-RUN, ничего не пишет
//   node scripts/fix-lesson-statuses-frozen-week.mjs --apply   # реальная запись
//
// ЦЕЛЕВОЕ СОСТОЯНИЕ
//   27.07, 28.07 (прошлое)  — все completed. НЕ ТРОГАЕМ, только проверяем.
//   29.07 (замороженное «сегодня») — правило 1/2/3+ ВНУТРИ КАЖДОЙ ГРУППЫ:
//       слот 1 -> completed, слот 2 -> in_progress, слоты 3-6 -> scheduled.
//       По школе: 3 completed + 3 in_progress + 12 scheduled.
//   30.07-02.08 (будущее)   — все scheduled.
//
// СОПУТСТВУЮЩИЕ ПОЛЯ
//   completed   -> started_at = starts_at, ended_at = ends_at
//   in_progress -> started_at = starts_at, ended_at = NULL
//   scheduled   -> started_at = NULL,      ended_at = NULL
//
// ───────────────────────── ТРИГГЕРЫ: что учтено ─────────────────────────
// На public.lessons висит 9 триггеров, четыре из них влияют на этот скрипт.
//
// 1) trg_compute_lesson_end — BEFORE INSERT OR UPDATE **OF starts_at,
//    duration_minutes**. Важно: он срабатывает ТОЛЬКО если одна из этих двух
//    колонок присутствует в UPDATE. То есть «явно указать duration_minutes=45
//    для защиты» — на самом деле ровно то, что его будит, а не то, что его
//    предотвращает. Мы всё равно указываем duration_minutes: 45 (так просил
//    заказчик), и это безопасно, потому что живой проверкой подтверждено —
//    у ВСЕХ 126 уроков недели duration_minutes уже = 45 и
//    ends_at уже = starts_at + 45 мин, значит пересчёт даёт то же самое
//    значение. Это no-op, а не защита. Настоящая защита была бы обратной —
//    не включать эти колонки в UPDATE вовсе.
//
// 2) trg_close_other_in_progress_lessons — AFTER UPDATE OF status. При
//    переходе урока в in_progress ставит остальным in_progress-урокам ТОЙ ЖЕ
//    ГРУППЫ status='completed', ended_at = now() — а now() это НАСТОЯЩИЕ
//    06.08, что засрало бы данные реальными метками. Поэтому порядок фаз в
//    этом скрипте жёсткий: сначала гасим будущие дни и слоты 3-6 в
//    scheduled, и только ПОТОМ выставляем in_progress на 29.07. К моменту
//    выставления in_progress в группе не остаётся ни одного другого
//    in_progress, и триггер не находит что закрывать.
//
// 3) trg_auto_activate_first_stage (BEFORE UPDATE) + trg_mark_stage_activated
//    (AFTER UPDATE OF active_stage_id) — при переходе в in_progress урок
//    получает active_stage_id первого middle-этапа, а тот этап получает
//    was_activated = true в lesson_stages. Это ЕДИНСТВЕННОЕ касание
//    lesson_stages во всём прогоне: ровно 3 строки, по одной на живой урок.
//    Заказчик подтвердил, что это допустимо (иначе у идущего урока не было
//    бы активного этапа). Отключать триггеры мы не будем.
//
// 4) trg_lesson_completed_to_kb — AFTER UPDATE OF status, срабатывает только
//    на ПЕРЕХОДЕ в completed (OLD.status IS DISTINCT FROM 'completed').
//    Слот 1 на 29.07 уже completed, так что перехода нет и триггер молчит.
//
// ───────────────────────── Что НЕ трогаем ─────────────────────────
// Только таблица lessons и только демо-школа. lesson_stages (кроме побочного
// was_activated выше), homework, attendance, lesson_grades, реальная школа
// b0b0b0b0-... — не трогаются вообще.

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const APPLY = process.argv.includes("--apply");

const WEEK_FROM = "2026-07-27T00:00:00+05:00";
const WEEK_TO = "2026-08-03T00:00:00+05:00"; // exclusive

const PAST_DAYS = ["2026-07-27", "2026-07-28"];
const TODAY = "2026-07-29";
const FUTURE_DAYS = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];

const db = makeServiceRoleClient();

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

/** Локальная (Ташкент, UTC+5) дата урока в формате YYYY-MM-DD. */
function tashkentDay(startsAtIso) {
  return new Date(new Date(startsAtIso).getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Локальное HH:MM для лога. */
function tashkentTime(startsAtIso) {
  return new Date(new Date(startsAtIso).getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(11, 16);
}

/** Целевое состояние строки: {status, started_at, ended_at}. */
function targetFor(status, lesson) {
  if (status === "completed") return { status, started_at: lesson.starts_at, ended_at: lesson.ends_at };
  if (status === "in_progress") return { status, started_at: lesson.starts_at, ended_at: null };
  return { status: "scheduled", started_at: null, ended_at: null };
}

function needsChange(lesson, target) {
  return (
    lesson.status !== target.status ||
    (lesson.started_at ?? null) !== (target.started_at ?? null) ||
    (lesson.ended_at ?? null) !== (target.ended_at ?? null)
  );
}

async function applyOne(lesson, target, label) {
  const before = `${lesson.status}/${lesson.started_at ? "S" : "-"}${lesson.ended_at ? "E" : "-"}`;
  const after = `${target.status}/${target.started_at ? "S" : "-"}${target.ended_at ? "E" : "-"}`;
  if (!needsChange(lesson, target)) {
    console.log(`      = ${label}  ${before}  (без изменений)`);
    return false;
  }
  console.log(`   ${APPLY ? "->" : " ~"} ${label}  ${before}  =>  ${after}`);
  if (!APPLY) return true;

  const { error } = await db
    .from("lessons")
    .update({
      status: target.status,
      started_at: target.started_at,
      ended_at: target.ended_at,
      // см. пункт 1 в шапке — no-op пересчёт ends_at, не защита
      duration_minutes: 45,
    })
    .eq("id", lesson.id);
  if (error) fail(`UPDATE ${lesson.id} (${label}): ${error.message}`);
  return true;
}

async function main() {
  console.log(
    `Пересчёт статусов уроков демо-школы под замороженное «сегодня» = ${TODAY} 10:15 Ташкент`,
  );
  console.log(APPLY ? "РЕЖИМ: --apply (реальная запись)\n" : "РЕЖИМ: DRY-RUN (ничего не пишется)\n");

  const { data: groups, error: gErr } = await db
    .from("groups")
    .select("id, name")
    .eq("school_id", SCHOOL_ID);
  if (gErr) fail(`groups: ${gErr.message}`);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, group_id, starts_at, ends_at, status, started_at, ended_at, duration_minutes")
    .eq("school_id", SCHOOL_ID)
    .gte("starts_at", WEEK_FROM)
    .lt("starts_at", WEEK_TO)
    .order("starts_at", { ascending: true });
  if (lErr) fail(`lessons: ${lErr.message}`);

  // ── Санити-проверки структуры (стоп-условия заказчика) ──
  const byDay = new Map();
  for (const l of lessons) {
    const d = tashkentDay(l.starts_at);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(l);
  }
  const expectedDays = [...PAST_DAYS, TODAY, ...FUTURE_DAYS];
  for (const d of expectedDays) {
    const rows = byDay.get(d) ?? [];
    if (rows.length !== 18) fail(`на ${d} ожидалось 18 уроков, найдено ${rows.length}`);
    const gset = new Set(rows.map((r) => r.group_id));
    if (gset.size !== 3) fail(`на ${d} ожидалось 3 группы, найдено ${gset.size}`);
  }
  const badDur = lessons.filter((l) => l.duration_minutes !== 45);
  if (badDur.length) fail(`${badDur.length} уроков с duration_minutes != 45 — разберись до записи`);
  console.log(`Проверка структуры: 7 дней × 18 уроков × 3 группы, duration_minutes=45 везде. OK.\n`);

  const stats = {};
  const bump = (day, changed) => {
    stats[day] ??= { changed: 0, same: 0 };
    stats[day][changed ? "changed" : "same"]++;
  };

  // ── ФАЗА 0: прошлые дни — только проверка, без записи ──
  console.log("── ФАЗА 0: 27.07 и 28.07 (прошлое) — проверка, НЕ трогаем ──");
  for (const day of PAST_DAYS) {
    const rows = byDay.get(day) ?? [];
    const notCompleted = rows.filter((r) => r.status !== "completed");
    if (notCompleted.length === 0) {
      console.log(`   ${day}: все 18 completed. OK.`);
    } else {
      console.log(
        `   ${day}: ВНИМАНИЕ — ${notCompleted.length} уроков не completed (${[...new Set(notCompleted.map((r) => r.status))].join(", ")}). По ТЗ не меняем, только флагую.`,
      );
    }
    stats[day] = { changed: 0, same: rows.length };
  }

  // ── ФАЗА 1: будущие дни -> scheduled (ДО in_progress, см. пункт 2 шапки) ──
  console.log("\n── ФАЗА 1: 30.07-02.08 (будущее) -> scheduled ──");
  for (const day of FUTURE_DAYS) {
    const rows = (byDay.get(day) ?? []).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    console.log(`   ${day}:`);
    for (const l of rows) {
      const label = `${groupName.get(l.group_id) ?? "?"} ${tashkentTime(l.starts_at)}`;
      const changed = await applyOne(l, targetFor("scheduled", l), label);
      bump(day, changed);
    }
  }

  // ── ФАЗА 2: 29.07, слоты 3-6 -> scheduled (тоже ДО in_progress) ──
  const todayRows = byDay.get(TODAY) ?? [];
  const byGroup = new Map();
  for (const l of todayRows) {
    if (!byGroup.has(l.group_id)) byGroup.set(l.group_id, []);
    byGroup.get(l.group_id).push(l);
  }
  for (const arr of byGroup.values()) arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  console.log(`\n── ФАЗА 2: ${TODAY} слоты 3-6 -> scheduled ──`);
  for (const [gid, arr] of byGroup) {
    for (let i = 2; i < arr.length; i++) {
      const l = arr[i];
      const label = `${groupName.get(gid) ?? "?"} слот${i + 1} ${tashkentTime(l.starts_at)}`;
      bump(TODAY, await applyOne(l, targetFor("scheduled", l), label));
    }
  }

  // ── ФАЗА 3: 29.07, слот 1 -> completed ──
  console.log(`\n── ФАЗА 3: ${TODAY} слот 1 -> completed ──`);
  for (const [gid, arr] of byGroup) {
    const l = arr[0];
    if (!l) continue;
    const label = `${groupName.get(gid) ?? "?"} слот1 ${tashkentTime(l.starts_at)}`;
    bump(TODAY, await applyOne(l, targetFor("completed", l), label));
  }

  // ── ФАЗА 4: 29.07, слот 2 -> in_progress (ПОСЛЕДНЕЙ, см. пункт 2 шапки) ──
  console.log(`\n── ФАЗА 4: ${TODAY} слот 2 -> in_progress (последней фазой) ──`);
  for (const [gid, arr] of byGroup) {
    const l = arr[1];
    if (!l) continue;
    const label = `${groupName.get(gid) ?? "?"} слот2 ${tashkentTime(l.starts_at)}`;
    bump(TODAY, await applyOne(l, targetFor("in_progress", l), label));
  }

  // ── Summary ──
  console.log("\n════════ ИТОГО ════════");
  let total = 0;
  for (const day of expectedDays) {
    const s = stats[day] ?? { changed: 0, same: 0 };
    total += s.changed;
    const note = PAST_DAYS.includes(day) ? " (не трогаем)" : "";
    console.log(`   ${day}: изменено ${s.changed}, без изменений ${s.same}${note}`);
  }
  console.log(`   ВСЕГО ${APPLY ? "изменено" : "будет изменено"}: ${total} уроков`);
  if (!APPLY) console.log("\nDRY-RUN. Для реальной записи: --apply");
}

main().catch((e) => fail(e.stack ?? String(e)));
