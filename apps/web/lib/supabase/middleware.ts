import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@snr/core";
import { getSupabaseEnv } from "../env";
import { getCurrentUserRole, roleToHome } from "../auth";
import { DEMO_SESSION_COOKIE, sessionIdFromAccessToken } from "../single-session";

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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  const isParentJoinRoute = pathname.startsWith("/parent/join");
  const isTeacherRoute = pathname.startsWith("/teacher");
  const isAdminRoute = pathname.startsWith("/admin");
  const isSuperadminRoute = pathname.startsWith("/superadmin");
  const isParentRoute = pathname.startsWith("/parent") && !isParentJoinRoute;

  // Public, unauthenticated invite-registration flow — no guard at all.
  if (isParentJoinRoute) {
    return response;
  }

  // Unauthenticated → login
  if (!user && !isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
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

    const [{ data: checkResult, error: checkError }, role] = await Promise.all([
      sessionCheckPromise,
      rolePromise,
    ]);

    // Fail-open при сбое RPC: недоступность БД не должна разлогинивать
    // всех пользователей разом.
    const sessionStatus = currentSessionId
      ? (checkError ? "ok" : (checkResult ?? "missing"))
      : "missing";

    if (sessionStatus !== "ok") {
      await supabase.auth.signOut({ scope: "local" });
      const target = request.nextUrl.clone();
      target.pathname = "/login";
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

    const isSuperAdmin = role === "super_admin";
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

    // Non-parent on /parent route → login
    if (isParentRoute && !isParent) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }

    // Parent on any other route → /parent/dashboard
    if (isParent && !isParentRoute && !isAuthPage) {
      const target = request.nextUrl.clone();
      target.pathname = "/parent/dashboard";
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
