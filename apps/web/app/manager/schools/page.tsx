import { requireSchoolViewer } from "@/lib/school-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { signLogoUrl } from "@/lib/school-card";
import { redirect } from "next/navigation";
import { ManagerSchoolsView } from "./ManagerSchoolsView";

/**
 * Список школ для менеджера. Заход 2 — только чтение.
 *
 * ═══ ДЕМО-ШКОЛА СКРЫТА ════════════════════════════════════════════════════
 *
 * Решение принято здесь и продублировано в schoolViewContext: её нет в списке
 * И её не открыть по прямой ссылке. Одного рубежа мало — ссылку можно
 * передать.
 *
 * Почему строже, чем у суперадмина, которому демо-школа по ссылке доступна:
 * он владелец платформы и смотрит витрину как витрину. Менеджер приставлен к
 * учителям и деньгам НАСТОЯЩИХ школ, а демо живёт с замороженным временем и
 * ночным откатом — всё, что он там увидит, завтра будет другим. Выдуманные
 * числа рядом с настоящими путают ровно там, где заказчик просил «чтобы не
 * путать с другими школами».
 *
 * ═══ АРХИВНЫЕ ШКОЛЫ ПОКАЗЫВАЮТСЯ, С МЕТКОЙ ════════════════════════════════
 *
 * Ровно как у суперадмина: его запрос фильтрует только демо, а неактивные
 * школы показывает с меткой «в архиве». Прятать их от менеджера значило бы
 * заставить его думать, что школы никогда не было. А заход 2 — чтение, и
 * прочитать историю закрытой школы никому не вредит. Вопрос «пускать ли туда
 * писать» встанет в заходе 3, там его и решим.
 *
 * ЧИТАЕМ СЛУЖЕБНЫМ КЛЮЧОМ. У менеджера нет ни одного правила доступа к
 * школам — их даст заход 3, если понадобятся. Сейчас все данные приходят
 * серверными страницами, в браузер клиент не уезжает.
 */
export const dynamic = "force-dynamic";

export default async function ManagerSchoolsPage() {
  const viewer = await requireSchoolViewer();
  // Суперадмину здесь делать нечего: у него свой список, богаче этого.
  if (viewer.role !== "manager") redirect("/superadmin/schools");

  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("schools")
    .select("id, name, code, is_active, logo_path")
    .eq("is_demo", false)
    .order("name");
  if (error) console.error("[ManagerSchoolsPage] schools query failed:", error.message);

  const rows = (data ?? []) as Array<{
    id: string; name: string; code: string | null; is_active: boolean; logo_path: string | null;
  }>;

  // Логотипы подписываются на час — по одной ссылке на школу. Школ единицы,
  // отдельного кэша это не стоит.
  const школы = await Promise.all(rows.map(async (s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    isActive: s.is_active,
    logoUrl: await signLogoUrl(s.logo_path),
  })));

  return <ManagerSchoolsView schools={школы} viewerName={viewer.name} />;
}
