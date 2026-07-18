// Пачка 7.20 — read-only полная переписка одного чата для admin.
// id либо реальный chat_threads.id (прямой чат), либо синтетический
// "lesson__{student_id}__{lesson_id}" (lesson-scoped AI-помощник) —
// см. lib/admin-chats.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { decodeLessonChatId, AI_PARTICIPANT, type AdminChatMessage, type AdminChatSummary } from "@/lib/admin-chats";

const DEFAULT_LIMIT = 100;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole(supabase, user.id);
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const cursor = sp.get("cursor") || null; // ISO timestamp — messages newer than this cursor already loaded
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || DEFAULT_LIMIT));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const lessonRef = decodeLessonChatId(id);

  if (lessonRef) {
    // ── Lesson AI-помощник — service-role (нет admin RLS на ai_chat_messages) ──
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = admin as any;

    const { data: adminRow } = await sb.from("admins").select("school_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow?.school_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let q = adminDb
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("student_id", lessonRef.studentId)
      .eq("lesson_id", lessonRef.lessonId)
      .eq("school_id", adminRow.school_id);
    if (cursor) q = q.gt("created_at", cursor);

    const { data: rows, error } = await q.order("created_at", { ascending: true }).limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const [{ data: studentRow }, { data: lessonRow }] = await Promise.all([
      adminDb.from("students").select("full_name").eq("id", lessonRef.studentId).maybeSingle(),
      adminDb.from("lessons").select("topic").eq("id", lessonRef.lessonId).maybeSingle(),
    ]);
    const studentName = studentRow?.full_name ?? "?";

    const messages: AdminChatMessage[] = ((rows ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>).map((m) => ({
      id: m.id,
      sender: m.role === "assistant" ? AI_PARTICIPANT : { id: lessonRef.studentId, name: studentName, role: "student" },
      content: m.content,
      created_at: m.created_at,
      is_ai: m.role === "assistant",
    }));

    const { count } = await adminDb
      .from("ai_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("student_id", lessonRef.studentId)
      .eq("lesson_id", lessonRef.lessonId)
      .eq("school_id", adminRow.school_id);
    const lastAt = messages.length ? messages[messages.length - 1]!.created_at : new Date(0).toISOString();

    const chatInfo: AdminChatSummary = {
      id,
      type: "lesson_ai_helper",
      participant_1: { id: lessonRef.studentId, name: studentName, role: "student" },
      participant_2: { ...AI_PARTICIPANT, name: `${AI_PARTICIPANT.name} (${lessonRow?.topic ?? "урок"})` },
      lesson_id: lessonRef.lessonId,
      last_message_at: lastAt,
      message_count: count ?? messages.length,
    };

    return NextResponse.json({ messages, chat_info: chatInfo });
  }

  // ── Прямой чат (chat_threads/chat_messages) — обычный cookie-клиент,
  //    RLS уже пускает admin'а. ──────────────────────────────────────
  const { data: thread, error: threadErr } = await sb
    .from("chat_threads")
    .select("id, kind, student_id, teacher_id, updated_at")
    .eq("id", id)
    .single();
  if (threadErr || !thread || thread.kind !== "direct") {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let q = sb.from("chat_messages").select("id, sender_id, body, created_at").eq("thread_id", id);
  if (cursor) q = q.gt("created_at", cursor);
  const { data: msgRows, error: msgErr } = await q.order("created_at", { ascending: true }).limit(limit);
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const [{ data: teacherRow }, { data: studentRow }, { count }] = await Promise.all([
    thread.teacher_id ? sb.from("teachers").select("full_name").eq("id", thread.teacher_id).maybeSingle() : Promise.resolve({ data: null }),
    thread.student_id ? sb.from("students").select("full_name").eq("id", thread.student_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", id),
  ]);
  const teacherName = teacherRow?.full_name ?? "?";
  const studentName = studentRow?.full_name ?? "?";

  // sender_id на chat_messages — auth.users id учителя или ученика этого
  // треда (только двое участников в 'direct'), различаем сравнением с
  // teacher_id/student_id самого треда через отдельный lookup, т.к.
  // sender_id — auth.uid(), не teachers.id/students.id напрямую.
  const [{ data: teacherAuth }, { data: studentAuth }] = await Promise.all([
    thread.teacher_id ? sb.from("teachers").select("user_id").eq("id", thread.teacher_id).maybeSingle() : Promise.resolve({ data: null }),
    thread.student_id ? sb.from("students").select("user_id").eq("id", thread.student_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const messages: AdminChatMessage[] = ((msgRows ?? []) as Array<{ id: string; sender_id: string | null; body: string; created_at: string }>).map((m) => {
    const isTeacher = m.sender_id && teacherAuth?.user_id === m.sender_id;
    const isStudent = m.sender_id && studentAuth?.user_id === m.sender_id;
    return {
      id: m.id,
      sender: isTeacher
        ? { id: thread.teacher_id, name: teacherName, role: "teacher" }
        : isStudent
          ? { id: thread.student_id, name: studentName, role: "student" }
          : { id: m.sender_id ?? "", name: "?", role: "unknown" },
      content: m.body,
      created_at: m.created_at,
      is_ai: false,
    };
  });

  const chatInfo: AdminChatSummary = {
    id: thread.id,
    type: "direct_teacher_student",
    participant_1: { id: thread.teacher_id ?? "", name: teacherName, role: "teacher" },
    participant_2: { id: thread.student_id ?? "", name: studentName, role: "student" },
    last_message_at: thread.updated_at,
    message_count: count ?? messages.length,
  };

  return NextResponse.json({ messages, chat_info: chatInfo });
}
