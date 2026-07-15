import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Db } from "@snr/core";
import { getSupabaseEnv } from "../env";

/** Промт МОБ-7 — RLS-клиент для роутов, вызываемых мобильным приложением
 *  (без cookies: createClient() из server.ts читает сессию из cookies,
 *  недоступных нативному fetch с телефона). Тот же anon key, что и
 *  cookie-клиент, но авторизация — через Authorization: Bearer <access_token>
 *  заголовок, который мобильный клиент шлёт сам (см. apps/mobile-parent/src/
 *  lib/webApi.ts). PostgREST/RLS видит этот заголовок как обычный
 *  авторизованный запрос — auth.uid() резолвится корректно для ВСЕХ
 *  запросов через этот клиент, не только auth.getUser(). */
export function createBearerClient(accessToken: string): Db {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as Db;
}
