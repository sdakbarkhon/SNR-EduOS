import { redirect } from "next/navigation";
import { getParentContext } from "@/lib/parent-context";
import { AuthFlow } from "./AuthFlow";

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Уже залогинен как родитель — сразу в каркас, минуя онбординг и вход
  // (middleware отдельно подчищает этот же случай на всех НЕ-/parent
  // маршрутах; сюда, на сам /parent, middleware не заходит —
  // isParentLoginRoute гейта не ставит).
  const ctx = await getParentContext();
  if (ctx) redirect("/parent/home");

  // Возврат от Google с отказом: код причины приезжает адресом, экран входа
  // переводит его на язык пользователя и показывает тостом.
  const { error } = await searchParams;
  return <AuthFlow googleError={error ?? null} />;
}
