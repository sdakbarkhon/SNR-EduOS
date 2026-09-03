import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@snr/core";
import { getSupabaseEnv } from "../env";
import { getCurrentUserRole, roleToHome, type UserRole } from "../auth";
import { DEMO_SESSION_COOKIE, sessionIdFromAccessToken } from "../single-session";

/**
 * ПРЕДЕЛ ОЖИДАНИЯ СЕТЕВОГО ШАГА ПОСРЕДНИКА. 04.09.2026.
 *
 * БЕДА. Посредник ходит в базу на КАЖДОМ переходе — сверить сессию и узнать
 * роль. Ни у одного из этих запросов не было предела ожидания. На полуоткрытом
 * соединении (уснувший ноутбук, мобильная сеть, VPN, captive portal) запрос не
 * завершается ни успехом, ни ошибкой — и переход по меню не происходит ВООБЩЕ.
 * Человек постоял без дела, нажал пункт меню, и страница замерла навсегда;
 * спасала только перезагрузка. Это и есть «зависание после простоя».
 *
 * СКОЛЬКО. Три секунды. Здоровый круг до базы во Франкфурте — сотни
 * миллисекунд; три секунды это десятикратный запас на плохую связь и заведомо
 * меньше, чем человек готов ждать, прежде чем решит, что всё сломалось.
 *
 * НЕ ДОЖДАЛИСЬ — ПУСКАЕМ, А НЕ ВЫКИДЫВАЕМ. Ровно та же осторожность, что уже
 * принята для сбоя сверки сессии («недоступность БД не должна разлогинивать
 * всех разом»): молчание базы — не повод выставить человека на экран входа.
 * Доступ от этого не открывается: разделы админа, суперадмина, учителя и
 * родителя проверяют роль ещё раз в своём layout, а последнее слово всё равно
 * за правилами доступа в самой базе.
 */
const ПРЕДЕЛ_МС = 3000;

/** Не дождались — отдаём запасное значение и пишем в журнал. */
function сПределом<T>(обещание: PromiseLike<T>, запасное: T, чтоЭто: string): Promise<T> {
  return new Promise<T>((готово) => {
    const таймер = setTimeout(() => {
      console.warn(`[middleware] ${чтоЭто}: база молчит дольше ${ПРЕДЕЛ_МС} мс — пускаем дальше`);
      готово(запасное);
    }, ПРЕДЕЛ_МС);
    обещание.then(
      (значение) => { clearTimeout(таймер); готово(значение); },
      (ошибка) => {
        clearTimeout(таймер);
        console.warn(`[middleware] ${чтоЭто} отказал:`, (ошибка as Error)?.message ?? ошибка);
        готово(запасное);
      },
    );
  });
}

/** Роль не успела приехать. Не то же самое, что «роли нет». */
const РОЛЬ_НЕ_УСПЕЛА = "__не_успела__" as const;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Промт «скорость», Задача 4: getUser() делает отдельный сетевой запрос к
  // Supabase Auth только чтобы провалидировать JWT — getSession() читает его
  // из cookie локально (без сети) и даёт то же самое: user + access_token.
  // Формальную проверку подлинности подписи здесь по-прежнему выполняет
  // check_user_session RPC ниже — PostgREST резолвит auth.uid() только для
  // реально подписанного токена, так что поддельный/протухший JWT провалит
  // именно эту проверку (а не молча пройдёт мимо неё).
  //
  // Обычно чтение из cookie идёт без сети. НО если токен протух, getSession
  // молча уходит его обновлять — и вот это уже сеть, которая может подвиснуть.
  // Не дождались — пускаем запрос дальше без проверок посредника: свой layout
  // у каждого раздела всё равно спросит, кто пришёл.
  const НЕ_УСПЕЛИ = Symbol("нет ответа");
  const сессия = await сПределом<
    { data: { session: { user: unknown; access_token?: string } | null } } | typeof НЕ_УСПЕЛИ
  >(
    supabase.auth.getSession() as never,
    НЕ_УСПЕЛИ,
    "чтение сессии",
  );
  if (сессия === НЕ_УСПЕЛИ) return response;

  const session = сессия.data.session as { user: { id: string }; access_token?: string } | null;
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  // Заход 1 (веб-родитель, вход по номеру): корень /parent — публичный
  // экран телефон-входа (заменяет старый /parent/join). Сама страница
  // (app/parent/page.tsx) редиректит уже залогиненного родителя на
  // /parent/home — здесь просто не гейтим, как раньше не гейтили join.
  const isParentLoginRoute = pathname === "/parent";
  // Возврат от Google. Сессии в этот момент ещё нет по определению — она
  // выдаётся внутри самого обработчика, — поэтому гейт «не залогинен → на
  // экран входа» тут съел бы код обмена и вход никогда бы не завершился.
  const isOauthCallback = pathname.startsWith("/auth/callback");
  const isTeacherRoute = pathname.startsWith("/teacher");
  const isAdminRoute = pathname.startsWith("/admin");
  const isSuperadminRoute = pathname.startsWith("/superadmin");
  // Раздел менеджера. Проверять пересечение с /admin не нужно: строки
  // начинаются по-разному, и «/manager» под startsWith("/admin") не попадёт.
  const isManagerRoute = pathname.startsWith("/manager");
  const isParentRoute = pathname.startsWith("/parent") && !isParentLoginRoute;

  // Публичный экран телефон-входа и возврат от провайдера — без гейта.
  if (isParentLoginRoute || isOauthCallback) {
    return response;
  }

  // Куда уводить незалогиненного: у родителя СВОЙ экран входа (телефон +
  // код), и отправлять его на ученический /login с логином, паролем и
  // кнопкой демо — значит показывать чужую дверь. Проверяется по маршруту,
  // потому что роль в этот момент ещё неизвестна: сессии нет.
  const loginPathFor = (path: string) => (path.startsWith("/parent") ? "/parent" : "/login");

  // Unauthenticated → login
  if (!user && !isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = loginPathFor(pathname);
    return NextResponse.redirect(target);
  }

  if (user) {
    // ── Single-session (PROMT 3, миграция 110): одна активная сессия на
    // аккаунт. session_id из JWT сверяется со строкой user_sessions;
    // 'replaced' = вошли с другого устройства, 'missing' = строки нет
    // (сессия снесена кроном / логин в обход server action / деплой
    // single-session). В обоих случаях локальный signOut + /login.
    const currentSessionId = session?.access_token
      ? sessionIdFromAccessToken(session.access_token)
      : null;

    // Промт «скорость», Задача 4: раньше check_user_session и роль
    // читались последовательно (роль запрашивалась только после того как
    // сессия подтверждена валидной) — второй round trip к Frankfurt поверх
    // первого. Роль не нужна, если сессия невалидна, но в общем случае
    // (валидная сессия — подавляющее большинство запросов) параллельный
    // запуск экономит один полный round trip; на редком invalid-session
    // пути роль просто выбрасывается ниже.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionCheckPromise: Promise<{ data: any; error: any }> = currentSessionId
      ? (supabase as any).rpc("check_user_session", { p_session_id: currentSessionId })
      : Promise.resolve({ data: null, error: null });
    const rolePromise = getCurrentUserRole(supabase, user.id);

    // Оба под пределом. Сверке сессии молчание отдаём как ОШИБКУ — ниже уже
    // есть правило «сбой сверки считаем годной сессией», и второго решения
    // заводить не надо. Роли молчание отдаём отдельным значением: пустая роль
    // означала бы «прав нет» и увела бы человека на экран входа.
    const [{ data: checkResult, error: checkError }, role] = await Promise.all([
      сПределом(sessionCheckPromise, { data: null, error: { message: "timeout" } }, "сверка сессии"),
      сПределом<UserRole | typeof РОЛЬ_НЕ_УСПЕЛА>(rolePromise, РОЛЬ_НЕ_УСПЕЛА, "чтение роли"),
    ]);

    // Fail-open при сбое RPC: недоступность БД не должна разлогинивать
    // всех пользователей разом.
    const sessionStatus = currentSessionId
      ? (checkError ? "ok" : (checkResult ?? "missing"))
      : "missing";

    if (sessionStatus !== "ok") {
      await supabase.auth.signOut({ scope: "local" });
      const target = request.nextUrl.clone();
      // Вытеснение сессии у родителя — тоже на родительский вход.
      target.pathname = loginPathFor(pathname);
      target.search = sessionStatus === "replaced" ? "?reason=session_replaced" : "";
      const redirectResponse = NextResponse.redirect(target);
      // signOut записал удаление auth-cookie в `response` через setAll —
      // переносим на redirect-ответ, иначе браузер останется «залогинен» и
      // middleware зациклит /login → home → /login.
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      redirectResponse.cookies.delete(DEMO_SESSION_COOKIE);
      return redirectResponse;
    }

    // Роль не приехала — решать нечем. Пускаем: чужой раздел всё равно
    // отобьёт свой layout, а данные — правила доступа.
    if (role === РОЛЬ_НЕ_УСПЕЛА) return response;

    const isSuperAdmin = role === "super_admin";
    const isManager = role === "manager";
    const isAdmin = role === "admin";
    const isParent = role === "parent";
    const isTeacher = role === "teacher";

    // Non-super_admin on /superadmin route → login
    if (isSuperadminRoute && !isSuperAdmin) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Super_admin on any other route → /superadmin/dashboard
    if (isSuperAdmin && !isSuperadminRoute && !isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = "/superadmin/dashboard";
      return NextResponse.redirect(target);
    }

    // Чужой на разделе менеджера → на вход. Пара к следующему правилу:
    // ровно так же устроены суперадмин, родитель и админ выше и ниже.
    if (isManagerRoute && !isManager) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Менеджер на любом чужом разделе → к себе. Заходы 2 и 3 добавят ему
    // право работать внутри школ; пока у него один свой адрес.
    if (isManager && !isManagerRoute && !isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = "/manager";
      return NextResponse.redirect(target);
    }

    // Non-parent on /parent route → login
    if (isParentRoute && !isParent) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Parent on any other route → /parent/home. Note: this never fires for
    // the /parent login screen itself — isParentLoginRoute returns early
    // above before role is even known; that page's own server component
    // handles "already authenticated → redirect to /parent/home".
    if (isParent && !isParentRoute && !isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = "/parent/home";
      return NextResponse.redirect(target);
    }

    // Non-admin on /admin route → login
    if (isAdminRoute && !isAdmin) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Admin on teacher or student routes → /admin
    if (isAdmin && !isAdminRoute && !isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = "/admin";
      return NextResponse.redirect(target);
    }

    // Non-teacher on teacher routes → login
    if (isTeacherRoute && !isTeacher) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Already logged in on login page → correct home
    if (isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = roleToHome(role);
      return NextResponse.redirect(target);
    }
  }

  return response;
}
