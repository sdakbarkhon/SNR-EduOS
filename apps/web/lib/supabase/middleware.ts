import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@snr/core";
import { isAdminEmail, isTeacherEmail } from "@snr/core";
import { getSupabaseEnv } from "../env";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  const isTeacherRoute = pathname.startsWith("/teacher");
  const isAdminRoute = pathname.startsWith("/admin");

  const isTeacher = isTeacherEmail(user?.email);
  const isAdmin = isAdminEmail(user?.email);

  // Unauthenticated → login
  if (!user && !isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  // Non-admin on /admin route → login
  if (user && isAdminRoute && !isAdmin) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  // Admin on teacher or student routes → admin dashboard
  if (user && isAdmin && !isAdminRoute && !isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin";
    return NextResponse.redirect(target);
  }

  // Non-teacher on teacher routes → login
  if (user && isTeacherRoute && !isTeacher) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  // Already logged in on login page → go to correct home
  if (user && isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = isAdmin ? "/admin" : isTeacher ? "/teacher/dashboard" : "/dashboard";
    return NextResponse.redirect(target);
  }

  return response;
}
