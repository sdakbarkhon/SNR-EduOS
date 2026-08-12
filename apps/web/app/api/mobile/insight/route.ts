import { NextRequest, NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { buildParentInsight, normalizeInsightLocale } from "@/lib/ai/parent-insight";

// Промт МОБ-7, ЧАСТЬ 2 — v8 "EduOS Assistant Insight". Вызывается из
// apps/mobile-parent/src/screens/InsightScreen.tsx — мобильный fetch не
// несёт cookies (в отличие от веба), поэтому этот роут НЕ использует
// createClient() из lib/supabase/server.ts (cookie-based), а требует
// Authorization: Bearer <access_token> и строит RLS-клиент через
// createBearerClient() (lib/supabase/bearer.ts) — тот же anon key, но
// auth.uid() резолвится из явно переданного JWT для ЛЮБОГО запроса через
// этот клиент, не только auth.getUser().
//
// 12.08.2026 — сама сборка разбора переехала в lib/ai/parent-insight.ts:
// тот же код понадобился веб-экрану помощника, а тот ходит с cookie, не с
// bearer. Здесь остался ровно способ входа; поведение и форма ответа
// сохранены дословно, включая недельный кэш и запись через service_role.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createBearerClient(token);

  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { childId?: string; locale?: string; force?: boolean };
  if (!body.childId) return NextResponse.json({ error: "childId required" }, { status: 400 });

  const result = await buildParentInsight(db, {
    userId: user.id,
    childId: body.childId,
    locale: normalizeInsightLocale(body.locale),
    force: body.force === true,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    ...result.payload,
    generatedAt: result.generatedAt,
    cached: result.cached,
    ...(result.stale ? { stale: true } : {}),
  });
}
