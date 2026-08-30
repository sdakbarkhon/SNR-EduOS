import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { CreateHomeworkForm } from "./CreateHomeworkForm";

export default async function NewHomeworkPage() {
  const supabase = await createClient();
  const [groupsRes, teacherRes] = await Promise.all([
    safeQuery(getTeacherGroups(supabase), [], "NewHomeworkPage.groups"),
    safeQuery(getMyTeacher(supabase), null, "NewHomeworkPage.teacher"),
  ]);
  const groups = groupsRes.data;
  const teacher = teacherRes.data as { id: string } | null;

  // ПРЕДМЕТНИК ВИДИТ ТОЛЬКО СВОИ ПРЕДМЕТЫ. 30.08.2026.
  //
  // Было: все предметы всех доступных групп («co-teacher parity»). Учитель
  // английского видел в списке 28 предметов, из них 25 чужих — биологию,
  // географию, ИЗО. Ровно ту же болезнь чинили на странице уроков и в
  // учебном плане; форма создания задания осталась последней.
  //
  // Правило то же, что в учебном плане: предметник видит только свой предмет
  // (`subjects.teacher_id`).
  //
  // 30.08.2026 — ветки «кроме куратора» здесь больше нет. Наблюдатель со
  // сквозным доступом ко всем предметам группы убран из продукта вместе с
  // ролью, и оговорка про заглушки (`is_stub`) вместе с ним: она объясняла,
  // почему их нельзя отсеять у куратора — 12 из его 13 предметов были
  // заглушками. Для предметника вопрос не стоит: у него заглушек нет.
  //
  // Карточки учителя нет (запрос упал) — список пуст: чей предмет, неизвестно,
  // и сужать не по чему. Тот же выбор «падаем закрыто», что у фильтра
  // расписания в packages/core.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjectsQuery = (supabase as any)
    .from("subjects")
    .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
    .in("group_id", (groups as Array<{ id: string }>).map((g) => g.id))
    .order("name");
  const { data: subjects, error: subjectsErr } =
    groups.length > 0 && teacher
      ? await subjectsQuery.eq("teacher_id", teacher.id)
      : { data: [], error: null };
  if (subjectsErr) console.error("[NewHomeworkPage.subjects] failed:", subjectsErr.message);

  return (
    <CreateHomeworkForm
      groups={groups as never[]}
      subjects={subjects ?? []}
      teacherId={teacher?.id ?? ""}
    />
  );
}
