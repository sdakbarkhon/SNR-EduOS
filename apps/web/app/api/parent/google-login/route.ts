import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findParentByGoogleEmail, issueParentSessionToken } from "@/lib/parent-google";

/**
 * Вход родителя через Google — половина, которая живёт на сервере.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ ВЕБА. На вебе весь путь проходит один обработчик
 * (app/auth/callback): он и код меняет, и сессию выдаёт, потому что сессия
 * там живёт в cookie того же браузера. В приложении cookie нет, и сессия
 * должна оказаться в защищённом хранилище устройства под тем же клиентом,
 * которым ходят все экраны. Поэтому шаги разделены: код на сессию Google
 * приложение меняет само, а сюда приносит её токен — только чтобы сервер
 * подтвердил почту и выдал одноразовый token_hash для НАСТОЯЩЕЙ учётной
 * записи родителя. Тот же приём, что в /api/parent/verify-code для входа по
 * телефону: сервер отдаёт token_hash, устройство меняет его на сессию.
 *
 * СВЕРКА ТА ЖЕ. findParentByGoogleEmail — общая с вебом функция: одна
 * нормализация, один уникальный индекс, одни причины отказа. Второй копии
 * логики не заводим.
 *
 * ПОЧЕМУ ПОЧТА БЕРЁТСЯ ИЗ ТОКЕНА, А НЕ ИЗ ТЕЛА ЗАПРОСА. Тело подделывается
 * тривиально. Токен — нет: его подпись проверяет сам Supabase, и почта в
 * ответе принадлежит той учётной записи, под которой человек реально вошёл.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "failed" }, { status: 401 });

  // Проверяем токен служебным клиентом: getUser(jwt) возвращает пользователя
  // только для реально подписанной Supabase сессии.
  const admin = createAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return NextResponse.json({ error: "failed" }, { status: 401 });

  // Почту должен подтвердить сам провайдер — неподтверждённую сверять нельзя.
  const verified =
    user.email_confirmed_at != null || user.user_metadata?.email_verified === true;
  const isGoogle =
    user.app_metadata?.provider === "google"
    || (user.app_metadata?.providers as string[] | undefined)?.includes("google") === true;

  if (!user.email || !verified || !isGoogle) {
    return NextResponse.json({ error: "not_linked" }, { status: 403 });
  }

  const found = await findParentByGoogleEmail(user.email);
  if (!found.ok) {
    const status = found.reason === "failed" ? 500 : 403;
    return NextResponse.json({ error: found.reason }, { status });
  }

  const tokenHash = await issueParentSessionToken(found.authEmail);
  if (!tokenHash) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true, tokenHash });
}
