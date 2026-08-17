import Constants from "expo-constants";
import { createBaseClient, type Db } from "@snr/core";
import { secureStorageAdapter } from "./secureStorageAdapter";

let client: Db | null = null;

type ExpoExtra = { supabaseUrl?: string; supabaseAnonKey?: string };

/** Синглтон клиента Supabase для mobile-parent (сессия в expo-secure-store).
 *
 *  Первичный источник — app.json's expo.extra (supabaseUrl/supabaseAnonKey),
 *  прочитанный через expo-constants: это значение вкомпилировано в
 *  манифест приложения и гарантированно доступно в любой сборке/OTA-
 *  апдейте, независимо от того, было ли на build-сервере (EAS) настроено
 *  окружение EXPO_PUBLIC_*. EXPO_PUBLIC_* (process.env, инлайнится Metro
 *  на этапе сборки) остаётся fallback'ом — например, для локального
 *  `expo start` с .env.local, где expoConfig.extra ещё не обновлён.
 *
 *  Раньше был только EXPO_PUBLIC_*-путь, и ни локального .env.local, ни
 *  EAS secret/env-переменной под ним никогда не существовало (см.
 *  `eas secret:list`/`eas env:list` — оба пусты для этого проекта), так
 *  что каждая сборка получала client=undefined и падала здесь на первом
 *  вызове. anonKey — публичное значение (та же логика, что и у
 *  NEXT_PUBLIC_SUPABASE_ANON_KEY на вебе, защищено RLS, не секрет),
 *  поэтому его можно хранить прямо в app.json. */
export function getSupabase(): Db {
  if (client) return client;
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  const url = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Отсутствуют supabaseUrl/supabaseAnonKey (app.json expo.extra) и EXPO_PUBLIC_SUPABASE_URL/ANON_KEY (.env.local) — оба источника пусты.",
    );
  }
  // flowType pkce — ради входа через Google: Supabase возвращает нас по схеме
  // приложения с параметром `code`, а секрет проверки к нему лежит здесь же, в
  // защищённом хранилище. На вход по телефону это не влияет никак: там код из
  // SMS меняется на сессию через verifyOtp, мимо этой схемы.
  client = createBaseClient({ url, anonKey, storage: secureStorageAdapter, flowType: "pkce" });
  return client;
}
