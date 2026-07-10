"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  signInWithUsername,
  usernameToEmail,
  TEACHER_EMAIL_DOMAIN,
  DEMO_EMAIL_DOMAIN,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_SESSION_COOKIE, sessionIdFromAccessToken } from "@/lib/single-session";

// PROMT 3 single-session: логин теперь ТОЛЬКО через эти server actions —
// это единственная точка, где регистрируется user_sessions-строка (одна
// активная сессия на аккаунт, все роли). Клиентский signInWithPassword в
// LoginForm/DemoRoleModal убран: сессия без строки в user_sessions будет
// немедленно выкинута middleware'ом.

/** Демо-карточка предмета → реальный предметный учитель (миграция 109). */
const DEMO_TEACHER_BY_SLUG: Record<string, string> = {
  programming: "teacher_prog",
  robotics: "teacher_robot",
  math: "teacher_math",
  english: "teacher_english",
  russian: "teacher_russian",
};

type LoginResult =
  | { ok: true; dest: string; isDemo: boolean }
  | { ok: false; error: "invalid" | "failed" | "all_busy" };

/**
 * Вытесняет предыдущую сессию аккаунта (DELETE+INSERT в user_sessions) и
 * ставит/чистит демо-куку. Если вытесненная сессия была демо — немедленно
 * зачищает её следы (reset_demo_data_for_user): новый демо-гость получает
 * чистую площадку, реальный владелец не видит демо-мусор.
 */
async function registerSession(opts: {
  userId: string;
  accessToken: string;
  isDemo: boolean;
}): Promise<void> {
  const sessionId = sessionIdFromAccessToken(opts.accessToken);
  if (!sessionId) {
    throw new Error("single-session: access token has no session_id claim");
  }

  const admin = createAdminClient();

  const { data: evicted, error: deleteError } = await admin
    .from("user_sessions")
    .delete()
    .eq("user_id", opts.userId)
    .select("is_demo, created_at")
    .maybeSingle();
  if (deleteError) {
    throw new Error(`single-session: evict failed: ${deleteError.message}`);
  }
  if (evicted?.is_demo) {
    const { error: resetError } = await admin.rpc("reset_demo_data_for_user", {
      p_user_id: opts.userId,
      p_since: evicted.created_at,
    });
    if (resetError) {
      // Не блокируем логин: orphan-sweep в reset_expired_demo_sessions()
      // добёрет хвосты в течение 3 часов.
      console.error("[auth] reset_demo_data_for_user failed:", resetError.message);
    }
  }

  const ua = (await headers()).get("user-agent");
  const demoStartedAt = opts.isDemo ? new Date().toISOString() : null;
  const { error: insertError } = await admin.from("user_sessions").insert({
    user_id: opts.userId,
    session_id: sessionId,
    device_info: ua ? ua.slice(0, 512) : null,
    is_demo: opts.isDemo,
    demo_started_at: demoStartedAt,
  });
  if (insertError) {
    throw new Error(`single-session: register failed: ${insertError.message}`);
  }

  const cookieStore = await cookies();
  if (opts.isDemo) {
    cookieStore.set(DEMO_SESSION_COOKIE, JSON.stringify({ demo_started_at: demoStartedAt }), {
      // Сознательно НЕ httpOnly — см. комментарий у DEMO_SESSION_COOKIE.
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  } else {
    cookieStore.delete(DEMO_SESSION_COOKIE);
  }
}

/** Приоритет как в middleware: super_admin > admin > parent > teacher > student. */
async function resolveDest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const [superAdminRes, adminRes, parentRes, teacherRes] = await Promise.all([
    supabase.from("super_admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("parents").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (superAdminRes.data) return "/superadmin/dashboard";
  if (adminRes.data) return "/admin";
  if (parentRes.data) return "/parent/dashboard";
  if (teacherRes.data) return "/teacher/dashboard";
  return "/dashboard";
}

export async function loginWithUsername(
  username: string,
  password: string,
): Promise<LoginResult> {
  const supabase = await createClient();
  const result = await signInWithUsername(supabase, username, password);
  if (result.error || !result.data?.user || !result.data.session) {
    return { ok: false, error: "invalid" };
  }

  const user = result.data.user;
  // Прямой логин в пул-аккаунт demo_student_* по паролю — тоже демо-сессия.
  const isDemo = (user.email ?? "").endsWith(`@${DEMO_EMAIL_DOMAIN}`);
  await registerSession({
    userId: user.id,
    accessToken: result.data.session.access_token,
    isDemo,
  });

  return { ok: true, dest: await resolveDest(supabase, user.id), isDemo };
}

export async function demoLogin(
  target:
    | { kind: "teacher"; slug: "programming" | "robotics" | "math" | "english" | "russian" }
    | { kind: "student"; grade: "3" | "7" | "10" },
): Promise<LoginResult> {
  const supabase = await createClient();

  if (target.kind === "teacher") {
    // Прямой логин под РЕАЛЬНЫМ предметным учителем с флагом демо-сессии.
    // Пул демо-учителей удалён миграцией 110.
    const username = DEMO_TEACHER_BY_SLUG[target.slug];
    if (!username) return { ok: false, error: "failed" };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username, TEACHER_EMAIL_DOMAIN),
      password: process.env.DEMO_TEACHER_PASSWORD ?? "password123",
    });
    if (error || !data.session) return { ok: false, error: "failed" };
    await registerSession({
      userId: data.user.id,
      accessToken: data.session.access_token,
      isDemo: true,
    });
    return { ok: true, dest: "/teacher/dashboard", isDemo: true };
  }

  // Ученики остаются пулом (90 аккаунтов demo_student_{grade}_NN). RPC теперь
  // server-only (EXECUTE у anon/authenticated отозван миграцией 110).
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc("claim_demo_account", {
    p_kind: "student",
    p_grade: target.grade,
  });
  const account = claimed?.[0];
  if (claimError || !account) return { ok: false, error: "all_busy" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: "demo2026",
  });
  if (error || !data.session) return { ok: false, error: "failed" };
  await registerSession({
    userId: data.user.id,
    accessToken: data.session.access_token,
    isDemo: true,
  });
  return { ok: true, dest: "/dashboard", isDemo: true };
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Строку user_sessions НЕ удаляем — только штампуем last_activity.
    // Так «вышел >3ч назад» и «неактивен 3ч» для крона — одно условие
    // (reset_expired_demo_sessions v2, миграция 110).
    const admin = createAdminClient();
    await admin
      .from("user_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  // scope:'local' — глобальный signOut отозвал бы refresh-токен сессии,
  // которая только что вытеснила эту (login нового устройства использует
  // тот же auth-аккаунт).
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(DEMO_SESSION_COOKIE);
  redirect("/login");
}
