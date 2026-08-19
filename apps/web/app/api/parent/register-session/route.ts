import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSession } from "@/lib/register-session";
import { denied } from "@/lib/api-guard";

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
  if (!token) return denied("/api/parent/register-session", "токена нет", 401);

  const admin = createAdminClient();
  // ЖИВОСТЬ И ВЛАДЕНИЕ ПРОВЕРЯЮТСЯ ЗДЕСЬ, И ЭТО НЕ НОВОЕ.
  //
  // getUser(token) идёт к Supabase и возвращает пользователя, только если
  // токен настоящий и не истёк. А поскольку вытесняем мы сессии ИМЕННО этого
  // пользователя, «принадлежит вызывающему» выполняется по построению: другой
  // человек может подставить сюда только свой же токен и разлогинить только
  // себя. Проверка стояла тут и до 19.08.2026 — менять её было незачем.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return denied("/api/parent/register-session", "токен недействителен или истёк", 401);
  }

  // 19.08.2026 — ДОБАВЛЕНО: токен должен принадлежать РОДИТЕЛЮ.
  //
  // Маршрут заведён под один сценарий — вход родителя через Google в
  // приложении, и токен сюда приходит только оттуда
  // (apps/mobile-parent/src/lib/parentGoogleLogin.ts). Проверка не чинит
  // известную дыру: чужие сессии по чужому токену и раньше было не тронуть.
  // Она сужает маршрут до его назначения, чтобы завтра он не стал общей
  // кнопкой «вытесни мои сессии» для любой роли.
  //
  // maybeSingle() безопасен: parents.user_id объявлен UNIQUE (миграция 74),
  // двух строк на одного человека быть не может, значит и 500 отсюда не
  // прилетит.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (admin as any)
    .from("parents").select("id").eq("user_id", data.user.id).maybeSingle();
  if (!parent) {
    return denied("/api/parent/register-session", "владелец токена не родитель", 403);
  }

  try {
    await registerSession({ userId: data.user.id, accessToken: token });
  } catch (e) {
    console.error("[register-session] не записалось:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
