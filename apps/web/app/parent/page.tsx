import { redirect } from "next/navigation";
import { getParentContext } from "@/lib/parent-context";
import { PhoneLoginView } from "./PhoneLoginView";

export default async function ParentLoginPage() {
  // Уже залогинен как родитель — сразу в каркас (middleware отдельно
  // подчищает этот же случай на всех НЕ-/parent маршрутах; сюда, на сам
  // /parent, middleware не заходит — isParentLoginRoute гейта не ставит).
  const ctx = await getParentContext();
  if (ctx) redirect("/parent/home");

  return <PhoneLoginView />;
}
