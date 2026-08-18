import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerSession } from "@/lib/register-session";
import { findIdentityByGoogleEmail, issueSessionToken } from "@/lib/google-identity";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";

/**
 * Возврат от Google.
 *
 * ПОРЯДОК ВАЖЕН, и вот почему именно такой:
 *
 *   1. Меняем код на сессию. Эта сессия принадлежит УЧЁТНОЙ ЗАПИСИ GOOGLE —
 *      не родителю. Нужна она ровно за одним: узнать подтверждённую почту.
 *   2. Убеждаемся, что почту подтвердил сам Google. Неподтверждённую почту
 *      сверять нельзя: её можно вписать в чужой провайдер.
 *   3. Ищем человека с такой google_email — среди администраторов,
 *      родителей, учителей и учеников. Роль определяется находкой, а не
 *      тем, с какого экрана пришли.
 *   4. Гасим Google-сессию — в любом исходе. Не совпало — не оставляем висеть
 *      сессию, под которой человек всё равно ничего не увидит, кроме сбоя.
 *      Совпало — она тоже не нужна: дальше работает учётная запись родителя.
 *   5. Только теперь выдаём сессию НАСТОЯЩЕЙ учётной записи родителя и
 *      записываем её в реестр одной сессии.
 *
 * Связывание происходит ЗДЕСЬ, до первого перехода внутрь. На /parent/home
 * человек попадает уже под своим user_id, поэтому «роль не нашлась → экран
 * сбоя» на этом пути невозможен.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Причина отказа уезжает в адрес — экран входа переводит её на язык человека. */
function back(req: NextRequest, reason: string) {
  const url = req.nextUrl.clone();
  // Куда возвращать при отказе — знает только тот, кто начинал вход: с общего
  // экрана пришли или с родительского. Значение приехало в адресе возврата.
  url.pathname = req.nextUrl.searchParams.get("from") === "login" ? "/login" : "/parent";
  url.search = `?error=${reason}`;
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const providerError = req.nextUrl.searchParams.get("error");

  // Человек нажал «Отмена» на экране Google — это не сбой, молча возвращаем.
  if (providerError) return back(req, "cancelled");
  if (!code) return back(req, "failed");

  const supabase = await createClient();

  const { data: exchanged, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr || !exchanged?.user) {
    console.error("[auth/callback] обмен кода не удался:", exchangeErr?.message);
    return back(req, "failed");
  }

  const googleUser = exchanged.user;
  const verified =
    googleUser.email_confirmed_at != null
    || googleUser.user_metadata?.email_verified === true;
  const email = googleUser.email ?? null;

  // Школа, выбранная на экране входа. Пустая строка и мусор здесь безвредны:
  // сверка просто не совпадёт, и вход не откроется — то есть ошибка в эту
  // сторону закрывает доступ, а не открывает.
  const chosenSchool = req.nextUrl.searchParams.get("school");

  const found = email && verified
    ? await findIdentityByGoogleEmail(email, chosenSchool)
    : ({ ok: false, reason: "not_linked" } as const);

  // Шаг 4 — до любого редиректа и до выдачи новой сессии.
  await supabase.auth.signOut();

  if (!found.ok) return back(req, found.reason);

  const tokenHash = await issueSessionToken(found.authEmail);
  if (!tokenHash) return back(req, "failed");

  const { data: session, error: otpErr } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpErr || !session.user || !session.session) {
    console.error("[auth/callback] сессию выдать не удалось:", otpErr?.message);
    return back(req, "failed");
  }

  // Реестр одной сессии (миграция 110). До этого захода он пополнялся только
  // при входе по паролю и по телефону — вход через Google шёл бы мимо, и
  // вытеснение старого устройства не срабатывало бы.
  try {
    await registerSession({
      userId: session.user.id,
      accessToken: session.session.access_token,
    });
  } catch (e) {
    console.error("[auth/callback] реестр сессий:", e);
    return back(req, "failed");
  }

  // Куда вести — решает найденная роль, а не экран, с которого пришли:
  // администратор, вошедший через Google, должен попасть в админку.
  const home = req.nextUrl.clone();
  home.pathname = found.dest;
  home.search = "";
  const res = NextResponse.redirect(home);
  res.cookies.delete(DEMO_SESSION_COOKIE);
  return res;
}
