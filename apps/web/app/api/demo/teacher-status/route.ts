// P2 — GET /api/demo/teacher-status
// Для модалки «Демо учитель»: какие subject_slug сейчас заняты — они
// показываются серыми/«занят».

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Row { subject_slug: string }

export async function GET() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.rpc as any)("get_occupied_teacher_subjects");
  if (error) {
    console.error("[demo/teacher-status] rpc error:", error.message);
    return NextResponse.json({ occupied_subjects: [] as string[], error: "rpc_error" }, { status: 500 });
  }
  const occupied = ((data as Row[] | null) ?? [])
    .map((r) => r.subject_slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  return NextResponse.json({ occupied_subjects: occupied });
}
