// P2 — POST /api/demo/release
// Explicit release lease + full sign out. Вызывается при клике
// «Выйти из демо» в DemoBanner (веб/мобилка).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { denied } from "@/lib/api-guard";

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

  // 19.08.2026 — ПРИНИМАЕМ ТОЛЬКО ВЛАДЕЛЬЦА МЕСТА.
  //
  // Что было: токен не проверялся вовсе. Без токена маршрут всё равно
  // доходил до signOut ниже и снимал auth-cookie ТОГО, ЧЬЯ COOKIE ПРИЕХАЛА С
  // ЗАПРОСОМ, — то есть посторонний POST разлогинивал человека. Не
  // эксплуатировалось это сегодня по единственной причине: и демо-cookie
  // (actions/auth.ts), и auth-cookie от @supabase/ssr выставлены sameSite
  // lax, а кросс-сайтовый POST под lax cookie не несёт. Защита на одном
  // атрибуте — не защита.
  //
  // Что стало: без живой аренды на этот токен маршрут не делает НИЧЕГО —
  // ни освобождения места, ни выхода, ни снятия cookie. Логика самого
  // освобождения не тронута: ниже всё тот же release_demo_slot.
  if (!token) {
    return denied("/api/demo/release", "токена аренды нет ни в теле, ни в cookie", 401);
  }

  const admin = createAdminClient();
  // Чтение, не запись: проверяем, что такая аренда есть и ещё не закрыта.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lease } = await (admin as any)
    .from("demo_leases").select("id, released_at").eq("session_token", token).maybeSingle();

  if (!lease || lease.released_at) {
    return denied("/api/demo/release", "аренды по такому токену нет или она уже закрыта", 403);
  }

  // Release lease — не критично если токен просрочен: RPC вернёт false,
  // ошибку не бросит.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.rpc as any)("release_demo_slot", { p_session_token: token });

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
