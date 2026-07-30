// Ночной крон (решение 21.07) — с отключённым авто-стартом/авто-финишем
// по времени (см. миграция 143) уроки прошедших дней, которые учитель не
// начал/не закончил вручную, никогда бы сами не перешли в 'completed'.
// Раз в сутки в 19:00 UTC (= 00:00 по Ташкенту, см. vercel.json) закрывает
// их одним UPDATE — по времени (ends_at), НЕ по статусу, только уроки СТРОГО
// прошедших дней (сегодняшние и будущие не трогает).
//
// Гейт: ends_at < начало сегодняшнего дня по Ташкенту (UTC+5) И status !=
// 'completed'. Идемпотентно по конструкции.
//
// ЧАСТЬ 4 (расширение): раньше побочные эффекты автозавершения (посещаемость
// + оценки за урок) проставляла fn_auto_end_lessons(), отключённая миграцией
// 143. Из-за этого у учеников не появлялись посещаемость и оценки. Теперь
// крон ДОПОЛНИТЕЛЬНО досоздаёт для НЕДАВНО прошедших уроков (окно ~3 дня):
//   - attendance: present≈90% / absent_unexcused≈8% / absent_excused≈2%;
//   - lesson_grades: ~35% ПРИСУТСТВОВАВШИХ, распределение 5≈30/4≈40/3≈25/2≈5.
// Всё кодом (без AI), идемпотентно (пропускает существующие (student,lesson)),
// school_id задаётся ЯВНО из данных (реф миграция 71), гейт по времени.
//
// РЕФАКТОР: генерация посещаемости/оценок и сам UPDATE lessons вытащены в
// apps/web/app/api/cron/_lib/complete-lessons.ts — теперь их переиспользуют
// и утренний крон, и endpoint start-with-close-previous. Здесь остаётся
// специфика "прошедших суток": (1) закрываем ВСЁ, чей ends_at < cutoff,
// одним `.in()`-списком через completeLessons(), а не только окно; (2) fill
// докатывается на окно (~3 дня) ретроспективно, чтобы подхватить уроки,
// закрытые вручную учителем без attendance/оценок.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeLessons, fillAttendanceAndGrades } from "../_lib/complete-lessons";

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, UTC+5 — фиксированное смещение, не системный часовой пояс
const RECENT_WINDOW_DAYS = 3; // насколько назад крон досоздаёт посещаемость/оценки

function startOfTodayTashkentUtcIso(): string {
  const nowUtc = new Date();
  const tashkentNow = new Date(nowUtc.getTime() + TZ_MS);
  const tashkentMidnightUtcMs =
    Date.UTC(tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate()) - TZ_MS;
  return new Date(tashkentMidnightUtcMs).toISOString();
}

/** Большой фикс: React #310 + заморозка даты + cron, Фикс 3 — школы с
 *  schools.nightly_close_enabled=false (демо-школа) исключаются из
 *  ежесуточного авто-закрытия, чтобы демо-уроки не улетали в 'completed' в
 *  полночь. Колонка добавлена миграцией 156_schools_nightly_close_enabled.sql,
 *  которая НЕ применена к прод-базе этим заходом (нет DDL-доступа в этой
 *  среде — см. миграцию). Пока колонки нет, select на неё падает с 42703 —
 *  деградируем к старому поведению (никого не исключаем), а не роняем крон
 *  целиком: реальная школа не должна пострадать из-за неприменённой
 *  миграции. После применения 156 подхватывается автоматически, без правок
 *  кода. */
async function getExcludedSchoolIds(db: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("schools").select("id").eq("nightly_close_enabled", false);
  if (error) {
    if (error.code !== "42703") {
      console.error("[close-past-lessons] excluded schools read failed:", error.message);
    }
    return new Set();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Set((data ?? []).map((r: any) => r.id as string));
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = startOfTodayTashkentUtcIso();
  const excludedSchoolIds = await getExcludedSchoolIds(db);

  // 1. Собрать id уроков строго прошедших дней, не в 'completed', кроме школ
  //    с nightly_close_enabled=false (демо). completeLessons() потом сам
  //    сделает UPDATE (guarded neq='completed' внутри) и fill только для
  //    тех, кого реально переключил.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pastRows, error: pastErr } = await (db as any).from("lessons")
    .select("id, school_id").lt("ends_at", cutoff).neq("status", "completed");
  if (pastErr) {
    console.error("[close-past-lessons] past lessons read failed:", pastErr.message);
    return NextResponse.json({ error: pastErr.message }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pastIds: string[] = (pastRows ?? [])
    .filter((r: any) => !excludedSchoolIds.has(r.school_id))
    .map((r: any) => r.id);

  let closed = 0;
  let closeAttCreated = 0;
  let closeGradesCreated = 0;
  try {
    const res = await completeLessons(db, pastIds);
    closed = res.closed;
    closeAttCreated = res.attendanceCreated;
    closeGradesCreated = res.gradesCreated;
  } catch (e) {
    console.error("[close-past-lessons] completeLessons failed:", (e as Error)?.message ?? e);
    return NextResponse.json({ error: (e as Error)?.message ?? "completeLessons failed" }, { status: 500 });
  }

  // 2. Ретроспективный fill по окну (~3 дня): подхватываем уроки, закрытые
  //    вручную учителем без attendance/оценок. Идемпотентно — существующие
  //    пары (student,lesson) не переписываются.
  const recentFrom = new Date(new Date(cutoff).getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let retroAttCreated = 0, retroGradesCreated = 0, retroSkipped = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recent, error: recentErr } = await (db as any)
      .from("lessons").select("id, school_id").lt("ends_at", cutoff).gte("ends_at", recentFrom);
    if (recentErr) throw new Error(`recent lessons: ${recentErr.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentIds: string[] = (recent ?? [])
      .filter((r: any) => !excludedSchoolIds.has(r.school_id))
      .map((r: any) => r.id);
    const res = await fillAttendanceAndGrades(db, recentIds);
    retroAttCreated = res.attCreated; retroGradesCreated = res.gradesCreated; retroSkipped = res.skippedNoTeacher;
  } catch (e) {
    // Не роняем весь крон — статусы уже закрыты; ретро-fill best-effort.
    console.error("[close-past-lessons] attendance/grades fill failed:", (e as Error)?.message ?? e);
  }

  const attendanceCreated = closeAttCreated + retroAttCreated;
  const gradesCreated = closeGradesCreated + retroGradesCreated;
  console.log(`[close-past-lessons] cutoff=${cutoff} closed=${closed} attendance+=${attendanceCreated} grades+=${gradesCreated} skippedNoTeacher=${retroSkipped}`);
  return NextResponse.json({ cutoff, closed, attendanceCreated, gradesCreated, skippedNoTeacher: retroSkipped });
}
