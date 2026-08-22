#!/usr/bin/env node
// 22.08.2026 — РАЗОВЫЙ РАЗБОР НАКОПИВШЕЙСЯ ОЧЕРЕДИ ЭМБЕДДИНГОВ.
//
// ЗАЧЕМ. Триггеры в базе исправно ставят этапы в lesson_stages_embedding_queue
// при каждой правке текста, а разбирать её было некому: крон снят 08.08.2026,
// событие при создании этапа уходит только из браузера, скрипты наполнения
// пишут в lesson_stages напрямую. К 22.08 накопилась 291 запись, и ни одной
// попытки разбора по ним не было. Этот скрипт — разовая уборка накопленного;
// дальше очередь держат в нуле событие при создании/правке этапа
// (packages/core::requestStageIndexing) и кнопка на /admin/rag.
//
// ПОЧЕМУ .ts, А НЕ .mjs, КАК ОСТАЛЬНЫЕ СКРИПТЫ. Чтобы не заводить вторую
// копию логики разбора. Скрипт импортирует НАСТОЯЩИЕ processEmbeddingQueueBatch
// и extractChunks — те самые, которыми работают маршруты. Вторая копия
// нарезки текста означала бы, что куски из скрипта и куски из кнопки со
// временем разъедутся, а заметить это было бы нечем.
//
// ЗАПУСК (из apps/web):
//   npx tsx --env-file=.env.local scripts/drain-rag-queue.ts             ← холостой
//   npx tsx --env-file=.env.local scripts/drain-rag-queue.ts --confirm   ← запись
//
// Холостой прогон НЕ ХОДИТ К МОДЕЛИ ВООБЩЕ: он читает очередь, прогоняет
// настоящую нарезку и считает, сколько обращений и денег потребует запись.
//
// ПРЕДЕЛ ЗАПРОСОВ. Бесплатный тариф Gemini даёт около 1000 обращений в сутки.
// Скрипт сам останавливается, не доходя до предела (--max-requests, по
// умолчанию 900), и печатает, сколько осталось: доделать можно назавтра, ту
// же команду повторно — очередь уменьшается по мере разбора, обработанное
// второй раз не считается.

import { createClient } from "@supabase/supabase-js";
import { extractChunks } from "@/lib/ai/chunk-extractor";
import { processEmbeddingQueueBatch, QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-embedding-queue";

const BATCH_LIMIT = 20;
/** Столько же, сколько в проде (lib/ai/process-embedding-queue.ts). */
const INTER_CALL_DELAY_MS = 500;
/** Цена gemini-embedding-001 за миллион входных токенов — из lib/ai/config.ts. */
const PRICE_USD_PER_1M_INPUT = 0.15;

const CONFIRM = process.argv.includes("--confirm");
const maxRequestsArg = process.argv.find((a) => a.startsWith("--max-requests="));
const MAX_REQUESTS = maxRequestsArg ? Number(maxRequestsArg.split("=")[1]) : 900;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} отсутствует — запускай с --env-file=.env.local из apps/web`);
  return v;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type QueueRow = { lesson_stage_id: string; school_id: string; attempts: number; enqueued_at: string };

async function main() {
  const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: queue, error } = await db
    .from("lesson_stages_embedding_queue")
    .select("lesson_stage_id, school_id, attempts, enqueued_at")
    .lt("attempts", QUEUE_MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (queue ?? []) as QueueRow[];
  console.log(`\nВ очереди к разбору: ${rows.length} записей`);
  if (rows.length === 0) {
    console.log("Разбирать нечего — очередь пуста.\n");
    return;
  }

  // ── Холостой счёт. Настоящая нарезка, но ни одного обращения к модели ────
  let totalChunks = 0;
  let totalChars = 0;
  let emptyStages = 0;
  const byType = new Map<string, { stages: number; chunks: number; chars: number }>();
  const bySchool = new Map<string, number>();

  // Читаем пачками, а не по одной записи: 291 этап по одному — это почти
  // шестьсот кругов до базы, из Ташкента это минуты ожидания на пустом месте.
  type StageRow = {
    id: string;
    content_type: string | null;
    slides: Array<{ title?: string; content?: string }> | null;
    description: string | null;
    teacher_notes: string | null;
  };
  const stageById = new Map<string, StageRow>();
  const ids = rows.map((r) => r.lesson_stage_id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: page } = await db
      .from("lesson_stages")
      .select("id, content_type, slides, description, teacher_notes")
      .in("id", ids.slice(i, i + 200));
    for (const s of (page ?? []) as StageRow[]) stageById.set(s.id, s);
  }

  const quizIds = [...stageById.values()]
    .filter((s) => s.content_type === "quiz_qia" || s.content_type === "quiz_kahoot")
    .map((s) => s.id);
  const questionsByStage = new Map<string, Array<{ question_text: string; options: string[] }>>();
  for (let i = 0; i < quizIds.length; i += 200) {
    const { data: page } = await db
      .from("quiz_questions")
      .select("stage_id, question_text, options")
      .in("stage_id", quizIds.slice(i, i + 200))
      .order("position");
    for (const q of (page ?? []) as Array<{ stage_id: string; question_text: string; options: string[] }>) {
      const list = questionsByStage.get(q.stage_id) ?? [];
      list.push({ question_text: q.question_text, options: q.options });
      questionsByStage.set(q.stage_id, list);
    }
  }

  for (const row of rows) {
    const stage = stageById.get(row.lesson_stage_id);
    // Этапа нет — запись очереди осиротела. Разбор снимет её сам, обращений
    // к модели она не потребует.
    if (!stage) continue;

    const quizQuestions = questionsByStage.get(stage.id) ?? [];
    const chunks = extractChunks(stage, quizQuestions);
    const chars = chunks.reduce((sum, c) => sum + c.length, 0);
    totalChunks += chunks.length;
    totalChars += chars;
    if (chunks.length === 0) emptyStages++;

    const key = stage.content_type ?? "без типа";
    const acc = byType.get(key) ?? { stages: 0, chunks: 0, chars: 0 };
    byType.set(key, { stages: acc.stages + 1, chunks: acc.chunks + chunks.length, chars: acc.chars + chars });
    bySchool.set(row.school_id, (bySchool.get(row.school_id) ?? 0) + chunks.length);
  }

  // Кириллица режется примерно по 2-2.5 символа на токен, латиница по 4.
  // Считаем вилкой, а не одним числом: врать точностью тут не из чего.
  const tokensLow = Math.round(totalChars / 4);
  const tokensHigh = Math.round(totalChars / 2);
  const costLow = (tokensLow / 1_000_000) * PRICE_USD_PER_1M_INPUT;
  const costHigh = (tokensHigh / 1_000_000) * PRICE_USD_PER_1M_INPUT;
  // Сон в проде: между кусками внутри этапа и после каждого этапа — итого
  // ровно по одному сну на кусок. Плюс ответ модели, 0.2-0.4 с на обращение.
  const sleepSec = (totalChunks * INTER_CALL_DELAY_MS) / 1000;
  const minSec = sleepSec + totalChunks * 0.2;
  const maxSec = sleepSec + totalChunks * 0.4;

  console.log("\n── ХОЛОСТОЙ СЧЁТ ─────────────────────────────────────────");
  console.log(`Этапов к разбору      : ${rows.length}`);
  console.log(`Из них без текста     : ${emptyStages} (обращений не потребуют)`);
  console.log(`Обращений к модели    : ${totalChunks} (одно на кусок)`);
  console.log(`Символов текста       : ${totalChars.toLocaleString("ru-RU")}`);
  console.log(`Токенов, вилка        : ${tokensLow.toLocaleString("ru-RU")} — ${tokensHigh.toLocaleString("ru-RU")}`);
  console.log(`Деньги, вилка         : $${costLow.toFixed(4)} — $${costHigh.toFixed(4)}`);
  console.log(`Время, ожидание       : ${Math.round(minSec / 6) / 10}-${Math.round(maxSec / 6) / 10} мин чистой работы + круг до базы на каждый шаг`);
  console.log(`Предел за сутки       : ${MAX_REQUESTS} обращений (бесплатный тариф ~1000)`);
  if (totalChunks > MAX_REQUESTS) {
    console.log(`ВНИМАНИЕ: ${totalChunks} > ${MAX_REQUESTS} — за один раз не уложится, остаток доделать назавтра.`);
  }
  console.log("\nПо типам содержимого:");
  for (const [type, v] of [...byType.entries()].sort((a, b) => b[1].chunks - a[1].chunks)) {
    console.log(`  ${type.padEnd(16)} этапов ${String(v.stages).padStart(4)}  кусков ${String(v.chunks).padStart(4)}  символов ${v.chars.toLocaleString("ru-RU")}`);
  }
  console.log("\nПо школам (id → кусков):");
  for (const [school, chunks] of bySchool.entries()) console.log(`  ${school}  ${chunks}`);

  if (!CONFIRM) {
    console.log("\nЭто ХОЛОСТОЙ прогон: к модели не обращались, в базу не писали.");
    console.log("Запись — той же командой с флагом --confirm.\n");
    return;
  }

  // ── Запись ───────────────────────────────────────────────────────────────
  console.log("\n── РАЗБОР ────────────────────────────────────────────────");
  let processed = 0;
  let embedded = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (;;) {
    if (embedded >= MAX_REQUESTS) {
      console.log(`\nОСТАНОВКА: сделано ${embedded} обращений, это предел на сутки (--max-requests=${MAX_REQUESTS}).`);
      break;
    }

    const result = await processEmbeddingQueueBatch(db, BATCH_LIMIT);
    processed += result.processed;
    embedded += result.embedded_chunks;
    failed += result.errors;

    const { count: remaining } = await db
      .from("lesson_stages_embedding_queue")
      .select("*", { count: "exact", head: true })
      .lt("attempts", QUEUE_MAX_ATTEMPTS);

    const mins = Math.round((Date.now() - startedAt) / 6000) / 10;
    console.log(
      `батч: разобрано ${result.processed}, кусков ${result.embedded_chunks}, ошибок ${result.errors} — ` +
      `осталось ${remaining ?? 0}, всего ${processed} этапов за ${mins} мин`,
    );

    if (result.processed === 0 && result.errors === 0) {
      console.log("Батч вернулся пустым — очередь разобрана.");
      break;
    }
    if (result.processed === 0 && result.errors > 0) {
      // Все записи батча упали подряд — почти всегда это предел обращений.
      // Дальше давить бессмысленно и вредно: attempts дойдёт до предела и
      // записи выпадут из разбора совсем.
      const { data: errs } = await db
        .from("lesson_stages_embedding_queue")
        .select("last_error")
        .not("last_error", "is", null)
        .limit(3);
      console.log("\nОСТАНОВКА: весь батч упал. Последние ошибки:");
      for (const e of (errs ?? []) as Array<{ last_error: string }>) {
        console.log(`  ${String(e.last_error).slice(0, 200)}`);
      }
      console.log("Если это предел запросов в сутки — повторить ту же команду завтра.");
      break;
    }
    if ((remaining ?? 0) === 0) break;

    await sleep(INTER_CALL_DELAY_MS);
  }

  const { count: left } = await db
    .from("lesson_stages_embedding_queue")
    .select("*", { count: "exact", head: true })
    .lt("attempts", QUEUE_MAX_ATTEMPTS);
  const { count: stuck } = await db
    .from("lesson_stages_embedding_queue")
    .select("*", { count: "exact", head: true })
    .gte("attempts", QUEUE_MAX_ATTEMPTS);
  const { count: chunksTotal } = await db
    .from("lesson_stage_embeddings")
    .select("*", { count: "exact", head: true });

  console.log("\n── ИТОГ ──────────────────────────────────────────────────");
  console.log(`Разобрано этапов      : ${processed}`);
  console.log(`Обращений к модели    : ${embedded}`);
  console.log(`Ошибок                : ${failed}`);
  console.log(`Осталось в очереди    : ${left ?? 0}`);
  console.log(`Выпало по числу попыток: ${stuck ?? 0}`);
  console.log(`Кусков в базе всего   : ${chunksTotal ?? 0}`);
  console.log(`Время                 : ${Math.round((Date.now() - startedAt) / 6000) / 10} мин\n`);
}

main().catch((e) => {
  console.error("\nСКРИПТ УПАЛ:", (e as Error)?.message ?? e);
  process.exit(1);
});
