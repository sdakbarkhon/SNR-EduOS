// Заморозка времени навсегда — 01.08.2026 10:50 Ташкент (client requirement
// 05.08.2026, дата исправлена 06.08.2026, тот же принцип и та же новая дата,
// что apps/web/lib/demo-date.ts). Значение читается из app.json →
// expo.extra.frozenDate (Constants.expoConfig.extra — тот же первичный
// источник, что уже используется для supabaseUrl/supabaseAnonKey, см.
// src/lib/supabase.ts), с хардкод-фолбэком на случай, если extra почему-то
// не пришёл. Публикуется через `eas update` (OTA) — runtimeVersion
// зафиксирован строкой в app.json, не зависит от extra, так что новый
// APK/переустановка Expo Go не нужны.
//
// 06.08.2026: якорь переставлен 29.07 → 01.08 (время 10:50 сохранено) —
// на 29.07 все уроки в БД уже completed, правило "1-completed/
// 2-in_progress/3+ ручной старт" реально выполняется только на 01.08.
// Фолбэк ниже держим синхронно с app.json, иначе при отсутствии extra
// мобилка молча разошлась бы с вебом по дате.
//
// NB: фикстуры прототипа (src/data/fixtures/schedule.ts::DEMO_TODAY,
// «среда 29 июля») — ОТДЕЛЬНЫЙ мок со своей сеткой слотов, не читает БД и
// сюда не завязан; сознательно не трогаем (см. resheniya_2.md 06.08).

import Constants from "expo-constants";

const FROZEN = new Date((Constants.expoConfig?.extra?.frozenDate as string | undefined) ?? "2026-08-01T05:50:00.000Z");

export function getAppNow(): Date {
  return new Date(FROZEN);
}

export function getAppNowMs(): number {
  return FROZEN.getTime();
}

export function isFrozen(): boolean {
  return true;
}
