// 26.08.2026 — возвращён автоматический разбор очереди векторов.
//
// ЧТО БЫЛО СЛОМАНО. Триггер trg_enqueue_lesson_stage_embedding исправно
// кладёт этапы в lesson_stages_embedding_queue от любой роли, но разбирать их
// стало некому: маршрут /api/cron/rag-process-queue удалён 08.08.2026, а в
// расписании Vercel остался один крон — ночной откат демо. Две записи боевой
// школы пролежали в очереди с 22.08 с нулём попыток: их никто не брал.
//
// GET И POST ОБА ЗОВУТ ОДИН handler(). Vercel Cron всегда шлёт GET, и маршрут,
// экспортирующий только POST, молча получал бы 405 — на этом в проекте уже
// спотыкались дважды. POST оставлен для ручного вызова curl'ом.
//
// CRON_SECRET проверяется так же, как в restore-demo-lesson-shape: заголовок
// Authorization: Bearer или x-cron-secret. Без секрета в окружении маршрут
// отвечает 401 всем — открытая ручка, дёргающая платную модель, не нужна.
//
// ОБЕ ШКОЛЫ. schoolId в processEmbeddingQueueBatch не передаётся вовсе:
// очередь общая на всю базу, и крон работает за всех. Сужение по школе есть
// только у кнопки администратора — там оно к месту, здесь было бы вредно.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processEmbeddingQueueBatch, QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-embedding-queue";

/**
 * Потолок времени функции. На тарифе hobby и по умолчанию, и максимум — 300
 * секунд (проверено по документации Vercel, раздел про длительность функций,
 * fluid compute включён по умолчанию). Столько же просит ночной откат демо.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * СКОЛЬКО ЗАПИСЕЙ ЗА ПРОХОД — И ПОЧЕМУ СТОЛЬКО.
 *
 * Считано по живым данным: у 405 этапов один чанк, у 100 — два, у 18 — три.
 * Больше трёх нет ни у одного, в среднем 1.26. Каждый чанк — один вызов
 * модели плюс пауза 500 мс между вызовами (её ставит сам разборщик, чтобы не
 * упереться в ограничение Gemini по частоте).
 *
 * Худший случай на запись: 3 чанка ≈ 3 секунды вместе с выборкой этапа и
 * записью векторов. Шестьдесят записей — это 180 секунд при потолке в 300, то
 * есть две минуты запаса на холодный старт, задержки модели и ответ. Обычный
 * случай (1.26 чанка на этап) укладывается в 90–100 секунд.
 *
 * Запас взят большой намеренно: обрыв функции посреди записи оставляет этап с
 * частью векторов — старые чанки уже удалены, новые записаны не все.
 * Следующий проход это чинит, запись остаётся в очереди и перезаписывается
 * целиком, — но лучше не доводить.
 */
const BATCH_LIMIT = 60;

async function handler(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const startedAt = Date.now();

  try {
    // Пустая очередь — выходим, не потратив ни одного вызова модели. Это
    // счётная выборка без строк (head), самая дешёвая проверка, какая есть.
    const { count: pending, error: countErr } = await db
      .from("lesson_stages_embedding_queue")
      .select("lesson_stage_id", { count: "exact", head: true })
      .lt("attempts", QUEUE_MAX_ATTEMPTS);
    if (countErr) throw new Error(countErr.message);

    // Отложенные записи считаем отдельно и пишем в лог. Разборщик их не берёт
    // (attempts >= предела), и без этой строки они были бы невидимы: очередь
    // «пуста», а этапы без векторов.
    const { count: parked } = await db
      .from("lesson_stages_embedding_queue")
      .select("lesson_stage_id", { count: "exact", head: true })
      .gte("attempts", QUEUE_MAX_ATTEMPTS);

    if (!pending) {
      console.log(`[rag-process-queue] очередь пуста, вызовов модели ноль; отложено=${parked ?? 0}`);
      return NextResponse.json({ skipped: "empty_queue", pending: 0, parked: parked ?? 0 });
    }

    const res = await processEmbeddingQueueBatch(db, BATCH_LIMIT);
    const ms = Date.now() - startedAt;
    const line =
      `[rag-process-queue] processed=${res.processed} chunks=${res.embedded_chunks} ` +
      `errors=${res.errors} ждало=${pending} осталось≈${Math.max(0, pending - res.processed)} ` +
      `отложено=${parked ?? 0} за ${ms} мс`;

    // Ошибки не глотаем. Если не разобралось НИ ОДНОЙ записи, а ошибки были —
    // это не «разобрано ноль», это отказ: отвечаем 500, чтобы проход был
    // помечен неуспешным и попал в глаза, а не растворился в зелёном логе.
    if (res.errors > 0 && res.processed === 0) {
      console.error(line + " — не разобрано ничего, все попытки с ошибкой");
      return NextResponse.json({ ...res, pending, parked: parked ?? 0, ms }, { status: 500 });
    }
    if (res.errors > 0) console.error(line);
    else console.log(line);

    return NextResponse.json({ ...res, pending, parked: parked ?? 0, ms });
  } catch (e) {
    const msg = (e as Error)?.message ?? "process queue failed";
    console.error("[rag-process-queue] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
