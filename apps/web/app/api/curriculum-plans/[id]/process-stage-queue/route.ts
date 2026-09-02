// Ручной разбор очереди наполнения. Заход Q2, 03.09.2026.
//
// ЗАЧЕМ РУЧНАЯ КНОПКА, ЕСЛИ В Q3 БУДЕТ РАСПИСАНИЕ. Во-первых, до Q3 разбирать
// очередь некому вовсе. Во-вторых, кнопка нужна и после: расписание ходит раз
// в несколько минут, а учитель, поставивший три урока, хочет увидеть их
// сегодня. Ровно так же устроен разбор векторов: есть крон и есть кнопка на
// /admin/rag, и это не дубль — это два повода запустить одно и то же.
//
// ОДИН ВЫЗОВ — ОДИН УРОК. Один урок это до трёх обращений к модели и до шести
// картинок при потолке функции в 300 секунд; два в один вызов не влезают
// гарантированно. Пачку набирает вызывающий, повторяя запрос, — так же, как
// экран /admin/rag крутит свои батчи.
//
// ПРАВА. Учитель, и только владелец плана: чужую очередь разбирать незачем, а
// каждый вызов стоит денег.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlanById } from "@snr/core";
import { drainOneStageGenJob, countQueuedStageGenJobs } from "@/lib/ai/process-stage-gen-queue";

export const runtime = "nodejs";
// Столько же, сколько у самой генерации: этот маршрут её дожидается.
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  let plan;
  try {
    plan = await getCurriculumPlanById(db, planId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки плана" }, { status: 500 });
  }
  if (!plan) return NextResponse.json({ error: "План не найден" }, { status: 404 });
  if (plan.teacher_id !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.CRON_SECRET) {
    // Без секрета разборщик не сможет войти в маршрут генерации, и вызов
    // потратит время впустую. Лучше сказать сразу.
    return NextResponse.json({ error: "CRON_SECRET не задан на сервере" }, { status: 500 });
  }

  try {
    const итог = await drainOneStageGenJob(baseUrlOf(req));
    const остаток = await countQueuedStageGenJobs();
    return NextResponse.json({ ...итог, remaining: остаток });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка разбора очереди" },
      { status: 500 },
    );
  }
}
