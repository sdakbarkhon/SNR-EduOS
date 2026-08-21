import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Общая часть всех экранов «суперадмин смотрит школу».
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Экранов десять, и у каждого одна и та же присказка:
 * убедиться, что перед нами суперадмин, найти школу по адресу и взять клиент,
 * которым читать. Разложи это по десяти файлам — и однажды в одном из них
 * проверку забудут.
 *
 * ШКОЛА БЕРЁТСЯ ИЗ АДРЕСА, А НЕ ИЗ БАЗЫ. public.current_school_id() для
 * суперадмина пуст, и чинить это мы не стали намеренно: функция участвует в
 * сотне правил доступа, и «дать ему школу» означало бы дать её заодно и
 * правилам ЗАПИСИ. Поэтому школа живёт в адресе, а сервер подставляет её в
 * каждый запрос явно — руками, в каждом .eq("school_id", …).
 *
 * ЧИТАЕМ СЛУЖЕБНЫМ КЛЮЧОМ, И ЭТО НЕ ЛАЗЕЙКА, А НЕОБХОДИМОСТЬ. Под своим
 * ключом суперадмин увидел бы ОБЕ школы разом: его доступ держится на
 * `OR is_super_admin()`, который ни к какой школе не привязан. Служебный ключ
 * с явным фильтром по школе даёт ровно то, что нужно — одну школу, ту, что в
 * адресе.
 *
 * ПОЧЕМУ ОТСЮДА НЕЛЬЗЯ НИЧЕГО ЗАПИСАТЬ. Этот модуль отдаёт клиент только
 * серверным страницам, которые рисуют разметку. В браузер клиент не уезжает,
 * действий на запись на этих адресах нет ни одного, а экраны админа школы —
 * с их серверными действиями — мы не переиспользуем вовсе.
 */

export type ViewedSchool = {
  id: string;
  name: string;
  code: string | null;
  isDemo: boolean;
  isActive: boolean;
};

export type SchoolViewContext = {
  school: ViewedSchool;
  actor: { id: string; name: string };
  /** Служебный клиент. Каждый запрос обязан нести .eq("school_id", school.id). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/** Кто смотрит. Не суперадмин — на вход, без объяснений. */
export async function requireSuperAdmin(): Promise<{ id: string; name: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sa } = await (sb as any)
    .from("super_admins").select("full_name").eq("user_id", user.id).maybeSingle();
  if (!sa) redirect("/login");
  return { id: user.id, name: (sa.full_name as string) ?? "" };
}

/**
 * Проверка + школа из адреса. Возвращает всё, что нужно странице просмотра.
 *
 * Демо-школу смотреть можно: она существует ради показа, и прятать её от
 * владельца платформы незачем.
 */
export async function schoolViewContext(schoolId: string): Promise<SchoolViewContext> {
  const actor = await requireSuperAdmin();
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("schools").select("id, name, code, is_demo, is_active").eq("id", schoolId).maybeSingle();
  if (!data) redirect("/superadmin/schools");
  return {
    actor,
    db,
    school: {
      id: data.id as string,
      name: (data.name as string) ?? "",
      code: (data.code as string) ?? null,
      isDemo: !!data.is_demo,
      isActive: !!data.is_active,
    },
  };
}

/**
 * Телефон — хвостом номера.
 *
 * Решение заказчика: телефон родителя нужен, чтобы отличить одну строку от
 * другой, а не чтобы позвонить. Он же — ключ входа в кабинет родителя, поэтому
 * показывать его целиком гостю незачем.
 */
export function maskPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `••• ${digits.slice(-4)}`;
}
