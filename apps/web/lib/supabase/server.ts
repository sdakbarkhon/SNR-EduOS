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

  const client = createServerClient<Database, "public">(url, anonKey, {
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

  // auth.getUser() does a real network round-trip (JWT revalidation against
  // Supabase Auth) on every call, and multiple call sites within one request
  // (a layout, a page, and query helpers like getMyStudent) each called it
  // independently — up to 3 round trips for what is the same request's same
  // user. Since createClient() is itself cache()'d (one client per request),
  // memoizing getUser() on that client here covers every call site — layout,
  // page, or deep inside a @snr/core query function — with zero changes to
  // any of them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawGetUser = client.auth.getUser.bind(client.auth) as (...args: any[]) => any;
  let cachedUserPromise: ReturnType<typeof rawGetUser> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.auth as any).getUser = (jwt?: string) => {
    if (jwt !== undefined) return rawGetUser(jwt);
    if (!cachedUserPromise) cachedUserPromise = rawGetUser();
    return cachedUserPromise;
  };

  return client;
});
