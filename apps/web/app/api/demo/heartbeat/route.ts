// P2 — POST /api/demo/heartbeat
// Продлевает lease по session_token из cookie snr-demo-session.
// Вызывается каждые 5 минут пока открыта вкладка / приложение.
//
// Мобилка: session_token отдаётся ей через POST body (у неё нет cookie).
// Веб: читаем cookie сервером.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";

interface HeartbeatBody {
  session_token?: string;
}

export async function POST(req: Request) {
  // Приоритет: явный body.session_token (мобилка). Иначе cookie (веб).
  let token: string | null = null;
  try {
    const body = (await req.json()) as HeartbeatBody;
    if (typeof body?.session_token === "string" && body.session_token) {
      token = body.session_token;
    }
  } catch {
    // Пустое тело — норм для веба.
  }
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;
  }
  if (!token) {
    return NextResponse.json({ active: false, reason: "no_token" });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.rpc as any)("heartbeat_demo_slot", {
    p_session_token: token,
  });
  if (error) {
    console.error("[demo/heartbeat] rpc error:", error.message);
    return NextResponse.json({ active: false, reason: "rpc_error" }, { status: 500 });
  }
  const active = data === true;

  // Если lease протух — почистим cookie на веб-стороне, чтобы UI
  // перестал показывать баннер и вызывать heartbeat.
  if (!active) {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_SESSION_COOKIE);
  }

  return NextResponse.json({ active });
}
