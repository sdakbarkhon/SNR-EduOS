// POST /api/lessons/[id]/start-with-close-previous
//
// Ученик/учитель нажимает "Начать урок" на N-м уроке дня. Помимо перевода
// самого урока в 'in_progress' (как обычный startLesson()), эндпоинт
// закрывает ПРЕДЫДУЩИЙ урок того же класса того же дня, если тот ещё не
// 'completed' — completeLessons() полноценно проставит статус + upsert
// посещаемость и оценки. Идемпотентно (guard в completeLessons/UPDATE):
//   - если этот урок уже in_progress/completed → { ok:true, no_op:true };
//   - если предыдущий уже completed → просто не трогаем;
//   - повторный клик по кнопке ничего не портит.
//
// Проверка прав: юзер должен иметь право читать этот урок через свой
// user-scoped клиент — если RLS даёт SELECT (student.startLesson RLS-полиси,
// учитель группы, ...), значит имеет право и стартовать. Дальше уже
// работаем admin-клиентом (для operations над attendance/grades/чужими
// уроками — которые под RLS ученик не пропустил бы).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { completeLessons } from "@/app/api/cron/_lib/complete-lessons";

const TZ_MS = 5 * 60 * 60 * 1000;

function tashkentTodayWindowForInstant(instant: Date): { start: string; end: string } {
  const tashkentInstant = new Date(instant.getTime() + TZ_MS);
  const startMs =
    Date.UTC(tashkentInstant.getUTCFullYear(), tashkentInstant.getUTCMonth(), tashkentInstant.getUTCDate()) - TZ_MS;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await ctx.params;

  // 1) Auth-check через user-scoped клиент. Читаем lesson по RLS —
  //    получилось = имеешь право; не получилось = 403.
  const userDb = await createClient();
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userLessonRow, error: userReadErr } = await (userDb as any).from("lessons")
    .select("id").eq("id", lessonId).maybeSingle();
  if (userReadErr) {
    return NextResponse.json({ error: userReadErr.message }, { status: 500 });
  }
  if (!userLessonRow) {
    // Либо урока нет, либо RLS не пропустила — оба случая внешне неотличимы,
    // но семантически "нет прав" здесь корректно.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) Дальше admin — нужен и для чтения соседних уроков, и для UPDATE'ов
  //    (attendance/grades через RLS ученик не проставит).
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson, error: lessonErr } = await (admin as any).from("lessons")
    .select("id, group_id, starts_at, status").eq("id", lessonId).maybeSingle();
  if (lessonErr) {
    return NextResponse.json({ error: lessonErr.message }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // 3) Уже запущен — no-op.
  if (lesson.status !== "scheduled") {
    return NextResponse.json({ ok: true, no_op: true, current_status: lesson.status });
  }

  // 4) Найти предыдущий урок того же класса того же ДНЯ Ташкент.
  const window = tashkentTodayWindowForInstant(new Date(lesson.starts_at));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevRow, error: prevErr } = await (admin as any).from("lessons")
    .select("id, status, starts_at")
    .eq("group_id", lesson.group_id)
    .lt("starts_at", lesson.starts_at)
    .gte("starts_at", window.start)
    .lt("starts_at", window.end)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevErr) {
    return NextResponse.json({ error: prevErr.message }, { status: 500 });
  }

  let closedPrevious: string | null = null;
  if (prevRow && prevRow.status !== "completed") {
    try {
      const res = await completeLessons(admin, [prevRow.id]);
      if (res.closed > 0) closedPrevious = prevRow.id;
    } catch (e) {
      // Не блокируем старт — но лог оставляем. Если предыдущий не закрылся,
      // пусть закроется ночным кроном (close-past-lessons).
      console.error("[start-with-close-previous] closePrevious failed:", (e as Error)?.message ?? e);
    }
  }

  // 5) Старт этого урока — guard on status='scheduled' для идемпотентности
  //    (защита от гонки: другой клиент мог уже стартануть между шагом 3 и
  //    сюда — тогда UPDATE вернёт 0 строк, и это не ошибка).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: started, error: startErr } = await (admin as any).from("lessons")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", lessonId)
    .eq("status", "scheduled")
    .select("id");
  if (startErr) {
    return NextResponse.json({ error: startErr.message }, { status: 500 });
  }
  const flipped = (started?.length ?? 0) > 0;

  return NextResponse.json({
    ok: true,
    no_op: !flipped,
    closed_previous: closedPrevious,
  });
}
