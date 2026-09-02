import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Общая часть всех экранов «смотрю школу изнутри».
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Экранов десять, и у каждого одна и та же присказка:
 * убедиться, кто перед нами, найти школу по адресу и взять клиент, которым
 * читать. Разложи это по десяти файлам — и однажды в одном из них проверку
 * забудут.
 *
 * ═══ 03.09.2026, ЗАХОД 2 ПО РОЛИ МЕНЕДЖЕРА ══════════════════════════════
 *
 * Смотрящих стало двое: суперадмин и менеджер. Экраны просмотра при этом НЕ
 * скопированы — под адресами менеджера лежат однострочные пере-экспорты тех
 * же самых страниц. Копия десяти файлов с запросами разошлась бы с оригиналом
 * на первой же правке; в этом проекте копии правил расходились семь раз.
 *
 * Значит и проверка «кто смотрит» осталась ОДНА — вот эта. Разница между
 * ролями живёт в ней одной, а не рассыпана по экранам.
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

/** Кто смотрит. Роль нужна оболочке: у менеджера свой адрес выхода и свой
 *  корень вкладок, а у суперадмина — свой. */
export type SchoolViewer = { id: string; name: string; role: "super_admin" | "manager" };

export type SchoolViewContext = {
  school: ViewedSchool;
  actor: SchoolViewer;
  /** Служебный клиент. Каждый запрос обязан нести .eq("school_id", school.id). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/**
 * Кто смотрит. Ни тот и ни другой — на вход, без объяснений.
 *
 * ДВА ЗАПРОСА, А НЕ ОДИН НА РОЛЬ. get_current_user_role() отдала бы роль
 * одним походом, но нам нужно ещё и ИМЯ смотрящего, а оно лежит в своей
 * таблице у каждого. Два маленьких запроса параллельно дешевле, чем роль
 * плюс поход за именем следом.
 */
export async function requireSchoolViewer(): Promise<SchoolViewer> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;
  const [sa, mg] = await Promise.all([
    anySb.from("super_admins").select("full_name").eq("user_id", user.id).maybeSingle(),
    anySb.from("managers").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);
  // Старшинство то же, что в get_current_user_role: суперадмин выше.
  if (sa.data) return { id: user.id, name: (sa.data.full_name as string) ?? "", role: "super_admin" };
  if (mg.data) return { id: user.id, name: (mg.data.full_name as string) ?? "", role: "manager" };
  redirect("/login");
}

/**
 * Проверка + школа из адреса. Возвращает всё, что нужно странице просмотра.
 *
 * ДЕМО-ШКОЛА: СУПЕРАДМИНУ МОЖНО, МЕНЕДЖЕРУ НЕЛЬЗЯ. Суперадмин — владелец
 * платформы, витрина существует ради показа, и прятать её от него незачем.
 * А менеджер приставлен к учителям и к деньгам настоящих школ; демо-школа
 * живёт с замороженным временем и ночным откатом, и всё, что он там увидит,
 * завтра будет другим. Показывать ему выдуманные числа рядом с настоящими
 * значит путать его ровно там, где заказчик просил «чтобы не путать с
 * другими школами».
 *
 * Поэтому менеджеру демо-школа закрыта ДВАЖДЫ: её нет в его списке и её не
 * открыть по прямой ссылке. Одного рубежа мало — ссылку можно передать.
 */
export async function schoolViewContext(schoolId: string): Promise<SchoolViewContext> {
  const actor = await requireSchoolViewer();
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("schools").select("id, name, code, is_demo, is_active").eq("id", schoolId).maybeSingle();
  const домой = actor.role === "manager" ? "/manager/schools" : "/superadmin/schools";
  if (!data) redirect(домой);
  if (actor.role === "manager" && data.is_demo) redirect(домой);
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
