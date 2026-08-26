/**
 * ВХОД В ДЕМО БЕЗ ПАРОЛЯ. 26.08.2026.
 *
 * ЗАЧЕМ. Функция базы `claim_demo_slot` возвращает пароль ЛИТЕРАЛОМ
 * (`'password123'` / `'parent2026'`) и никак не проверяет, что аккаунт им
 * действительно открывается. Пока литерал совпадает с тем, что лежит в
 * `auth.users`, всё работает; в день, когда пароль в проде поменяют, он
 * разойдётся с кодом — и вылезет это посреди показа заказчику.
 *
 * Сверка хешей 26.08 показала: сегодня расхождения НЕТ ни у одного из 36
 * аккаунтов пула. Мы чиним не сегодняшний отказ, а мину.
 *
 * КАК. Тем же приёмом, который уже полтора месяца работает у демо-родителя на
 * вебе (`demoParentLogin`): служебный клиент выпускает одноразовый `token_hash`
 * через `generateLink`, вызывающий обменивает его на сессию через `verifyOtp`.
 * Пароль в обмене не участвует вовсе, поэтому разойтись нечему.
 *
 * ПОЧЕМУ ТОЛЬКО ПОЛОВИНА ПРИЁМА ЖИВЁТ ЗДЕСЬ. Обмен `verifyOtp` у двух
 * вызывающих разный и общим быть не может: вебу нужно, чтобы сессия легла в
 * cookies (клиент, привязанный к запросу), а мобильному маршруту — чтобы пара
 * токенов вернулась наружу (отдельный клиент без сохранения сессии). Общая
 * часть — ровно выпуск токена, она и вынесена.
 *
 * ТОКЕН НАРУЖУ НЕ УХОДИТ: он живёт внутри серверного вызова и обменивается на
 * сессию тут же.
 */

/** Минимальная форма служебного клиента — ровно то, что здесь нужно. */
type AdminAuth = {
  auth: {
    admin: {
      generateLink: (args: { type: "magiclink"; email: string }) => Promise<{
        data: { properties?: { hashed_token?: string } | null } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export type DemoOtpResult =
  | { ok: true; tokenHash: string }
  | { ok: false; reason: string };

/**
 * Выпускает одноразовый `token_hash` для входа под указанным адресом.
 *
 * Отказ возвращается ЗНАЧЕНИЕМ с причиной, а не бросается: у обоих вызывающих
 * дальше стоит освобождение занятого слота, и потерять его из-за исключения
 * нельзя — слот залип бы на пятнадцать минут.
 */
export async function issueDemoOtpHash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: AdminAuth | any,
  email: string,
): Promise<DemoOtpResult> {
  if (!email) return { ok: false, reason: "у выданного слота нет адреса" };
  try {
    const { data, error } = await (admin as AdminAuth).auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      return { ok: false, reason: error?.message ?? "generateLink не вернул token_hash" };
    }
    return { ok: true, tokenHash };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? "generateLink упал" };
  }
}
