import { getTeacherGroups, getTeacherAttendanceSummary, getGroupAttendance, tashkentMonthKey } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { TeacherAttendanceView } from "./TeacherAttendanceView";

/**
 * «Посещаемость» у учителя. Пункт 255, 03.09.2026.
 *
 * ЭКРАН ВОССТАНОВЛЕН, А НЕ НАПИСАН ЗАНОВО. Он существовал и был удалён
 * коммитом 403670b6 от 27.06.2026 — походя, третьим пунктом в чужой правке
 * про PGRST116 («Delete apps/web/app/teacher/attendance/»), без единого слова
 * о причине. От него в проекте остались живыми загрузчик `getGroupAttendance`
 * (матрица ученик × урок) и целый блок словаря на трёх языках
 * (`attendance.teacher*`) — оба без единого использования полтора месяца.
 *
 * МЕСЯЦ ПО УМОЛЧАНИЮ — МЕСЯЦ ПОСЛЕДНЕГО УРОКА, как было в удалённом экране.
 * Не «текущий»: учитель, не ведший уроков в этом месяце, открыл бы пустой
 * экран и решил бы, что данные потерялись.
 *
 * «СЕЙЧАС» — ШКОЛЬНОЕ, через getMySchoolNowMs: у демо-школы время заморожено
 * на 29.07, и реальные часы браузера показали бы ей чужой месяц.
 */
export const dynamic = "force-dynamic";

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; group?: string }>;
}) {
  const { month: месяцИзАдреса, group: группаИзАдреса } = await searchParams;
  const db = await createClient();

  const [groupsRes, nowMs] = await Promise.all([
    safeQuery(getTeacherGroups(db), [], "TeacherAttendancePage.groups"),
    getMySchoolNowMs(db),
  ]);
  const groups = (groupsRes.data as Array<{ id: string; name: string }>)
    .map((g) => ({ id: g.id, name: g.name }));

  // Месяц последнего урока учителя. Один запрос, и только если групп больше
  // нуля: пустому списку искать нечего.
  let месяцПоУмолчанию = tashkentMonthKey(nowMs);
  if (groups.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("lessons")
      .select("starts_at")
      .in("group_id", groups.map((g) => g.id))
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const последний = (data as { starts_at?: string } | null)?.starts_at;
    if (последний) месяцПоУмолчанию = tashkentMonthKey(последний);
  }

  const month = /^\d{4}-\d{2}$/.test(месяцИзАдреса ?? "") ? месяцИзАдреса! : месяцПоУмолчанию;
  const выбранная = groups.find((g) => g.id === группаИзАдреса)?.id ?? null;

  const [summaryRes, matrixRes] = await Promise.all([
    safeQuery(getTeacherAttendanceSummary(db, month), [], "TeacherAttendancePage.summary"),
    выбранная
      ? safeQuery(getGroupAttendance(db, выбранная, month),
          { lessons: [], students: [], matrix: {}, noAuthor: {}, groupAvgPct: 0 },
          "TeacherAttendancePage.matrix")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <TeacherAttendanceView
      groups={groups}
      month={month}
      summary={summaryRes.data}
      selectedGroupId={выбранная}
      matrix={matrixRes.data}
    />
  );
}
