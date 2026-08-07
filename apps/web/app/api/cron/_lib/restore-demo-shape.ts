// Восстановление эталонной формы уроков демо-школы на неделе 27.07-02.08.2026.
//
// Зачем. Форма «1-й урок прошёл / 2-й идёт / 3-й и дальше ждут» расползается
// от живых демо-посетителей: они жмут «Начать урок» на произвольных днях. За
// два дня потребовалось три ручных пересчёта, в последнем 6 правок из 12
// пришлись на будущие дни. Миграция 173 закрыла старт за ПРОШЕДШИЕ дни, но
// 29.07 и позже стартовать по-прежнему можно (это демонстрируется клиентам),
// поэтому форма всё равно уезжает в течение дня — отсюда ночной откат.
//
// Отношение к apps/web/scripts/fix-lesson-statuses-frozen-week.mjs. Тот скрипт
// остаётся ops-инструментом «прогнать руками перед показом»; здесь ровно та же
// логика для крона. Общий код вынести целиком не вышло по одной причине: там
// .mjs с флагом --apply и печатью каждой строки в консоль, здесь — серверный
// модуль, возвращающий счётчики. Совпадающая часть — целевое состояние
// (targetFor) и ПОРЯДОК ФАЗ — продублирована сознательно и помечена в обоих
// файлах; расходиться они не должны.
//
// ПОРЯДОК ФАЗ ЖЁСТКИЙ. На lessons висит trg_close_other_in_progress_lessons
// (AFTER UPDATE OF status): переводя урок в in_progress, он ставит остальным
// in_progress-урокам ТОЙ ЖЕ ГРУППЫ status='completed' и ended_at = now() —
// а now() это настоящее время, которое засорит демо-данные реальными метками.
// Поэтому сначала гасим все остальные дни и слоты, и только последней фазой
// выставляем in_progress: к этому моменту закрывать триггеру уже нечего.
//
// Трогается ТОЛЬКО таблица lessons и только демо-школа. lesson_stages
// затрагивается косвенно, триггером trg_auto_activate_first_stage — по одной
// строке на каждый из 3 живых уроков (активный этап), это ожидаемо.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Демо-школа. Тот же id, что в scripts/_backfill-shared.mjs. */
export const DEMO_SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

const WEEK_FROM = "2026-07-27T00:00:00+05:00";
const WEEK_TO = "2026-08-03T00:00:00+05:00"; // exclusive

const PAST_DAYS = ["2026-07-27", "2026-07-28"];
const FROZEN_DAY = "2026-07-29";
const FUTURE_DAYS = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, фиксированное смещение

type LessonRow = {
  id: string;
  group_id: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

type Target = { status: string; started_at: string | null; ended_at: string | null };

/** Локальная (Ташкент) дата урока, YYYY-MM-DD. */
function tashkentDay(startsAtIso: string): string {
  return new Date(new Date(startsAtIso).getTime() + TZ_MS).toISOString().slice(0, 10);
}

/** Целевое состояние строки. Зеркалит targetFor() из fix-lesson-statuses-frozen-week.mjs. */
function targetFor(status: string, lesson: LessonRow): Target {
  if (status === "completed") return { status, started_at: lesson.starts_at, ended_at: lesson.ends_at };
  if (status === "in_progress") return { status, started_at: lesson.starts_at, ended_at: null };
  return { status: "scheduled", started_at: null, ended_at: null };
}

function needsChange(lesson: LessonRow, target: Target): boolean {
  return (
    lesson.status !== target.status ||
    (lesson.started_at ?? null) !== (target.started_at ?? null) ||
    (lesson.ended_at ?? null) !== (target.ended_at ?? null)
  );
}

export type RestoreResult = {
  changed: number;
  unchanged: number;
  byPhase: Record<string, number>;
  errors: string[];
};

/**
 * Приводит уроки демо-школы за неделю 27.07-02.08.2026 к эталонной форме.
 * Идемпотентно: повторный вызов на уже правильных данных не пишет ничего.
 */
export async function restoreDemoLessonShape(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
): Promise<RestoreResult> {
  const result: RestoreResult = { changed: 0, unchanged: 0, byPhase: {}, errors: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lessons")
    .select("id, group_id, starts_at, ends_at, status, started_at, ended_at")
    .eq("school_id", DEMO_SCHOOL_ID)
    .gte("starts_at", WEEK_FROM)
    .lt("starts_at", WEEK_TO)
    .order("starts_at");
  if (error) throw new Error(`read lessons: ${error.message}`);

  const lessons = (data ?? []) as LessonRow[];

  const applyOne = async (lesson: LessonRow, target: Target, phase: string) => {
    if (!needsChange(lesson, target)) {
      result.unchanged += 1;
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (db as any)
      .from("lessons")
      .update({ status: target.status, started_at: target.started_at, ended_at: target.ended_at })
      .eq("id", lesson.id);
    if (upErr) {
      result.errors.push(`${lesson.id}: ${upErr.message}`);
      return;
    }
    result.changed += 1;
    result.byPhase[phase] = (result.byPhase[phase] ?? 0) + 1;
  };

  const onDay = (day: string) => lessons.filter((l) => tashkentDay(l.starts_at) === day);

  // Слоты замороженного дня, по группам, отсортированные по времени — номер
  // слота считается ВНУТРИ ГРУППЫ, как в правиле 1/2/3+.
  const frozenByGroup = new Map<string, LessonRow[]>();
  for (const l of onDay(FROZEN_DAY)) {
    const arr = frozenByGroup.get(l.group_id) ?? [];
    arr.push(l);
    frozenByGroup.set(l.group_id, arr);
  }
  for (const arr of frozenByGroup.values()) {
    arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  // ФАЗА 1 — прошедшие дни -> completed. Раньше фазы 5 сознательно: если на
  // 27/28 остался дрейфнувший in_progress, его надо погасить ДО того, как
  // trg_close_other_in_progress_lessons получит повод закрыть его сам, с
  // ended_at = настоящий now().
  for (const day of PAST_DAYS) {
    for (const l of onDay(day)) await applyOne(l, targetFor("completed", l), "past");
  }

  // ФАЗА 2 — будущие дни -> scheduled.
  for (const day of FUTURE_DAYS) {
    for (const l of onDay(day)) await applyOne(l, targetFor("scheduled", l), "future");
  }

  // ФАЗА 3 — замороженный день, слоты 3+ -> scheduled.
  for (const arr of frozenByGroup.values()) {
    for (const l of arr.slice(2)) await applyOne(l, targetFor("scheduled", l), "frozen_slots_3plus");
  }

  // ФАЗА 4 — замороженный день, слот 1 -> completed.
  for (const arr of frozenByGroup.values()) {
    if (arr[0]) await applyOne(arr[0], targetFor("completed", arr[0]), "frozen_slot1");
  }

  // ФАЗА 5 — замороженный день, слот 2 -> in_progress. ПОСЛЕДНЕЙ.
  for (const arr of frozenByGroup.values()) {
    if (arr[1]) await applyOne(arr[1], targetFor("in_progress", arr[1]), "frozen_slot2");
  }

  return result;
}
