// Пачка 3, Задача 2 — GET /api/ai/usage
// Глобальный дневной счётчик Gemini-вызовов (миграция 136), показывается
// под чатом EduOS Assistant всем ролям. Читается через get_ai_usage_today()
// RPC (Asia/Tashkent day boundary) — та же таблица, что инкрементирует
// apps/web/lib/ai/gemini-client.ts на каждый успешный вызов.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const AI_USAGE_DAILY_LIMIT = 250;

export async function GET() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.rpc as any)("get_ai_usage_today");
  if (error) {
    console.error("[api/ai/usage] rpc error:", error.message);
    return NextResponse.json({ used: 0, limit: AI_USAGE_DAILY_LIMIT, remaining: AI_USAGE_DAILY_LIMIT, error: "rpc_error" }, { status: 500 });
  }
  const used = typeof data === "number" ? data : 0;
  return NextResponse.json({
    used,
    limit: AI_USAGE_DAILY_LIMIT,
    remaining: Math.max(0, AI_USAGE_DAILY_LIMIT - used),
  });
}
