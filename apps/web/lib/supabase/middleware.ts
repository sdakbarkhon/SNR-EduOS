import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@snr/core";
import { getSupabaseEnv } from "../env";
import { getCurrentUserRole, roleToHome } from "../auth";

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
  const isSuperadminRoute = pathname.startsWith("/superadmin");

  // Unauthenticated → login
  if (!user && !isAuthPage) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  if (user) {
    const role = await getCurrentUserRole(supabase, user.id);
    const isSuperAdmin = role === "super_admin";
    const isAdmin = role === "admin";
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
