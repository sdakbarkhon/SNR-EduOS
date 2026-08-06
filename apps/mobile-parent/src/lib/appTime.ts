// Заморозка времени навсегда — 29.07.2026 10:50 Ташкент (client requirement
// 05.08.2026, тот же принцип и та же дата, что apps/web/lib/demo-date.ts).
// Значение читается из app.json → expo.extra.frozenDate
// (Constants.expoConfig.extra — тот же первичный источник, что уже
// используется для supabaseUrl/supabaseAnonKey, см. src/lib/supabase.ts), с
// хардкод-фолбэком на случай, если extra почему-то не пришёл. Публикуется
// через `eas update` (OTA) — runtimeVersion зафиксирован строкой в
// app.json, не зависит от extra, так что новый APK/переустановка Expo Go не
// нужны.
//
// 06.08.2026: дата днём временно уезжала на 01.08 и была возвращена на
// 29.07 — вместо подгонки якоря под данные пересчитали сами статусы уроков
// (apps/web/scripts/fix-lesson-statuses-frozen-week.mjs, см. resheniya_2.md).
// Фолбэк ниже держим синхронно с app.json, иначе при отсутствии extra
// мобилка молча разошлась бы с вебом по дате.
//
// NB: фикстуры прототипа (src/data/fixtures/schedule.ts::DEMO_TODAY,
// «среда 29 июля») — ОТДЕЛЬНЫЙ мок со своей сеткой слотов, не читает БД и
// сюда не завязан; сознательно не трогаем (см. resheniya_2.md 06.08).
// После возврата якоря на 29.07 он снова совпадает с ним по дате.

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
