/**
 * ОПЛАТЫ РЕБЁНКА — ОБЩИЙ СЛОЙ. Заход 4 по оплатам, 30.08.2026.
 *
 * Перенос `apps/web/lib/parent-queries.ts` (денежная часть: childBalance,
 * childInvoices, childBalanceEntries, childPaymentsSummary) на общий клиент.
 * Логика не изобреталась заново — она там написана и проверена; здесь
 * повторены ТЕ ЖЕ запросы и ТЕ ЖЕ правила.
 *
 * ЧЕМ ЭТА ВЕРСИЯ ОТЛИЧАЕТСЯ ОТ ВЕБ-ВЕРСИИ И ПОЧЕМУ
 *
 *  1. Нет `cache()` из React и нет `cookies()`. В вебе аксессоры сами
 *     вытаскивают выбранного ребёнка из куки и дедуплицируются на запрос —
 *     это свойства серверного окружения Next. В мобильном ни того, ни другого
 *     нет: ребёнок приходит параметром, повтор запросов гасит вызывающий
 *     (useChildQuery/useAsyncData).
 *  2. Идентификатор ребёнка — ЯВНЫЙ ПАРАМЕТР, и он проверяется (см. ниже).
 *  3. Сводка умеет считаться из уже загруженных счетов
 *     (`summarizeChildPayments`), чтобы экран, которому нужны и список, и
 *     итог, не спрашивал счета дважды. В вебе за это отвечал React-кеш.
 *
 * ЧТО СОХРАНЕНО ДОСЛОВНО
 *
 *  * `failed` у каждой функции. Экран обязан отличать «счетов нет» от «не
 *    смогли прочитать»: пустой список вместо ошибки — правдоподобная ложь.
 *    В вебе этот признак уже спас два экрана.
 *  * Правило долга: «к оплате» — сумма ТОЛЬКО открытых счетов, переплата —
 *    остаток баланса сверх долга и никогда не отрицательная.
 *  * `as any` на `.from()`: таблиц миграции 227 нет в сгенерированном
 *    `Database`-типе (он намеренно не перегенерирован — resheniya_2.md Z.2.1),
 *    ровно как в вебе.
 *
 * ВЫДУМАННЫЙ РЕБЁНОК СЮДА НЕ ПРОЙДЁТ. Идентификаторы витрины мобильного —
 * это строки вида «child-aziz» (src/data/fixtures/family.ts), а настоящие —
 * UUID. Поэтому проверка не на честное слово: не-UUID роняет вызов с
 * понятным сообщением ещё ДО обращения к базе. `null`/`undefined` — законное
 * «ребёнка нет», отдаётся пустой результат без запроса и без признака сбоя
 * (именно так и приходит `realChildId` в режиме витрины).
 */
import type { Db } from "../supabase/factory";

/** Счёт за месяц, как его видит родитель. */
export type ChildInvoice = {
  id: string;
  /** Первое число месяца, YYYY-MM-DD. */
  period_month: string;
  amount: number;
  status: "open" | "paid" | "canceled";
  paid_at: string | null;
  /** `admin_adjusted` — сумму правил админ школы; тогда есть и причина. */
  amount_source: "group_price" | "admin_adjusted";
  adjust_reason: string | null;
};

/** Движение по балансу. Журнал только пополняется (миграция 227). */
export type ChildBalanceEntry = {
  id: string;
  /** Со знаком: пополнение положительное, погашение отрицательное. */
  amount: number;
  kind: "topup" | "invoice_charge" | "adjustment" | "refund";
  note: string | null;
  created_at: string;
};

export type ChildPaymentsSummary = {
  balance: number;
  dueTotal: number;
  dueCount: number;
  overpayment: number;
  failed: boolean;
};

/** Сколько движений берём по умолчанию — столько же, сколько веб-версия. */
export const BALANCE_ENTRIES_LIMIT = 100;

/**
 * UUID любой версии. Ровно то, чем является `students.id`; «child-aziz» —
 * не является.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `null` — ребёнка нет (витрина или ещё не выбран): вызывающий отдаёт пустой
 * результат, запрос не делается. Строка не-UUID — ошибка в коде, а не
 * состояние данных: молчать о ней нельзя, иначе выдуманный идентификатор
 * когда-нибудь уедет в базу незамеченным.
 */
function requireRealChildId(studentId: string | null | undefined, fn: string): string | null {
  if (studentId == null || studentId === "") return null;
  if (!UUID.test(studentId)) {
    throw new Error(
      `[${fn}] идентификатор ребёнка не настоящий: ${JSON.stringify(studentId)}. ` +
        "В запросы идёт realChildId, идентификатор витрины сюда попадать не должен.",
    );
  }
  return studentId;
}

/**
 * Ловит сбой запроса и превращает его в признак, а не в исключение.
 *
 * Зовётся ТОЛЬКО вокруг обращения к базе: проверка идентификатора выше стоит
 * снаружи намеренно — программную ошибку глотать в `failed` нельзя, иначе она
 * притворится сетевым сбоем.
 */
async function safe<T>(label: string, fallback: T, run: () => Promise<T>): Promise<{ data: T; failed: boolean }> {
  try {
    return { data: await run(), failed: false };
  } catch (error) {
    console.error(`[${label}]`, error instanceof Error ? error.message : error);
    return { data: fallback, failed: true };
  }
}

/** Баланс ребёнка. Ноль здесь значит ровно ноль денег, а не «не знаем». */
export async function getChildBalance(
  db: Db,
  studentId: string | null | undefined,
): Promise<{ balance: number; failed: boolean }> {
  const id = requireRealChildId(studentId, "getChildBalance");
  if (!id) return { balance: 0, failed: false };

  const { data, failed } = await safe("getChildBalance", 0, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (db as any)
      .from("students")
      .select("balance")
      .eq("id", id)
      .single();
    if (error) throw error;
    return Number((row as { balance: number | string } | null)?.balance ?? 0);
  });
  return { balance: data, failed };
}

/**
 * Счета ребёнка, новые сверху. ВСЕ, без предела выборки — и это осознанно:
 * по ним считается долг, а обрезанный список дал бы обрезанный долг. Счетов у
 * ребёнка максимум по одному в месяц (ключ «ребёнок + месяц» уникален), так
 * что список растёт на двенадцать строк в год.
 */
export async function getChildInvoices(
  db: Db,
  studentId: string | null | undefined,
): Promise<{ items: ChildInvoice[]; failed: boolean }> {
  const id = requireRealChildId(studentId, "getChildInvoices");
  if (!id) return { items: [], failed: false };

  const { data, failed } = await safe<ChildInvoice[]>("getChildInvoices", [], async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (db as any)
      .from("tuition_invoices")
      .select("id, period_month, amount, status, paid_at, amount_source, adjust_reason")
      .eq("student_id", id)
      .order("period_month", { ascending: false });
    if (error) throw error;
    return ((rows ?? []) as ChildInvoice[]).map((row) => ({ ...row, amount: Number(row.amount) }));
  });
  return { items: data, failed };
}

/**
 * Движения по балансу, новые сверху.
 *
 * `complete` — влез ли журнал целиком. Итоги по такому списку считать можно
 * только когда он полный: пришло ровно `limit` строк — значит их может быть
 * больше, и «всего пополнено» перестало бы быть «всего». То же правило, что
 * держится на дневнике и на веб-истории.
 */
export async function getChildBalanceEntries(
  db: Db,
  studentId: string | null | undefined,
  options: { limit?: number } = {},
): Promise<{ items: ChildBalanceEntry[]; failed: boolean; complete: boolean }> {
  const limit = options.limit ?? BALANCE_ENTRIES_LIMIT;
  const id = requireRealChildId(studentId, "getChildBalanceEntries");
  if (!id) return { items: [], failed: false, complete: true };

  const { data, failed } = await safe<ChildBalanceEntry[]>("getChildBalanceEntries", [], async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (db as any)
      .from("balance_entries")
      .select("id, amount, kind, note, created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((rows ?? []) as ChildBalanceEntry[]).map((row) => ({ ...row, amount: Number(row.amount) }));
  });
  // При сбое список пуст, и «полным» его называть нельзя: мы про журнал ничего
  // не узнали, а не увидели, что он пуст.
  return { items: data, failed, complete: !failed && data.length < limit };
}

/**
 * ПРАВИЛО ДОЛГА — ОДНО МЕСТО. Чистая функция, без базы.
 *
 * «К оплате» — сумма ОТКРЫТЫХ счетов, а не всех: оплаченный счёт долгом не
 * является, отменённый тем более. Переплата — то, что лежит на балансе сверх
 * долга; отрицательной быть не может, потому что баланс в минус не уходит
 * (проверка из миграции 227).
 *
 * Отдельно от запроса, чтобы экран, у которого счета уже на руках, получал
 * итог без второго обращения к базе.
 *
 * ВНИМАНИЕ НА БУДУЩЕЕ: ровно этот же расчёт своими строками лежит в
 * `apps/web/lib/parent-queries.ts` (`childPaymentsSummary`). Веб в этом заходе
 * трогать было нельзя, поэтому копия там пока осталась; при первом же заходе,
 * которому разрешено править веб, её надо заменить вызовом отсюда — две
 * правды об одном долге нам не нужны.
 */
export function summarizeChildPayments(
  balance: number,
  invoices: ChildInvoice[],
): Omit<ChildPaymentsSummary, "failed"> {
  const open = invoices.filter((invoice) => invoice.status === "open");
  const dueTotal = open.reduce((sum, invoice) => sum + invoice.amount, 0);
  return {
    balance,
    dueTotal,
    dueCount: open.length,
    overpayment: Math.max(0, balance - dueTotal),
  };
}

/**
 * Сводка: сколько на балансе и сколько осталось доплатить.
 *
 * Оба запроса идут параллельно; `failed` поднимается, если упал хотя бы один —
 * иначе экран показал бы долг, посчитанный по половине данных.
 */
export async function getChildPaymentsSummary(
  db: Db,
  studentId: string | null | undefined,
): Promise<ChildPaymentsSummary> {
  const [balance, invoices] = await Promise.all([
    getChildBalance(db, studentId),
    getChildInvoices(db, studentId),
  ]);
  return {
    ...summarizeChildPayments(balance.balance, invoices.items),
    failed: balance.failed || invoices.failed,
  };
}
