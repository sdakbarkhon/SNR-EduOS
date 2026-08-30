import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { isCuratorTeacher } from "@/lib/curator";
import { safeQuery } from "@/lib/safe-query";
import { CreateHomeworkForm } from "./CreateHomeworkForm";

export default async function NewHomeworkPage() {
  const supabase = await createClient();
  const [groupsRes, teacherRes, isCurator] = await Promise.all([
    safeQuery(getTeacherGroups(supabase), [], "NewHomeworkPage.groups"),
    safeQuery(getMyTeacher(supabase), null, "NewHomeworkPage.teacher"),
    isCuratorTeacher(supabase),
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
  // Правило берём то же, что уже действует в учебном плане: наблюдатель
  // (куратор) планирует по ВСЕМ предметам своих групп, предметник — только
  // по своему (`subjects.teacher_id`). Своей формулы «куратор ли это» не
  // пишем: она одна на весь проект и живёт в SQL — см. lib/curator.ts.
  //
  // ЗАГЛУШКИ (`is_stub`) НЕ ОТФИЛЬТРОВАНЫ, и это осознанно. На странице
  // уроков такой фильтр есть, но там список нужен только предметнику: куратору
  // создание урока запрещено вовсе. Здесь куратор задание создать может, а
  // 12 из его 13 предметов — как раз заглушки (в демо-школе на 30.08.2026:
  // биология, география, ИЗО, история, музыка, обществознание, природоведение,
  // физика…). Отфильтруй их — и у наблюдателя вместо 28 строк осталась бы
  // одна. Это была бы молчаливо сломанная работа, а не починка.
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
    groups.length > 0 && (isCurator || teacher)
      ? await (isCurator ? subjectsQuery : subjectsQuery.eq("teacher_id", teacher!.id))
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
