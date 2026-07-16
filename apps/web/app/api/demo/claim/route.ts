// P2 — POST /api/demo/claim
// Занять свободный аккаунт из пула (student/teacher/parent) через RPC
// claim_demo_slot (миграция 133), залогинить его сервер-сайд и вернуть
// клиенту куки + destination.
//
// Используется:
//   • веб /login (LoginForm: «Демо ученик» / модалка «Демо учитель»)
//   • мобилка apps/mobile-parent LoginScreen «Демо родитель»
//
// Логика:
//   1) parse body { role, subject_slug? }
//   2) rpc claim_demo_slot → username/email/password/session_token/user_id
//   3) signInWithPassword под этим email — Supabase server client ставит
//      свои auth cookies через cookies() адаптер
//   4) ставим snr-demo-session cookie с session_token (НЕ httpOnly —
//      клиентский useIsDemoSession читает его)
//   5) возвращаем { role, redirect_to, username }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";

type Role = "student" | "teacher" | "parent";

interface ClaimBody {
  role?: string;
  subject_slug?: string | null;
}

interface ClaimSlotRow {
  username: string | null;
  email: string;
  password: string;
  session_token: string;
  user_id: string;
}

function redirectFor(role: Role): string {
  switch (role) {
    case "student": return "/dashboard";
    case "teacher": return "/teacher/dashboard";
    case "parent":  return "/parent/dashboard";
  }
}

export async function POST(req: Request) {
  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const role = body.role;
  if (role !== "student" && role !== "teacher" && role !== "parent") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  const subjectSlug = role === "teacher" ? body.subject_slug ?? null : null;
  if (role === "teacher" && !subjectSlug) {
    return NextResponse.json({ error: "subject_slug_required" }, { status: 400 });
  }

  // 1) claim через service_role — anon-ветку тоже поддерживает RPC (GRANT
  // anon в 133), но service_role надёжнее для http-контекста без сессии.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claimed, error: claimError } = await (admin.rpc as any)("claim_demo_slot", {
    p_role: role,
    p_subject_slug: subjectSlug,
  });
  if (claimError) {
    const msg = claimError.message ?? "";
    if (msg.includes("no_available_slot")) {
      return NextResponse.json({ error: "no_available_slot" }, { status: 409 });
    }
    console.error("[demo/claim] rpc error:", claimError);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }
  const row = (claimed as ClaimSlotRow[] | null)?.[0];
  if (!row) {
    return NextResponse.json({ error: "no_available_slot" }, { status: 409 });
  }

  // 2) server-side sign in под этот аккаунт — cookies из Supabase server
  // адаптера ставятся автоматически.
  const supabase = await createClient();
  const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
    email: row.email,
    password: row.password,
  });
  if (signInError || !session?.session) {
    console.error("[demo/claim] signIn error:", signInError?.message);
    // rollback lease — освобождаем слот, чтобы не залипнуть на 15 минут.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)("release_demo_slot", { p_session_token: row.session_token });
    return NextResponse.json({ error: "signin_failed" }, { status: 500 });
  }

  // 3) ставим демо-cookie с session_token — идентификатор lease для
  // heartbeat/release. НЕ httpOnly (клиентский useIsDemoSession читает).
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, row.session_token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // maxAge 15 минут — совпадает с lease timeout. Клиент heartbeat'ит
    // раз в 5 минут → cookie автоматически продлевается на клиенте не
    // может (без js), но serve r-side refresh не критичен: браузер сам
    // не удалит cookie в течение сессии, а после 15 мин без heartbeat
    // lease протухает — при следующем request middleware / heartbeat
    // распознают протухшее состояние.
    maxAge: 15 * 60,
  });

  return NextResponse.json({
    role,
    redirect_to: redirectFor(role),
    username: row.username,
  });
}
