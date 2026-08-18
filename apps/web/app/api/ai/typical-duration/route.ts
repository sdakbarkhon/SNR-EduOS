import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_TASK_VALUES } from "@/lib/ai/usage";

// Сколько обычно занимает задача ИИ — по НАСТОЯЩИМ замерам.
//
// Медиана duration_ms из ai_usage_events: той самой таблицы учёта расходов,
// куда время пишется на каждом обращении к модели. Медиана, а не среднее:
// один сорвавшийся вызов с тридцатью секундами ретраев не должен сдвигать
// обещание, которое читает учитель.
//
// Замеров нет — возвращаем null, и экран не показывает никакого числа.
// Придумать «обычно 40 секунд» было бы проще, но это ровно то враньё, из-за
// которого потом не верят и настоящим числам.
//
// Читать вправе любой вошедший: это длительность работы, а не чьи-то данные.
// Строки читаются служебным ключом, потому что сама таблица закрыта на
// суперадмина (миграция 209), — но наружу уходит ОДНО число и ничего больше.

export const dynamic = "force-dynamic";

const MAX_SAMPLES = 40;

export async function GET(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = req.nextUrl.searchParams.get("task") ?? "";
  if (!(AI_TASK_VALUES as string[]).includes(task)) {
    return NextResponse.json({ medianMs: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any)
    .from("ai_usage_events")
    .select("duration_ms")
    .eq("task", task)
    .eq("ok", true)
    .not("duration_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_SAMPLES);

  if (error || !data?.length) return NextResponse.json({ medianMs: null });

  const ms = (data as Array<{ duration_ms: number }>)
    .map((r) => r.duration_ms)
    .sort((a, b) => a - b);

  return NextResponse.json({ medianMs: ms[Math.floor(ms.length / 2)] ?? null, samples: ms.length });
}
