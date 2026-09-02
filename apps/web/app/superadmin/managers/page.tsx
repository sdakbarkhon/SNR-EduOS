import { listManagers } from "@/lib/admin-api";
import { ManagersView } from "./ManagersView";

/**
 * Менеджеры — роль из захода 1 (миграция 250). «Админ школы во всех школах
 * сразу»: следит за учителями и за деньгами.
 *
 * ЧИТАЕМ СЛУЖЕБНЫМ КЛЮЧОМ, а не токеном суперадмина. У таблицы managers
 * ровно одно правило доступа — «менеджер читает свою строку», — и под своим
 * ключом суперадмин не увидел бы ни одного. Правило намеренно оставлено
 * узким: список менеджеров нужен ровно на этом экране, а он серверный.
 *
 * Школ здесь нет вовсе, поэтому и второго запроса нет: у менеджера школы не
 * бывает, в отличие от экрана администраторов, где список школ питает и
 * колонку, и два выпадающих списка.
 */
export default async function SuperAdminManagersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;

  let rows: Awaited<ReturnType<typeof listManagers>> = [];
  try {
    rows = await listManagers();
  } catch (e) {
    // Пока миграция 250 не применена, таблицы нет, и запрос падает. Экран
    // при этом обязан открываться: пустой список честнее белого пятна.
    console.error("[SuperAdminManagersPage] managers query failed:", (e as Error)?.message);
  }

  return <ManagersView managers={rows} defaultOpenAdd={action === "add"} />;
}
