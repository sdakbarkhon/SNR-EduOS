import "server-only";
import { listInvoiceBlockers, listSchoolInvoices } from "@/lib/admin-payments";
import { safeQuery } from "@/lib/safe-query";

/**
 * ЧТЕНИЕ ЭКРАНА «ОПЛАТЫ». Срез 3d, 03.09.2026.
 *
 * ═══ ЗДЕСЬ ПРАВИЛО ДРУГОЕ, ЧЕМ В 3b И 3c, И ЭТО НЕ ОПЛОШНОСТЬ ═════════════
 *
 * У «людей» и «учёбы» школа была НЕОБЯЗАТЕЛЬНЫМ УСЛОВИЕМ запроса: без неё
 * запрос оставался прежним и админа сужали правила доступа.
 *
 * Деньги так не читались НИКОГДА. `listSchoolInvoices` и
 * `listInvoiceBlockers` с самого захода 5 ходят СЛУЖЕБНЫМ КЛЮЧОМ и требуют
 * школу ОБЯЗАТЕЛЬНЫМ доводом — правил доступа они не спрашивают вовсе.
 * Переводить тут нечего: явное условие по школе стояло здесь до менеджера.
 *
 * Разной остаётся только одна вещь — ОТКУДА БЕРЁТСЯ САМА ШКОЛА:
 *
 *   не передана — из строки вошедшего админа, как на его экране всегда;
 *   передана    — из адреса. Так работает менеджер: своей школы у него нет.
 *
 * Ради этой единственной развилки модуль и заведён: иначе оба экрана несли
 * бы по копии двух запросов и по копии защиты от упавшего запроса.
 *
 * ЛОВЯТ ОШИБКУ ПОРОЗНЬ. Списки читаются независимо, и упавший запрос счетов
 * не уносит список «кому счёт выставить нельзя», и наоборот: `Promise.all`
 * без такой защиты в этом проекте дважды ронял целые экраны.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Школа вошедшего админа. У менеджера и суперадмина её нет — вернётся null. */
async function своя(db: Db): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser();
  const { data } = await db
    .from("admins").select("school_id").eq("user_id", user?.id ?? "").maybeSingle();
  return (data as { school_id: string } | null)?.school_id ?? null;
}

export async function loadPaymentsPage(db: Db, schoolId?: string | null) {
  const школа = schoolId ?? (await своя(db));
  if (!школа) return { invoices: [], blockers: [] };

  const [invoices, blockers] = await Promise.all([
    safeQuery(listSchoolInvoices(школа), [], "listSchoolInvoices"),
    safeQuery(listInvoiceBlockers(школа), [], "listInvoiceBlockers"),
  ]);
  return { invoices: invoices.data, blockers: blockers.data };
}
