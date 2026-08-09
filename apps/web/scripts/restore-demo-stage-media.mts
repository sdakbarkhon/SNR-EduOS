#!/usr/bin/env tsx
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 3б: картинки к этапам программирования и
// робототехники для 49 уроков, созданных заново после аварии.
//
// Зовёт ТОТ ЖЕ модуль, что и приложение — lib/ai/process-stage-media.ts.
// Ничего не копируем: и решение «нужна ли картинка» (decideStageMedia), и
// генерация с загрузкой в бакет lesson-stage-images идут штатным путём.
// Поэтому скрипт на TypeScript и запускается через tsx: .mjs не может
// импортировать TS без сборки.
//
// ПОЧЕМУ ВРУЧНУЮ. В приложении это фоновый вызов — addLessonStage
// (packages/core) стреляет в /api/stage-media/generate сразу после вставки
// этапа, но только из браузера (проверка "window" in globalThis), а этапы
// восстанавливались скриптом. Подстраховочный крон
// /api/cron/stage-media-backfill в vercel.json НЕ ЗАРЕГИСТРИРОВАН (на
// бесплатном тарифе Vercel два крона на проект, и единственный занят ночным
// откатом), так что само оно не подхватится.
//
// ОХВАТ. Только программирование и робототехника — как в эталоне: из 126
// этапов с media_status='generated' у уцелевших уроков 76 приходится на
// программирование и 50 на робототехнику, у остальных предметов колонка
// пуста. Модуль и сам отсеивает чужие предметы, но он при этом помечает их
// media_status='generated' — а в эталоне у них NULL. Поэтому фильтруем
// заранее, чтобы не наследить в 37 уроках других предметов.
//
// Картинки делает Pollinations (media_source у всех эталонных картинок
// именно такой) — бесплатно; Gemini Image пробуется первым и молча
// уступает. Платная часть здесь — только короткий вызов «нужна ли картинка»
// на этап.
//
// ЗАПУСК (из apps/web):
//   npx tsx --env-file=.env.local scripts/restore-demo-stage-media.mts
//   npx tsx --env-file=.env.local scripts/restore-demo-stage-media.mts --apply

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { processStageMediaForStage } from "../lib/ai/process-stage-media";

const APPLY = process.argv.includes("--apply");
const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";
const IN_SCOPE = ["Программирование", "Робототехника"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("!!! ОСТАНОВЛЕНО: нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (запускай с --env-file=.env.local)");
  process.exit(1);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = createClient(url, key, { auth: { persistSession: false } });

const fail = (msg: string) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, картинки не генерируются"}\n`);

const restoredIds: string[] = JSON.parse(
  fs.readFileSync(new URL("./.restored-lessons.json", import.meta.url), "utf8"),
).map((r: { id: string }) => r.id);
if (restoredIds.length !== 49) fail(`в списке восстановленных ${restoredIds.length} уроков вместо 49`);

const { data: lessons, error: lErr } = await db
  .from("lessons").select("id, topic, subject:subjects(name), group:groups(name)").in("id", restoredIds);
if (lErr) fail(`чтение уроков: ${lErr.message}`);

const inScope = (lessons ?? []).filter((l: { subject: { name: string } | null }) => IN_SCOPE.includes(l.subject?.name ?? ""));
const byId = new Map(inScope.map((l: { id: string }) => [l.id, l]));
console.log(`Уроков программирования и робототехники среди восстановленных: ${inScope.length} из 49`);
if (inScope.length === 0) { console.log("Нечего делать."); process.exit(0); }

// Этапы «Старт» исключены: в эталоне media_status у них пуст во всех 77
// уцелевших уроках без единого исключения — эту роль механизм не трогал
// никогда. Средние этапы и «Итог» обрабатываются (102 и 24 соответственно).
const { data: stages, error: sErr } = await db
  .from("lesson_stages").select("id, lesson_id, title, content_type, media_status, image_url")
  .in("lesson_id", inScope.map((l: { id: string }) => l.id))
  .neq("stage_role", "start").order("position");
if (sErr) fail(`чтение этапов: ${sErr.message}`);

const pending = (stages ?? []).filter((s: { media_status: string | null }) => s.media_status == null);
console.log(`Этапов у них: ${stages.length}; уже обработано: ${stages.length - pending.length}; в очереди: ${pending.length}\n`);

if (pending.length === 0) { console.log("Все этапы уже обработаны."); process.exit(0); }

const bySubject: Record<string, number> = {};
for (const s of pending) {
  const subj = (byId.get(s.lesson_id) as { subject: { name: string } | null } | undefined)?.subject?.name ?? "—";
  bySubject[subj] = (bySubject[subj] ?? 0) + 1;
}
console.log("── ЭТАПЫ В ОЧЕРЕДИ ──");
console.log("по предметам:", JSON.stringify(bySubject));
const byTitle: Record<string, number> = {};
for (const s of pending) byTitle[s.title] = (byTitle[s.title] ?? 0) + 1;
console.log("по названиям:", JSON.stringify(byTitle));
console.log("\nРешение «нужна ли этапу картинка» принимает сам модуль (decideStageMedia) —");
console.log("картинку получат не все, как и в эталоне: там из 152 этапов программирования");
console.log("и робототехники помечено обработанными 126.");
console.log(`\nВызовов Gemini «нужна ли картинка»: ${pending.length} (короткие, ~$0.10 суммарно).`);
console.log("Сами картинки — Pollinations, бесплатно.");

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply начнёт обработку.");
  process.exit(0);
}

let generated = 0, withImage = 0, failed = 0, skipped = 0;
for (const [i, s] of pending.entries()) {
  const lesson = byId.get(s.lesson_id) as { topic: string; group: { name: string } | null } | undefined;
  const prefix = `  [${i + 1}/${pending.length}] ${lesson?.group?.name?.replace(" класс", "") ?? "—"} · ${lesson?.topic ?? "—"} · ${s.title}`;
  try {
    const res = await processStageMediaForStage(db, s.id);
    if (res.status === "generated") { generated++; if (res.hadImage) withImage++; console.log(`${prefix} → ${res.hadImage ? "картинка" : "без картинки"}`); }
    else if (res.status === "failed") { failed++; console.error(`${prefix} → ошибка: ${res.error.slice(0, 90)}`); }
    else { skipped++; console.log(`${prefix} → пропуск (${res.reason})`); }
  } catch (e) {
    failed++;
    console.error(`${prefix} → исключение: ${(e as Error)?.message?.slice(0, 90)}`);
  }
}

console.log(`\nОбработано: ${generated}, из них с картинкой ${withImage}; ошибок ${failed}, пропущено ${skipped}.`);

const { data: after, error: aErr } = await db
  .from("lesson_stages").select("media_status, image_url")
  .in("lesson_id", inScope.map((l: { id: string }) => l.id));
if (aErr) fail(`перепроверка: ${aErr.message}`);
const st: Record<string, number> = {};
for (const s of after) st[s.media_status ?? "null"] = (st[s.media_status ?? "null"] ?? 0) + 1;
console.log("media_status у этих этапов:", JSON.stringify(st));
console.log(`С картинкой (image_url заполнен): ${after.filter((s: { image_url: string | null }) => s.image_url).length}`);

// Чужие предметы не должны были пострадать: у них media_status обязан
// остаться пустым, как в эталоне.
const otherIds = (lessons ?? []).filter((l: { subject: { name: string } | null }) => !IN_SCOPE.includes(l.subject?.name ?? "")).map((l: { id: string }) => l.id);
if (otherIds.length) {
  const { data: others } = await db.from("lesson_stages").select("media_status").in("lesson_id", otherIds);
  const touched = (others ?? []).filter((s: { media_status: string | null }) => s.media_status != null).length;
  console.log(`Этапы других предметов с непустым media_status: ${touched} (ожидание 0)`);
  if (touched > 0) fail("задеты этапы предметов вне охвата");
}
console.log("\nГОТОВО.");
