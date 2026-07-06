import "react-native-url-polyfill/auto";
import { createBaseClient, type Db } from "@snr/core";
import { secureStorageAdapter } from "./secureStorageAdapter";

let client: Db | null = null;

/** Синглтон клиента Supabase для mobile-parent (сессия в expo-secure-store). */
export function getSupabase(): Db {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Отсутствуют EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (см. .env.example)",
    );
  }
  client = createBaseClient({ url, anonKey, storage: secureStorageAdapter });
  return client;
}
