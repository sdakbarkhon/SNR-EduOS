import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * КТО ПИШЕТ В ШКОЛУ И В КАКУЮ. Заход 3 по роли менеджера, 03.09.2026.
 *
 * ═══ ЗАЧЕМ ЭТОТ МОДУЛЬ ════════════════════════════════════════════════════
 *
 * Проверка «я админ школы, и вот моя школа» жила ТРЕМЯ ОДИНАКОВЫМИ КОПИЯМИ:
 * apps/web/app/admin/actions.ts, admin/parents/actions.ts и
 * admin/payments/actions.ts. Копии отличались только тем, какие поля отдают
 * наружу; тело — слово в слово.
 *
 * Их и надо было учить пускать менеджера. Три раза одно и то же — это ровно
 * та беда, на которой в этом проекте правила расходились семь раз. Поэтому
 * сперва одна функция, потом роль.
 *
 * ═══ ОТКУДА БЕРЁТСЯ ШКОЛА ═════════════════════════════════════════════════
 *
 * У АДМИНА — из его собственной строки, как было всегда. Ничего переданного
 * снаружи он изменить не может: довод `requestedSchoolId` для него не просто
 * игнорируется, а ОТВЕРГАЕТСЯ, если указывает на чужую школу. Молча взять
 * свою было бы мягче, но тогда подделанный запрос выглядел бы как удавшийся,
 * а он должен выглядеть как отказ.
 *
 * У МЕНЕДЖЕРА — только снаружи: своей школы у него нет, в этом вся роль. И
 * это не дыра, а устройство: менеджеру разрешены ВСЕ школы, поэтому подделать
 * ему нечего — он и так может в любую. Проверяется другое: что школа
 * существует и что она не демо.
 *
 * ДЕМО-ШКОЛА ЗАКРЫТА МЕНЕДЖЕРУ И ЗДЕСЬ. Тот же запрет, что в заходе 2 стоит
 * на просмотре: она живёт с замороженным временем и ночным откатом, и запись
 * туда исчезнет к утру. Три рубежа на один запрет — список, просмотр и
 * запись — потому что ссылку можно передать, а действие вызвать в обход
 * экрана.
 *
 * ═══ ЧЕГО ЗДЕСЬ НЕТ ═══════════════════════════════════════════════════════
 *
 * Правил доступа. Вся запись админки идёт служебным ключом, который правила
 * обходит целиком; это записано ещё в шапке миграции 222. Значит права
 * менеджера решаются здесь, в коде, и ни одно из 506 правил трогать не
 * пришлось.
 */

export type StaffRole = "admin" | "manager";

export type StaffContext = {
  /** Школа, в которой человек сейчас действует. */
  schoolId: string;
  /** Кем он действует. Нужно журналу и запретам. */
  role: StaffRole;
  /**
   * Учётная запись. Есть у ЛЮБОЙ роли — и в этом весь смысл.
   *
   * Здесь же лежала `adminId` — строка из `admins`, которой у менеджера нет
   * и быть не может. Её держали ради денег: `tuition_invoices.adjusted_by`
   * ссылался на `admins`. Миграция 251 перевела ссылку на `auth.users`, и
   * последний потребитель `adminId` исчез — вместе с самим полем.
   *
   * Убрано намеренно, а не за ненадобностью: пока оно тут лежит, следующий
   * денежный код потянется к нему и снова упрётся в ту же стену.
   */
  userId: string;
  /** Он же суперадмин? Досталось от прежних копий, сужает проверки школы. */
  isSuperAdmin: boolean;
};

/**
 * Проверить, кто действует, и выдать школу.
 *
 * `requestedSchoolId` — школа, названная вызывающим. Обязателен для менеджера,
 * необязателен для админа (и сверяется с его собственной, если пришёл).
 */
export async function verifyStaff(requestedSchoolId?: string | null): Promise<StaffContext> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const [admin, superAdmin, manager] = await Promise.all([
    sbAny.from("admins").select("school_id").eq("user_id", user.id).maybeSingle(),
    sbAny.from("super_admins").select("id").eq("user_id", user.id).maybeSingle(),
    sbAny.from("managers").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  const запрошена = (requestedSchoolId ?? "").trim() || null;

  // ── АДМИН ШКОЛЫ. Ровно как было: школа из строки, чужая — отказ. ──
  if (admin.data) {
    const своя = admin.data.school_id as string;
    if (запрошена && запрошена !== своя) throw new Error("WRONG_SCHOOL");
    return {
      schoolId: своя,
      role: "admin",
      userId: user.id,
      isSuperAdmin: !!superAdmin.data,
    };
  }

  // ── МЕНЕДЖЕР. Школа только снаружи, и она проверяется. ──
  if (manager.data) {
    if (!запрошена) throw new Error("MANAGER_SCHOOL_REQUIRED");
    // Служебным ключом: у менеджера нет ни одного правила доступа к schools,
    // и заводить их ради этой проверки незачем — заход 2 читает так же.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: school } = await (createAdminClient() as any)
      .from("schools").select("id, is_demo").eq("id", запрошена).maybeSingle();
    if (!school) throw new Error("WRONG_SCHOOL");
    if (school.is_demo) throw new Error("WRONG_SCHOOL");
    return {
      schoolId: school.id as string,
      role: "manager",
      userId: user.id,
      isSuperAdmin: !!superAdmin.data,
    };
  }

  throw new Error("Not admin");
}
