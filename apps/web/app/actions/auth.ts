"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { signInWithUsername } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_SESSION_COOKIE, sessionIdFromAccessToken } from "@/lib/single-session";

// P2 (пачка 2) — переработка демо-режима. Демо-логика теперь живёт в
// endpoints apps/web/app/api/demo/*, но demoLogin остаётся как «серверный
// wrapper» для DemoRoleModal (там уже был контракт server action —
// сохраняем для минимальных изменений в UI). Внутри он ровно то же,
// что делает /api/demo/claim: RPC claim_demo_slot → signInWithPassword →
// cookies.

type LoginResult =
  | { ok: true; dest: string; isDemo: boolean }
  | { ok: false; error: "invalid" | "failed" | "all_busy" };

interface ClaimSlotRow {
  username: string | null;
  email: string;
  password: string;
  session_token: string;
  user_id: string;
}

/**
 * Регистрирует новую single-session-строку в user_sessions (одна активная
 * сессия на аккаунт, все роли — миграция 110). В P2 больше НЕ пишет is_demo
 * и demo_started_at (эти колонки убраны миграцией 132) и НЕ вызывает
 * reset_demo_data_for_user (функция удалена миграцией 132) — демо-данные
 * больше не отделяются от реальных.
 *
 * Демо-cookie snr-demo-session ставится/чистится в endpoints /api/demo/*
 * (для новой lease-логики) или в signOut() (при выходе).
 */
async function registerSession(opts: {
  userId: string;
  accessToken: string;
}): Promise<void> {
  const sessionId = sessionIdFromAccessToken(opts.accessToken);
  if (!sessionId) {
    throw new Error("single-session: access token has no session_id claim");
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from("user_sessions")
    .delete()
    .eq("user_id", opts.userId);
  if (deleteError) {
    throw new Error(`single-session: evict failed: ${deleteError.message}`);
  }

  const ua = (await headers()).get("user-agent");
  const { error: insertError } = await admin.from("user_sessions").insert({
    user_id: opts.userId,
    session_id: sessionId,
    device_info: ua ? ua.slice(0, 512) : null,
  });
  if (insertError) {
    throw new Error(`single-session: register failed: ${insertError.message}`);
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
  await registerSession({
    userId: user.id,
    accessToken: result.data.session.access_token,
  });

  // Обычный логин — не демо. Cookie DEMO_SESSION_COOKIE ставится ТОЛЬКО
  // при demoLogin (или endpoint /api/demo/claim). Здесь защитно снимаем
  // если она осталась от предыдущей демо-сессии этого же браузера.
  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: await resolveDest(supabase, user.id), isDemo: false };
}

export async function demoLogin(
  target:
    | { kind: "teacher"; slug: "programming" | "robotics" | "math" | "english" | "russian" }
    | { kind: "student" }
    | { kind: "parent" },
): Promise<LoginResult> {
  const admin = createAdminClient();
  const supabase = await createClient();

  const role = target.kind;
  const subjectSlug = target.kind === "teacher" ? target.slug : null;

  // 1) claim slot через новый RPC (миграция 133).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claimed, error: claimError } = await (admin.rpc as any)("claim_demo_slot", {
    p_role: role,
    p_subject_slug: subjectSlug,
  });
  if (claimError) {
    const msg = claimError.message ?? "";
    if (msg.includes("no_available_slot")) {
      return { ok: false, error: "all_busy" };
    }
    console.error("[demoLogin] claim rpc error:", claimError);
    return { ok: false, error: "failed" };
  }
  const row = (claimed as ClaimSlotRow[] | null)?.[0];
  if (!row) return { ok: false, error: "all_busy" };

  // 2) signIn под этим email — Supabase server client ставит auth cookies.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: row.email,
    password: row.password,
  });
  if (error || !data.session) {
    // Rollback lease чтобы не залипло на 15 мин.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)("release_demo_slot", { p_session_token: row.session_token });
    console.error("[demoLogin] signIn error:", error?.message);
    return { ok: false, error: "failed" };
  }

  await registerSession({
    userId: data.user.id,
    accessToken: data.session.access_token,
  });

  // 3) ставим демо-cookie с session_token — используется useIsDemoSession,
  // DemoBanner, DemoHeartbeat и endpoint'ами heartbeat/release.
  (await cookies()).set(DEMO_SESSION_COOKIE, row.session_token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });

  const dest =
    role === "teacher" ? "/teacher/dashboard" :
    role === "parent"  ? "/parent/dashboard"  :
                         "/dashboard";
  return { ok: true, dest, isDemo: true };
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const cookieStore = await cookies();
  const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;

  // Release lease + штамп last_activity — best-effort (не блокируем редирект).
  after(async () => {
    const admin = createAdminClient();
    if (demoToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("release_demo_slot", { p_session_token: demoToken });
    }
    if (userId) {
      await admin
        .from("user_sessions")
        .update({ last_activity: new Date().toISOString() })
        .eq("user_id", userId);
    }
  });

  // scope:'local' — глобальный signOut отозвал бы refresh-токен сессии,
  // которая только что вытеснила эту.
  await supabase.auth.signOut({ scope: "local" });
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect("/login");
}
