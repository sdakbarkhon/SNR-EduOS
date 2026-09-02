// Крон-вход разбора очереди наполнения. Заход Q3, 03.09.2026.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ МАРШРУТ, ЕСЛИ РУЧНОЙ УЖЕ ЕСТЬ. Ручной
// (/api/curriculum-plans/[id]/process-stage-queue) просит сессию учителя и
// проверяет, что план его. У расписания сессии нет и быть не может: зовёт
// база через pg_net. Поэтому здесь второй вход — по секрету, как у четырёх
// существующих кронов, — а работа делается той же самой функцией
// drainOneStageGenJob. Второй копии разбора не заведено.
//
// GET И POST ОБА ЗОВУТ ОДИН handler(). pg_net шлёт POST, но маршрут, знающий
// только один глагол, в этом проекте уже дважды молча отвечал 405. Пусть
// умеет оба.
//
// ОДИН УРОК ЗА ВЫЗОВ — решено в Q2 и здесь не меняется. Пачку набирает
// расписание, просыпаясь каждые пять минут (миграция 248).

import { NextRequest, NextResponse } from "next/server";
import { drainOneStageGenJob, countQueuedStageGenJobs } from "@/lib/ai/process-stage-gen-queue";

export const runtime = "nodejs";
/** Столько же, сколько у самой генерации: этот маршрут её дожидается. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Свой же адрес — маршрут генерации зовётся по HTTP (см. разборщик). */
function baseUrlOf(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function handler(req: NextRequest) {
  // Тот же способ, что у rag-process-queue и restore-demo-lesson-shape:
  // Authorization: Bearer или x-cron-secret. Без секрета в окружении маршрут
  // отвечает 401 всем — открытая ручка, дёргающая платную модель, не нужна.
  const cronSecret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // Очередь проверяет и база перед тем, как звать нас (fn_kick_stage_gen_queue),
    // но проверить ещё раз здесь стоит один счётный запрос без строк: между
    // пробуждением и приходом сюда строку мог забрать ручной запуск.
    const ждёт = await countQueuedStageGenJobs();
    if (!ждёт) {
      console.log("[stage-gen-process] очередь пуста, вызовов модели ноль");
      return NextResponse.json({ kind: "empty", remaining: 0 });
    }

    const итог = await drainOneStageGenJob(baseUrlOf(req));
    const остаток = await countQueuedStageGenJobs();
    const ms = Date.now() - startedAt;

    if (итог.kind === "failed") {
      // Отказ не глотаем и не прячем в зелёный лог: строка осталась в очереди
      // или слегла совсем, и это должно быть видно. Но отвечаем 200 — иначе
      // pg_net запишет ошибку, а никакой пользы от красного статуса нет:
      // повторять будет следующее пробуждение, а не эта строка.
      console.error(
        `[stage-gen-process] урок=${итог.lessonId} отказ: ${итог.reason} ` +
          `(попытка ${итог.attemptSpent ? "потрачена" : "не потрачена"}), осталось ${остаток}, ${ms} мс`,
      );
    } else if (итог.kind === "done") {
      console.log(
        `[stage-gen-process] урок=${итог.lessonId} этапов ${итог.inserted}, ` +
          `стёрто ${итог.removed}, осталось ${остаток}, ${ms} мс`,
      );
    }

    return NextResponse.json({ ...итог, remaining: остаток });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка разбора очереди";
    console.error("[stage-gen-process] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
