// POST /api/lessons/[id]/start-with-close-previous
//
// Ученик/учитель нажимает "Начать урок" на N-м уроке дня. Переводит урок в
// 'in_progress' — закрытие ДРУГИХ in_progress уроков той же группы теперь
// делает SQL-триггер trg_close_other_in_progress_lessons (миграция 152),
// атомарно в той же транзакции, что и сам UPDATE ниже. Раньше это делалось
// здесь вручную по ВРЕМЕННОЙ близости (искали "предыдущий урок того же
// дня" по starts_at) — если учитель пропускал уроки, закрывался
// хронологически ближайший, а не реально идущий (см. resheniya_2.md,
// "Сейчас/Далее"). Название роута оставлено (на него уже завязаны
// PreLessonView и TeacherLessonDetailView) — внутри только сам старт.
//
// Идемпотентно: если урок уже in_progress/completed → { ok:true, no_op:true };
// повторный клик по кнопке ничего не портит (guard eq("status","scheduled")
// на UPDATE защищает от гонки).
//
// Проверка прав: юзер должен иметь право читать этот урок через свой
// user-scoped клиент — если RLS даёт SELECT (student.startLesson RLS-полиси,
// учитель группы, ...), значит имеет право и стартовать. Дальше уже
// работаем admin-клиентом (тот же клиент, что и раньше выполнял сам UPDATE —
// триггер выполняется в той же транзакции и не зависит от того, каким
// клиентом вызван UPDATE).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSchoolFrozenDate, schoolNow } from "@/lib/school-time";

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

  // 2) Дальше admin — нужен для UPDATE (attendance/grades через RLS ученик
  //    не проставит).
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson, error: lessonErr } = await (admin as any).from("lessons")
    .select("id, school_id, status").eq("id", lessonId).maybeSingle();
  if (lessonErr) {
    return NextResponse.json({ error: lessonErr.message }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // П.2: школа с schools.autostart_enabled=true управляет стартом уроков
  // исключительно кроном (fn_auto_start_lessons) — ни ученик, ни учитель
  // этой школы не запускают урок вручную ("автостарт значит полностью
  // авто"). Единая проверка на обоих вызывающих: PreLessonView (студент) и
  // TeacherLessonDetailView.handleStartLesson (учитель) бьют в этот же роут.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: school, error: schoolErr } = await (admin as any).from("schools")
    .select("autostart_enabled").eq("id", lesson.school_id).maybeSingle();
  if (schoolErr) {
    return NextResponse.json({ error: schoolErr.message }, { status: 500 });
  }
  if (school?.autostart_enabled) {
    return NextResponse.json({ error: "Автостарт включён для этой школы — ручной запуск недоступен" }, { status: 403 });
  }

  // 3) Уже запущен — no-op.
  if (lesson.status !== "scheduled") {
    return NextResponse.json({ ok: true, no_op: true, current_status: lesson.status });
  }

  // 4) Старт этого урока — guard on status='scheduled' для идемпотентности
  //    (защита от гонки: другой клиент мог уже стартануть между шагом 3 и
  //    сюда — тогда UPDATE вернёт 0 строк, и это не ошибка). Триггер
  //    trg_close_other_in_progress_lessons закрывает другие in_progress
  //    уроки той же группы атомарно внутри этого же UPDATE.
  // Z.3, заход 2 — время старта берётся по школе САМОГО УРОКА, а не по школе
  // нажавшего. Разницы сегодня нет (RLS выше уже не пустила бы чужого), но
  // записывается свойство урока, и брать его надо у урока: `lesson.school_id`
  // прочитан на шаге 2, лишнего запроса нет. Демо-школа получит прежний якорь,
  // настоящая — настоящие часы. До правки сюда уходило замороженное 29.07
  // независимо от школы, и это всплыло бы в отчётах через день, а не в момент
  // клика.
  const lessonFrozenDate = await getSchoolFrozenDate(admin, (lesson as { school_id: string }).school_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: started, error: startErr } = await (admin as any).from("lessons")
    .update({ status: "in_progress", started_at: schoolNow(lessonFrozenDate).toISOString() })
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
  });
}
