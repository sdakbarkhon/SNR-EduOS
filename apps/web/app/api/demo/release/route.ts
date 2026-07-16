// P2 — POST /api/demo/release
// Explicit release lease + full sign out. Вызывается при клике
// «Выйти из демо» в DemoBanner (веб/мобилка).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";

interface ReleaseBody {
  session_token?: string;
}

export async function POST(req: Request) {
  let token: string | null = null;
  try {
    const body = (await req.json()) as ReleaseBody;
    if (typeof body?.session_token === "string" && body.session_token) {
      token = body.session_token;
    }
  } catch {}
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;
  }

  // Release lease — не критично если токен просрочен: RPC вернёт false,
  // ошибку не бросит.
  if (token) {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)("release_demo_slot", { p_session_token: token });
  }

  // signOut текущего Supabase-пользователя (снимает auth cookies).
  // scope:'local' — как в actions/auth.ts signOut(), чтобы не отозвать
  // refresh-токен другой сессии.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  // Убрать демо-cookie.
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
