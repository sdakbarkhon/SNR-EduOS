import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 10;

export async function GET(req: NextRequest) {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: student } = await (db as any)
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "Not a student" }, { status: 403 });

  const lessonId = new URL(req.url).searchParams.get("lesson_id");
  if (!lessonId) return NextResponse.json({ error: "Missing lesson_id" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (db as any)
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .eq("student_id", student.id)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dayCountRaw } = await (db as any).rpc("fn_ai_messages_today", {
    p_student_id: student.id,
  });

  return NextResponse.json({
    messages: messages ?? [],
    remaining: Math.max(0, DAILY_LIMIT - ((dayCountRaw as number) ?? 0)),
  });
}
