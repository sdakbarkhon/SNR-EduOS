import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Корень раздела менеджера.
 *
 * ЗАХОД 2 — ЗДЕСЬ БОЛЬШЕ НЕ ЗАГЛУШКА. В первом заходе тут стояла страница,
 * честно говорившая «работа со школами появится следующими заходами». Школы
 * появились, и держать её рядом со списком значило бы заставить человека
 * нажимать лишний раз ни за чем. Список школ и есть дом менеджера.
 *
 * ВТОРАЯ ПРОВЕРКА РОЛИ ПРИ ОТРИСОВКЕ ОСТАЛАСЬ. Сторож переходов (middleware)
 * уже не пускает сюда чужих, но у каждого раздела в этом проекте есть своя
 * проверка: у суперадмина, у админа, у учителя и у родителя. Один рубеж на
 * такое не ставят.
 */
export default async function ManagerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manager } = await (supabase as any)
    .from("managers").select("id").eq("user_id", user.id).maybeSingle();
  if (!manager) redirect("/login");

  // ЗАХОД 2: дома у менеджера больше нет — список школ и есть его дом.
  // Держать пустую страницу-заглушку рядом со списком значило бы заставить
  // человека нажимать лишний раз ни за чем.
  redirect("/manager/schools");
}
