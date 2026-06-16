"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database, Db } from "@snr/core";
import { getSupabaseEnv } from "../env";

/** Клиент Supabase для браузера (Client Components). */
export function createClient(): Db {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database, "public">(url, anonKey) as unknown as Db;
}
