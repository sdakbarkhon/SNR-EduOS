import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database, Db } from "@snr/core";
import { getSupabaseEnv } from "../env";

/** Same auth.users / same session-cookie name as apps/web -- shares login if the
 *  two apps end up on the same parent domain with cookieOptions.domain set there. */
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
          // Called from a Server Component -- middleware owns the write.
        }
      },
    },
  }) as unknown as Db;
});
