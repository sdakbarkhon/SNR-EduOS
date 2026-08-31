import { schoolNowFrom } from "@snr/core";
import { schoolViewContext } from "@/lib/school-view";
import { collectAnalyticsFacts } from "@/lib/analytics-facts";
import { AnalyticsClient, type SuperAnalyticsFacts } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

/**
 * Как школа учится: сводные числа, без имён.
 *
 * ШКОЛА ПОДСТАВЛЯЕТСЯ ЯВНО, И ЭТО НЕ ПЕРЕСТРАХОВКА. Суперадмин ходит
 * служебным ключом, личности в базе у него нет: current_school_id() для него
 * пуст, а `OR is_super_admin()` в правилах доступа ни к какой школе не
 * привязан. Сбор без явного фильтра сложил бы обе школы в одну кучу и подал
 * бы смесь как данные одной. Поэтому school.id идёт третьим доводом в
 * collectAnalyticsFacts, а тот проносит его в каждый запрос — тем же
 * приёмом, что и все десять экранов просмотра (см. lib/school-view.ts).
 *
 * «СЕЙЧАС» — У ПРОСМАТРИВАЕМОЙ ШКОЛЫ, А НЕ У СМОТРЯЩЕГО. Демо-школа
 * заморожена на 29.07; считай мы период от реальных часов суперадмина, окно
 * «последние 30 дней» уехало бы вперёд её данных, и полная школа выглядела бы
 * пустой. getMySchoolNow здесь не годится вовсе: он спрашивает
 * current_school_id(), которого у суперадмина нет.
 */
export default async function SchoolAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  // ДАТУ ЗАМОРОЗКИ ЧИТАЕМ ЯВНЫМ ЗАПРОСОМ, А НЕ fetchSchoolFrozenDate.
  //
  // Та функция берёт «единственную видимую строку» schools — под сессией
  // человека это верно, правила доступа оставляют ему одну школу. Служебному
  // ключу видны ОБЕ, и .limit(1) вернул бы какую придётся: половину заходов
  // суперадмин смотрел бы демо-школу по часам боевой и наоборот. Здесь школа
  // известна из адреса, поэтому спрашиваем прямо о ней.
  const [{ data: schoolRow }, { data: lessons }] = await Promise.all([
    db.from("schools").select("frozen_date").eq("id", school.id).maybeSingle(),
    db.from("lessons").select("status").eq("school_id", school.id),
  ]);
  const frozen = (schoolRow as { frozen_date: string | null } | null)?.frozen_date ?? null;
  const todayIso = schoolNowFrom(frozen).toISOString().slice(0, 10);

  const base = await collectAnalyticsFacts(db, todayIso, school.id);

  const всеУроки = (lessons ?? []) as Array<{ status: string }>;
  const facts: SuperAnalyticsFacts = {
    grades: base.grades,
    attendance: base.attendance,
    lessonsTotal: всеУроки.length,
    lessonsDone: всеУроки.filter((l) => l.status === "completed").length,
    todayIso,
  };

  return <AnalyticsClient facts={facts} />;
}
