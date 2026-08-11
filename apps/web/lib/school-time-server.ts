import { cache } from "react";
import { getSchoolFrozenDate, schoolNow, schoolNowMs } from "./school-time";

/**
 * «Сейчас» школы ТЕКУЩЕГО пользователя — серверная сторона. Z.3, заход 2.
 *
 * КАК ОПРЕДЕЛЯЕТСЯ ШКОЛА. Через RPC `current_school_id()` — это собственный
 * резолвер базы (SECURITY DEFINER, доступен роли `authenticated`), который
 * перебирает students → teachers → admins → parents по `auth.uid()`. Своей
 * копии этого перебора здесь нет намеренно: точно такой же перебор уже
 * лежит в определении функции, и вторая реализация разошлась бы с первой при
 * первом же изменении ролевой модели.
 *
 * ТРЕБУЕТ ПОЛЬЗОВАТЕЛЬСКОГО КЛИЕНТА. `current_school_id()` стоит на
 * `auth.uid()`, а под service-role его нет — там функция вернёт NULL. Поэтому
 * сюда передаётся клиент с сессией (`createClient()` или Bearer-клиент), а не
 * `createAdminClient()`. Места, где под рукой только служебный клиент,
 * определяют школу по своей сущности и зовут `getSchoolFrozenDate` напрямую.
 *
 * ДЕДУПЛИКАЦИЯ. Обёрнуто в React `cache()`, а `createClient()` сам закеширован
 * на запрос (см. lib/supabase/server.ts) — то есть при нескольких вызовах на
 * одной странице поход в базу будет один.
 *
 * NULL ЗНАЧИТ НАСТОЯЩЕЕ ВРЕМЯ. И при отсутствии школы, и при ошибке запроса:
 * «не знаем про заморозку» безопаснее трактовать как обычные часы, иначе сбой
 * заморозил бы настоящую школу.
 */
export const getMySchoolFrozenDate = cache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (db: any): Promise<string | null> => {
    const { data, error } = await db.rpc("current_school_id");
    if (error || !data) return null;
    return getSchoolFrozenDate(db, data as string);
  },
);

/** «Сейчас» школы текущего пользователя. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMySchoolNow(db: any): Promise<Date> {
  return schoolNow(await getMySchoolFrozenDate(db));
}

/** То же в миллисекундах. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMySchoolNowMs(db: any): Promise<number> {
  return schoolNowMs(await getMySchoolFrozenDate(db));
}
