import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/** Типизированный клиент Supabase для всего проекта. */
export type Db = SupabaseClient<Database>;

/** Адаптер хранилища сессии (mobile передаёт обёртку над expo-secure-store). */
export interface SessionStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** Платформенное хранилище сессии. Опустить на сервере (SSR). */
  storage?: SessionStorage;
  /** false для серверного использования без авто-persist (SSR). */
  persistSession?: boolean;
}

/**
 * Базовый клиент для браузера (web client-side) и mobile (Expo).
 * Для Next.js SSR (cookie-сессии) используйте @supabase/ssr в приложении,
 * импортируя тип `Database` отсюда.
 */
export function createBaseClient(config: SupabaseConfig): Db {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      persistSession: config.persistSession ?? true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
