import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlansForTeacher, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { redirect } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { CurriculumPlansView } from "./CurriculumPlansView";
import type { PlanDraft } from "./PlanDraftsList";

// Пара «группа + предмет» может прийти доводом адреса: так сюда ведёт отказ
// массового создания уроков — «плана нет, вот где его завести». Читаем её
// здесь, на сервере: useSearchParams в клиенте потребовал бы Suspense, и на
// этом мы уже один раз потеряли карточку входа.
export default async function TeacherCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; subject?: string }>;
}) {
  const { group: preGroupId, subject: preSubjectId } = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const teacher = (await safeQuery(getMyTeacher(db), null, "TeacherCurriculumPage.teacher")).data;
  if (!teacher) redirect("/login");

  const [plansRes, groupsRes, draftsRes] = await Promise.all([
    safeQuery(getCurriculumPlansForTeacher(db, teacher.id), [], "TeacherCurriculumPage.plans"),
    safeQuery(Promise.resolve(getTeacherGroups(db)), [], "TeacherCurriculumPage.groups"),
    // ЗАКАЗЫ НА РАЗБОР УЧЕБНИКА. Читаются на сервере, а не в браузере, чтобы
    // учитель, вернувшийся на вкладку через час, увидел готовый файл сразу, а
    // не после первого ответа подписки. Правило доступа отдаёт только свои —
    // отбирать по учителю здесь нечего.
    safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any)
        .from("curriculum_plan_drafts")
        .select("id, title, status, progress_percent, progress_stage, error_message, result_path, topics_count, created_at")
        .order("created_at", { ascending: false })
        .limit(20)
        // safeQuery ловит БРОШЕННОЕ, а запрос supabase отказ возвращает полем.
        // Без этого превращения отказ пришёл бы сюда «успехом», и на экране
        // вместо списка оказался бы объект ответа.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => {
          if (r.error) throw new Error(r.error.message);
          return (r.data ?? []) as PlanDraft[];
        }),
      [] as PlanDraft[],
      "TeacherCurriculumPage.drafts",
    ),
  ]);
  const plans = plansRes.data;
  const groupsRaw = groupsRes.data;
  const drafts = draftsRes.data;

  // Промт: раньше группы фильтровались по groups.teacher_id ("куратор
  // группы") — до миграции 109 это было корректно (1 куратор = все уроки
  // группы), но 109 перешла на модель "1 предмет = 1 учитель"
  // (subjects.teacher_id) и оставила groups.teacher_id указывать только на
  // teacher_karim (куратора-исключения) для всех 3 групп. Итог: все
  // остальные 4 реальных учителя получали здесь пустой список групп и не
  // могли выбрать группу при создании плана. getTeacherGroups уже
  // RLS-ограничен group_teachers (все свои группы, миграция 109) —
  // передаём их как есть; owner-проверка теперь на уровне ПРЕДМЕТА
  // (subjects.teacher_id), не группы — см. фильтр subjects ниже и RLS
  // can_manage_curriculum_plan (миграция 120).
  const groups = groupsRaw as unknown as Array<{ id: string; name: string; teacher_id: string | null }>;

  const groupIds = groups.map((g) => g.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subjectsRaw, error: subjectsErr } = groupIds.length > 0
    ? await (db as any).from("subjects").select("id, name, group_id, teacher_id").in("group_id", groupIds).order("name")
    : { data: [], error: null };
  if (subjectsErr) console.error("[TeacherCurriculumPage.subjects] failed:", subjectsErr.message);

  // Учитель планирует ТОЛЬКО по своему предмету (subjects.teacher_id) — как
  // и в расписании/уроках (getTeacherLessons*).
  //
  // 30.08.2026 — оговорки «кроме куратора» здесь больше нет: роль убрана из
  // продукта, наблюдателя со сквозным доступом ко всем предметам не осталось.
  const subjects = (
    (subjectsRaw ?? []) as Array<{ id: string; name: string; group_id: string; teacher_id: string | null }>
  ).filter((s) => s.teacher_id === teacher.id);

  return (
    <CurriculumPlansView
      plans={plans}
      drafts={drafts}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, group_id: s.group_id }))}
      teacherId={teacher.id}
      preselect={
        // Пара годится, только если она СВОЯ: чужой id в адресе не должен
        // открывать окно с недоступной группой.
        preGroupId && preSubjectId
          && groups.some((g) => g.id === preGroupId)
          && subjects.some((s) => s.id === preSubjectId && s.group_id === preGroupId)
          ? { groupId: preGroupId, subjectId: preSubjectId }
          : null
      }
    />
  );
}
