// 07.08.2026 — ночной откат формы уроков демо-школы (см. vercel.json,
// 19:00 UTC = 00:00 по Ташкенту).
//
// Зачем. Форма «1-й урок прошёл / 2-й идёт / 3-й и дальше ждут» расползается
// от живых демо-посетителей. Миграция 173 закрыла старт за ПРОШЕДШИЕ дни, но
// 29.07 и позже стартовать по-прежнему можно — это осознанно, возможность
// запускать уроки наперёд показывают клиентам, — поэтому за день форма всё
// равно уезжает. Крон возвращает эталон раз в сутки.
//
// GET и POST оба зовут общий handler(): Vercel Cron всегда шлёт GET, и в этом
// проекте на этом уже дважды ломались кроны (см. комментарий в
// rag-process-queue/route.ts). POST оставлен для ручного вызова curl'ом.
//
// Только демо-школа и только таблица lessons — вся логика в
// _lib/restore-demo-shape.ts, там же описан жёсткий порядок фаз и почему он
// именно такой.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreDemoLessonShape } from "../_lib/restore-demo-shape";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  try {
    const res = await restoreDemoLessonShape(db);
    console.log(
      `[restore-demo-lesson-shape] changed=${res.changed} unchanged=${res.unchanged} ` +
        `byPhase=${JSON.stringify(res.byPhase)} errors=${res.errors.length}`,
    );
    return NextResponse.json(res);
  } catch (e) {
    const msg = (e as Error)?.message ?? "restore failed";
    console.error("[restore-demo-lesson-shape] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
