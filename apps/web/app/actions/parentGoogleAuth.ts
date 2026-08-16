"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Начало входа родителя через Google.
 *
 * Действие серверное намеренно: клиент @supabase/ssr работает в режиме PKCE, и
 * секрет проверки (code_verifier) при таком вызове кладётся в HttpOnly-cookie
 * сервером. Тот же сервер потом читает его в /auth/callback. Начни мы вход из
 * браузера — секрет лёг бы в хранилище вкладки, и обменять код на сессию на
 * сервере было бы нечем.
 *
 * Возвращаем адрес, а не редиректим сами: экран входа — клиентский компонент,
 * ему проще увести окно самому и показать ошибку, если адрес не пришёл.
 */
export type GoogleStartResult = { ok: true; url: string } | { ok: false };

export async function startParentGoogleLogin(origin: string): Promise<GoogleStartResult> {
  // Адрес возврата собираем из origin, который пришёл от браузера, но берём из
  // него только схему и хост — чтобы подставленный кем-то путь или параметры
  // не уехали в redirectTo. Совсем чужой адрес Supabase и так отбросит: список
  // разрешённых адресов возврата ведётся в настройках проекта.
  let redirectTo: string;
  try {
    const u = new URL(origin);
    redirectTo = `${u.protocol}//${u.host}/auth/callback`;
  } catch {
    return { ok: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Просим Google каждый раз показывать выбор аккаунта: на общем семейном
      // компьютере молчаливый вход в последний аккаунт — это вход не туда.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    console.error("[parentGoogleAuth] не удалось начать вход:", error?.message);
    return { ok: false };
  }
  return { ok: true, url: data.url };
}
