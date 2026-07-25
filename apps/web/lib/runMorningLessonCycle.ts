// Общий модуль "утренний цикл уроков" — переиспользуется:
//   1) apps/web/app/api/cron/morning-lesson-cycle/route.ts — Vercel Cron
//      в 04:00 UTC (= 09:00 Ташкент), гарантированный запуск раз в день;
//   2) apps/web/lib/ensureMorningCycleRan.ts — фолбэк из RSC при загрузке
//      страниц уроков/расписания, на случай если крон не отработал или
//      человек зашёл до крона (в тесте).
//
// Логика на КАЖДЫЙ из 3 классов (10-А / 7-А / 3-А):
//   a) Взять сегодняшние (Ташкент) уроки, сортировка по starts_at.
//   b) Если первый ещё не 'completed' — закрыть его (completeLessons: перевод
//      в completed + upsert посещаемости и оценок).
//   c) Если есть второй И он всё ещё 'scheduled' — стартовать
//      (status='in_progress', started_at=now()), guard AND status='scheduled'
//      (идемпотентно — уже in_progress/completed не трогает).
//
// Возвращает список действий для логирования — вызов из cron-роута
// сериализует его в ответ, вызов из RSC-фолбэка просто пишет в console.

import type { SupabaseClient } from "@supabase/supabase-js";
import { completeLessons } from "@/app/api/cron/_lib/complete-lessons";

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, UTC+5

// Целевые классы — фиксированный список, тот же, что в migration 97.
// Если появятся новые классы, добавить сюда (или брать из БД по признаку).
const TARGET_GROUP_NAMES = ["10-А класс", "7-А класс", "3-А класс"] as const;

/** [today_start_iso, today_end_iso] по Ташкенту (UTC+5), выраженные в UTC. */
export function tashkentTodayWindow(nowMs: number = Date.now()): { start: string; end: string } {
  const tashkentNow = new Date(nowMs + TZ_MS);
  const startMs =
    Date.UTC(tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate()) - TZ_MS;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

export interface MorningActionLog {
  group_id: string;
  group_name: string;
  first_lesson_id: string | null;
  first_closed: boolean;
  second_lesson_id: string | null;
  second_started: boolean;
  note?: string;
}

export interface MorningCycleResult {
  processed_groups: number;
  actions: MorningActionLog[];
  window: { start: string; end: string };
}

export async function runMorningLessonCycle(admin: SupabaseClient): Promise<MorningCycleResult> {
  const window = tashkentTodayWindow();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: groupsRows, error: gErr } = await db.from("groups")
    .select("id, name").in("name", TARGET_GROUP_NAMES as unknown as string[]);
  if (gErr) throw new Error(`groups read: ${gErr.message}`);
  const groups = (groupsRows ?? []) as Array<{ id: string; name: string }>;

  const actions: MorningActionLog[] = [];

  for (const group of groups) {
    // Первые два урока дня по расписанию, отсортированные по времени.
    const { data: lessonRows, error: lErr } = await db.from("lessons")
      .select("id, starts_at, status")
      .eq("group_id", group.id)
      .gte("starts_at", window.start)
      .lt("starts_at", window.end)
      .order("starts_at", { ascending: true })
      .limit(2);
    if (lErr) {
      actions.push({
        group_id: group.id, group_name: group.name,
        first_lesson_id: null, first_closed: false,
        second_lesson_id: null, second_started: false,
        note: `lessons read failed: ${lErr.message}`,
      });
      continue;
    }
    const lessons = (lessonRows ?? []) as Array<{ id: string; starts_at: string; status: string }>;

    if (lessons.length === 0) {
      actions.push({
        group_id: group.id, group_name: group.name,
        first_lesson_id: null, first_closed: false,
        second_lesson_id: null, second_started: false,
        note: "no lessons today",
      });
      continue;
    }

    // lessons.length >= 1 гарантирован guard'ом выше — first точно есть.
    const first = lessons[0]!;
    const second = lessons[1] ?? null;

    // a) Закрыть первый, если он ещё не завершён (start-of-day → completed +
    //    attendance/grades). completeLessons() внутри гварден neq='completed'
    //    и возвращает closed=0 для уже закрытых — этот if нужен только чтобы
    //    отчёт про first_closed был правдивым, а не всегда true.
    let firstClosed = false;
    if (first.status !== "completed") {
      try {
        const res = await completeLessons(admin, [first.id]);
        firstClosed = res.closed > 0;
      } catch (e) {
        actions.push({
          group_id: group.id, group_name: group.name,
          first_lesson_id: first.id, first_closed: false,
          second_lesson_id: second?.id ?? null, second_started: false,
          note: `completeLessons failed: ${(e as Error)?.message ?? e}`,
        });
        continue;
      }
    }

    // b) Стартовать второй, если он есть И ещё scheduled. Guard в WHERE
    //    (status='scheduled') делает операцию идемпотентной — уже
    //    in_progress/completed не тронется.
    let secondStarted = false;
    if (second && second.status === "scheduled") {
      const { data: startedRows, error: sErr } = await db.from("lessons")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", second.id)
        .eq("status", "scheduled")
        .select("id");
      if (sErr) {
        actions.push({
          group_id: group.id, group_name: group.name,
          first_lesson_id: first.id, first_closed: firstClosed,
          second_lesson_id: second.id, second_started: false,
          note: `start second failed: ${sErr.message}`,
        });
        continue;
      }
      secondStarted = (startedRows?.length ?? 0) > 0;
    }

    actions.push({
      group_id: group.id, group_name: group.name,
      first_lesson_id: first.id, first_closed: firstClosed,
      second_lesson_id: second?.id ?? null, second_started: secondStarted,
    });
  }

  return {
    processed_groups: groups.length,
    actions,
    window,
  };
}
