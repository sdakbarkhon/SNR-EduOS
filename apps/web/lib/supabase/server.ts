import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database, Db } from "@snr/core";
import { getSupabaseEnv } from "../env";

/**
 * Клиент Supabase для сервера (Server Components / Route Handlers). Cookie-сессия.
 * Обёрнут в React `cache()` — один и тот же клиент переиспользуется всеми вызовами
 * в рамках одного запроса (layout + page), это даёт стабильную ссылку, необходимую
 * для дедупликации запросов через cache() в lib/cached-queries.ts.
 */
export const createClient = cache(async (): Promise<Db> => {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Вызвано из Server Component — запись cookie берёт на себя middleware.
        }
      },
    },
  }) as unknown as Db;
});
