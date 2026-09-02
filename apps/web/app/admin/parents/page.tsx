import { createClient } from "@/lib/supabase/server";
import { loadParentsPage, schoolNowMsFor } from "@/lib/people-data";
import { ParentsView } from "./ParentsView";

/**
 * 03.09.2026, срез 3b — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/people-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Копия разошлась бы с оригиналом на первой правке.
 *
 * ШКОЛА ЗДЕСЬ НЕ ПЕРЕДАЁТСЯ, и это принципиально: без неё условие по школе не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила доступа. Ни одного лишнего условия у него не появилось.
 */
export default async function AdminParentsPage() {
  const supabase = await createClient();

  // Z.3, заход 2 — «истекло ли приглашение» считается от времени ШКОЛЫ, а оно
  // у школ разное: под замороженной датой демо все приглашения выглядели бы
  // просроченными или, наоборот, вечными.
  const nowMs = await schoolNowMsFor(supabase);
  const { rows, allStudents } = await loadParentsPage(supabase, nowMs);

  return <ParentsView parents={rows} allStudents={allStudents} />;
}
