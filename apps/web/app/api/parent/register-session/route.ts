import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSession } from "@/lib/register-session";

/**
 * Запись сессии приложения в реестр одной сессии (миграция 110).
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МАРШРУТ. На вебе сессию выдаёт сервер, поэтому он же и
 * пишет строку в реестр. В приложении token_hash меняет на сессию само
 * устройство — сервер её не видит и session_id узнать не может. Приложение
 * приносит свежий токен сюда, сервер достаёт из него session_id и вытесняет
 * прежнее устройство.
 *
 * ОБЛАСТЬ. Только вход через Google. Вход по телефону в приложении реестр не
 * пополнял и раньше — трогать его этим заходом не стали, чтобы не разлогинить
 * тех, кто уже внутри. Это осознанная асимметрия, не забывчивость.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "failed" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return NextResponse.json({ error: "failed" }, { status: 401 });

  try {
    await registerSession({ userId: data.user.id, accessToken: token });
  } catch (e) {
    console.error("[register-session] не записалось:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
