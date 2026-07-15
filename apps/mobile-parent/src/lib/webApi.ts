import Constants from "expo-constants";
import { getSupabase } from "./supabase";

// Промт МОБ-7 — первый вызов apps/web API-роута из мобильного приложения
// (все прежние экраны ходили только напрямую в Supabase). webApiBaseUrl —
// тот же паттерн, что supabaseUrl/supabaseAnonKey в supabase.ts: значение
// из app.json's expo.extra, вкомпилировано в манифест, доступно и в OTA-
// апдейтах (не требует новой сборки). Мобильный fetch не несёт cookies —
// авторизация идёт через Authorization: Bearer <access_token> заголовок
// (см. apps/web/lib/supabase/bearer.ts на стороне сервера).
type ExpoExtra = { webApiBaseUrl?: string };

function getWebApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra?.webApiBaseUrl) {
    throw new Error("webApiBaseUrl отсутствует (app.json expo.extra)");
  }
  return extra.webApiBaseUrl;
}

export async function callWebApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Нет активной сессии");

  const res = await fetch(`${getWebApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string })?.error ?? `Запрос не выполнен (${res.status})`);
  }
  return json as T;
}
