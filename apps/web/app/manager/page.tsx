import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ManagerHomeView } from "./ManagerHomeView";

/**
 * Дом менеджера. Заход 1 — заглушка, и это честная заглушка, а не забытый
 * экран.
 *
 * В этом заходе делается ОСНОВАНИЕ роли: таблица, разбор роли, вход и экран
 * «Менеджеры» у суперадмина. Право ходить по чужим школам и работать внутри
 * них — заходы 2 и 3. Но войти менеджер должен уже сейчас, а входу нужен
 * адрес, куда вести: без этой страницы вход упирался бы в пустоту, а сторож
 * переходов гонял бы человека по кругу.
 *
 * ВТОРАЯ ПРОВЕРКА РОЛИ ПРИ ОТРИСОВКЕ. Сторож переходов (middleware) уже не
 * пускает сюда чужих, но у каждого раздела в этом проекте есть своя проверка:
 * у суперадмина, у админа, у учителя и у родителя. Менеджер не исключение —
 * один рубеж на такое не ставят.
 */
export default async function ManagerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manager } = await (supabase as any)
    .from("managers").select("full_name").eq("user_id", user.id).maybeSingle();
  if (!manager) redirect("/login");

  return <ManagerHomeView fullName={(manager.full_name as string) ?? ""} />;
}
