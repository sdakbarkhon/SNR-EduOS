// Заморозка времени навсегда — 29.07.2026 10:50 Ташкент (client requirement
// 05.08.2026, тот же принцип, что apps/web/lib/demo-date.ts). Значение
// читается из app.json → expo.extra.frozenDate (Constants.expoConfig.extra —
// тот же первичный источник, что уже используется для supabaseUrl/
// supabaseAnonKey, см. src/lib/supabase.ts), с хардкод-фолбэком на случай,
// если extra почему-то не пришёл. Публикуется через `eas update` (OTA) —
// runtimeVersion зафиксирован строкой в app.json, не зависит от extra, так
// что новый APK/переустановка Expo Go не нужны.

import Constants from "expo-constants";

const FROZEN = new Date((Constants.expoConfig?.extra?.frozenDate as string | undefined) ?? "2026-07-29T05:50:00.000Z");

export function getAppNow(): Date {
  return new Date(FROZEN);
}

export function getAppNowMs(): number {
  return FROZEN.getTime();
}

export function isFrozen(): boolean {
  return true;
}
