import { cookies } from "next/headers";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { ProfileView } from "./ProfileView";

/**
 * «Профиль» — 1:1 по составу с apps/mobile-parent ProfileHubScreen.tsx.
 * Карточка родителя и «Мои дети» — реальные данные из getParentContext()
 * (тот же источник, что уже используют Home/Payments/Progress). Остальные
 * секции (Документы/Уведомления/Способы оплаты/Язык и безопасность/
 * Поддержка/О приложении) — заглушки-строки, как и в самой мобилке (там
 * они тоже просто переходы на отдельные экраны, некоторые из которых сами
 * частично мок).
 */
export default async function ParentProfilePage() {
  const ctx = await getParentContext();
  if (!ctx) return null;

  const cookieStore = await cookies();
  const selected = resolveSelectedChild(ctx.children, cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null);

  return <ProfileView parentName={ctx.parentName} kids={ctx.children} selectedChildId={selected?.id ?? null} />;
}
