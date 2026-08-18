import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNow } from "@/lib/school-time-server";
import { collectAnalyticsFacts } from "@/lib/analytics-facts";
import { AnalyticsView, type AnalyticsFacts } from "./AnalyticsView";

// Общая аналитика школы для администратора.
//
// ЧТО ВАЖНО ПРО ДОСТУП. Все запросы идут ПОД СЕССИЕЙ АДМИНА, а не служебным
// ключом. Это не мелочь: правила доступа сами отсекают чужие школы, и админ
// физически не может увидеть чужие оценки — проверка не в коде экрана, а в
// базе. Служебный ключ отдал бы всё подряд, и любая ошибка в фильтре стала бы
// утечкой между школами.
//
// ПОЧЕМУ ФАКТЫ, А НЕ ГОТОВЫЕ ЧИСЛА. Экран считает сам, в браузере: фильтры
// (период, группа, предмет) и выгрузка должны работать мгновенно и вместе, а
// сводить в SQL пришлось бы отдельным запросом на каждое сочетание. Объём это
// позволяет: в демо-школе около 1100 оценок и 580 отметок посещаемости на
// 30 учеников. Если школа вырастет до десятков тысяч записей, сводить придётся
// на сервере — и это единственное место, которое тогда меняется.
//
// САМ СБОР ЖИВЁТ В lib/analytics-facts.ts: те же факты нужны ИИ — и для
// разбора положения дел, и чтобы подстроить урок под группу. Скопируй сбор во
// второе место, и экран с ИИ начнут говорить разное.

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Роль уже проверил app/admin/layout.tsx — сюда без записи в admins не
  // попасть. Школа берётся оттуда же, чтобы список учеников совпадал с тем,
  // что видит остальная админка.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (db as any)
    .from("admins").select("school_id").eq("user_id", user.id).maybeSingle();

  // «Сегодня» школы, а не реальные часы: демо-школа заморожена, и просрочку
  // надо считать от её собственной даты — иначе все задания разом окажутся
  // просроченными, чего в её мире не случилось.
  const schoolNow = await getMySchoolNow(db);
  const base = await collectAnalyticsFacts(db, schoolNow.toISOString().slice(0, 10));

  const facts: AnalyticsFacts = {
    ...base,
    hasSchool: Boolean((admin as { school_id: string } | null)?.school_id),
  };

  return <AnalyticsView facts={facts} />;
}
