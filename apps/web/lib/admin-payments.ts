/**
 * Оплаты глазами админа школы. Заход 5 по платежам.
 *
 * Отдельный модуль, а не очередная тысяча строк в `admin-api.ts`: раздел
 * новый, его правила самостоятельны, и читать их проще рядом друг с другом.
 *
 * ЧИТАЕТ И ПИШЕТ СЛУЖЕБНЫМ КЛЮЧОМ, как и весь админский слой. Значит правила
 * доступа сюда не подставятся, и границу школы держим САМИ: на чтении — явный
 * фильтр по `school_id`, на правке — проверка школы у самого счёта.
 *
 * ЧТО МОЖНО И ЧЕГО НЕЛЬЗЯ:
 *   * открытый счёт  — править сумму, отменить;
 *   * отменённый     — вернуть в работу;
 *   * ОПЛАЧЕННЫЙ     — ничего. Его сумма уже списана с баланса парной строкой
 *     журнала, а журнал править и удалять нельзя вовсе: триггер из миграции
 *     227 останавливает даже служебный ключ. Правка задним числом развела бы
 *     сумму счёта и журнал НАВСЕГДА. Возврат по оплаченному счёту делается
 *     движением по балансу на экране учеников — там же, где ручное пополнение.
 */

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type SchoolInvoiceRow = {
  id: string;
  student_id: string;
  student_name: string;
  group_name: string | null;
  /** Первое число месяца, YYYY-MM-DD. */
  period_month: string;
  amount: number;
  status: "open" | "paid" | "canceled";
  paid_at: string | null;
  amount_source: "group_price" | "admin_adjusted";
  adjust_reason: string | null;
  /** Баланс ученика рядом со счётом: админ видит, почему счёт висит открытым,
   *  не уходя на другой экран. */
  balance: number;
};

/** Счета школы, новые сверху. */
export async function listSchoolInvoices(schoolId: string): Promise<SchoolInvoiceRow[]> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("tuition_invoices")
    .select(
      "id, student_id, period_month, amount, status, paid_at, amount_source, adjust_reason,"
      + " students(full_name, balance), groups(name)",
    )
    .eq("school_id", schoolId)
    .order("period_month", { ascending: false })
    .limit(500);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    student_id: r.student_id,
    student_name: r.students?.full_name ?? "—",
    group_name: r.groups?.name ?? null,
    period_month: r.period_month,
    amount: Number(r.amount),
    status: r.status,
    paid_at: r.paid_at,
    amount_source: r.amount_source,
    adjust_reason: r.adjust_reason,
    balance: Number(r.students?.balance ?? 0),
  }));
}

export type InvoiceBlockerRow = {
  student_id: string;
  full_name: string;
  period_month: string;
  groups_count: number;
  reason: "no_group" | "many_groups" | "no_price";
};

/** Кому счёт за текущий месяц школы выставить нельзя и почему. Считает
 *  представление `v_tuition_invoice_blockers` из миграции 229 — на лету, без
 *  единой сохранённой строки. */
export async function listInvoiceBlockers(schoolId: string): Promise<InvoiceBlockerRow[]> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("v_tuition_invoice_blockers")
    .select("student_id, full_name, period_month, groups_count, reason")
    .eq("school_id", schoolId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as InvoiceBlockerRow[];
}

export type IssuePreview = {
  invoice_month: string;
  will_issue: number;
  will_skip: number;
  total_amount: number;
};

/**
 * Что случится, если выставить счета прямо сейчас.
 *
 * Считается В БАЗЕ и В МОМЕНТ ВЫЗОВА, а не при открытии экрана: между
 * открытием и нажатием кнопки админ мог вписать цену классу, и вчерашние числа
 * соврали бы в подтверждении необратимого действия.
 */
export async function issueInvoicesPreview(schoolId: string): Promise<IssuePreview> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("fn_issue_preview", { p_school_id: schoolId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Partial<IssuePreview> | undefined;
  return {
    invoice_month: String(row?.invoice_month ?? ""),
    will_issue: Number(row?.will_issue ?? 0),
    will_skip: Number(row?.will_skip ?? 0),
    total_amount: Number(row?.total_amount ?? 0),
  };
}

/**
 * Выставить счета своей школе, не дожидаясь первого числа.
 *
 * Граница школы живёт в самой функции (миграция 230): без аргумента она
 * прошлась бы по ВСЕМ школам, и админ одной школы выставил бы счета другой.
 */
export async function issueInvoicesNow(schoolId: string): Promise<{ issued: number; skipped: number }> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("fn_issue_monthly_invoices", { p_school_id: schoolId });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return {
    issued: rows.reduce((s, r) => s + Number(r.issued ?? 0), 0),
    skipped: rows.reduce((s, r) => s + Number(r.skipped ?? 0), 0),
  };
}

/** Счёт своей школы в нужном состоянии — иначе внятный отказ машинным кодом,
 *  который humanizeAdminError превратит во фразу. */
async function loadInvoiceInState(
  invoiceId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
  expected: "open" | "canceled",
): Promise<void> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("tuition_invoices").select("id, status, school_id").eq("id", invoiceId).maybeSingle();
  if (error) throw error;
  const row = data as { status: string; school_id: string } | null;
  if (!row) throw new Error("INVOICE_NOT_FOUND");
  if (!callerIsSuperAdmin && row.school_id !== callerSchoolId) {
    throw new Error("Нельзя редактировать записи чужой школы");
  }
  if (row.status !== expected) {
    throw new Error(expected === "open" ? "INVOICE_NOT_OPEN" : "INVOICE_NOT_CANCELED");
  }
}

/** Правка суммы ОТКРЫТОГО счёта: скидка, индивидуальная цена, перерасчёт. */
export async function adjustInvoiceAmount(data: {
  invoiceId: string;
  amount: number;
  reason: string;
  adminId: string;
  callerSchoolId: string;
  callerIsSuperAdmin: boolean;
}): Promise<void> {
  if (!Number.isFinite(data.amount) || data.amount < 0) throw new Error("BAD_INVOICE_AMOUNT");
  if (!data.reason.trim()) throw new Error("INVOICE_REASON_REQUIRED");
  await loadInvoiceInState(data.invoiceId, data.callerSchoolId, data.callerIsSuperAdmin, "open");

  const sb = getServiceClient();
  // Все четыре поля разом: проверка `tuition_invoices_adjusted_has_author` из
  // 227 не даст пометить счёт «поправлен админом» без автора и времени.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("tuition_invoices").update({
    amount: data.amount,
    amount_source: "admin_adjusted",
    adjusted_by: data.adminId,
    adjusted_at: new Date().toISOString(),
    adjust_reason: data.reason.trim(),
  }).eq("id", data.invoiceId).eq("status", "open");
  if (error) throw error;
}

/**
 * Отмена ОТКРЫТОГО счёта.
 *
 * Отменённый счёт НЕ воскреснет следующим запуском задания: пара «ребёнок +
 * месяц» уникальна с миграции 227, и место занято. Это осознанно — отмена
 * решение человека, и задание не должно его переигрывать. Именно поэтому ниже
 * есть `restoreInvoice`: без него ошибочная отмена была бы навсегда.
 */
export async function cancelInvoice(data: {
  invoiceId: string;
  reason: string;
  adminId: string;
  callerSchoolId: string;
  callerIsSuperAdmin: boolean;
}): Promise<void> {
  if (!data.reason.trim()) throw new Error("INVOICE_REASON_REQUIRED");
  await loadInvoiceInState(data.invoiceId, data.callerSchoolId, data.callerIsSuperAdmin, "open");

  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("tuition_invoices").update({
    status: "canceled",
    amount_source: "admin_adjusted",
    adjusted_by: data.adminId,
    adjusted_at: new Date().toISOString(),
    adjust_reason: data.reason.trim(),
  }).eq("id", data.invoiceId).eq("status", "open");
  if (error) throw error;
}

/** Вернуть ОТМЕНЁННЫЙ счёт в работу. */
export async function restoreInvoice(data: {
  invoiceId: string;
  callerSchoolId: string;
  callerIsSuperAdmin: boolean;
}): Promise<void> {
  await loadInvoiceInState(data.invoiceId, data.callerSchoolId, data.callerIsSuperAdmin, "canceled");
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("tuition_invoices").update({
    status: "open",
  }).eq("id", data.invoiceId).eq("status", "canceled");
  if (error) throw error;
}
