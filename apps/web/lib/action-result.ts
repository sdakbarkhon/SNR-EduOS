/**
 * Доставка текста отказа из server action на экран.
 *
 * ЧТО БЫЛО СЛОМАНО. Действия админки сообщали об отказе, БРОСАЯ ошибку:
 * `throw new Error("GROUP_NAME_TAKEN")`, `throw new Error("BLOCKED_SUBJECT_IN_USE:126:0:3")`.
 * Клиент ловил её и переводил в человеческую фразу через
 * `humanizeAdminError`. В режиме разработки это работает, и потому беда жила
 * незамеченной. В БОЕВОЙ сборке Next подменяет текст ошибки server action
 * заглушкой:
 *
 *   «An error occurred in the Server Components render. The specific message
 *    is omitted in production builds to avoid leaking sensitive details.»
 *
 * Так задумано самим Next: сообщение может нести подробности сервера, и
 * наружу отдаётся только `digest`. Значит `humanizeAdminError` на проде не
 * получал НИ ОДНОГО из своих кодов и показывал заказчику эту английскую
 * фразу — на занятый логин, на защиту демо-школы, на гвард удаления предмета
 * с числами уроков. Проверено живьём на собранном приложении.
 *
 * ПОЧЕМУ ИМЕННО ТАК ПОЧИНЕНО. Подмену не обойти и не отключить — это правило
 * безопасности фреймворка, а не настройка. Единственный надёжный путь:
 * **сообщение должно возвращаться значением, а не бросаться исключением.**
 * Возвращаемое значение Next не трогает.
 *
 * Это не выдумка ради этого захода — это уже принятый в проекте порядок.
 * Все остальные server action проекта (`actions/auth.ts`, `actions/books.ts`,
 * `actions/materials.ts`, `parent/**`, `projects/scratch`) давно возвращают
 * `{ error }` значением. Броском отказывали только три файла админки.
 *
 * КАК ЭТО УСТРОЕНО. Тело действия оборачивается в `guard()`: он ловит
 * исключение и возвращает `{ ok: false, error }`. На клиенте `unwrap()`
 * разворачивает результат обратно и бросает ошибку УЖЕ В БРАУЗЕРЕ — там
 * подмены нет. Благодаря этому ни один `try/catch` и ни один вызов
 * `humanizeAdminError` в экранах менять не пришлось: у них та же ошибка с
 * тем же текстом, что и была задумана.
 */

/** Итог действия: либо значение, либо текст отказа. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/** Сколько текста отказа отдаём наружу. Целиком нельзя: сообщения Postgres
 *  тянут за собой DETAIL/HINT со значениями строк. Первой строки хватает и
 *  для разбора в humanizeAdminError, и для отчёта об ошибке. */
const MAX_ERROR_CHARS = 300;

/** Ошибки управления потоком Next (`redirect()`, `notFound()`). Их ловить
 *  нельзя: это не отказ, а способ фреймворка сменить страницу. Сегодня в
 *  действиях админки их нет, но перехватить их молча — ровно тот класс беды,
 *  который мы здесь и чиним. */
function isFrameworkSignal(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string"
    && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

/**
 * Текст отказа из чего угодно.
 *
 * ВТОРАЯ НАЙДЕННАЯ БЕДА, независимая от подмены Next. `admin-api.ts` почти
 * везде делает `if (error) throw error`, а `error` от Supabase — ОБЫЧНЫЙ
 * ОБЪЕКТ `{ message, details, hint, code }`, а не `Error`. Прежний разбор
 * (`e instanceof Error ? e.message : String(e)`) превращал такой объект в
 * строку «[object Object]» — и занятый логин показывался админу именно так,
 * причём и в разработке тоже. Проверено живьём.
 *
 * Поэтому собираем текст из полей объекта. `details` важен не меньше
 * `message`: имя нарушенного ограничения (`..._school_username_key`), по
 * которому humanizeAdminError и узнаёт занятый логин, лежит именно там.
 */
function messageOf(e: unknown): string {
  let raw: string;
  if (e instanceof Error) {
    raw = e.message;
  } else if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    raw = parts.length ? parts.join(" | ") : String(e);
  } else {
    raw = String(e);
  }
  return (raw.split("\n")[0] ?? raw).slice(0, MAX_ERROR_CHARS);
}

/** Числовой код ответа, если он есть: его читает ветка «слишком много
 *  запросов» в humanizeAdminError. */
function statusOf(e: unknown): number | undefined {
  const src = e as { status?: unknown; code?: unknown } | null;
  const value = typeof src?.status === "number" ? src.status
    : typeof src?.code === "number" ? src.code
      : undefined;
  return value;
}

/**
 * Обёртка тела server action. Возвращает значение или текст отказа —
 * НИКОГДА не бросает, кроме сигналов самого Next.
 */
export async function guard<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    if (isFrameworkSignal(e)) throw e;
    // Полная ошибка со стеком остаётся в логах сервера: наружу уходит только
    // первая строка, и по ней не всегда понятно, что случилось на самом деле.
    console.error("[admin action]", e);
    const status = statusOf(e);
    return status === undefined
      ? { ok: false, error: messageOf(e) }
      : { ok: false, error: messageOf(e), status };
  }
}

/**
 * Разворачивает результат на клиенте. Отказ снова становится исключением —
 * но брошенным уже в браузере, поэтому его текст никто не подменяет, и
 * существующие `try/catch` вокруг вызовов работают как прежде.
 */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const r = await result;
  if (r.ok) return r.data;
  const err = new Error(r.error) as Error & { status?: number };
  if (r.status !== undefined) err.status = r.status;
  throw err;
}
