// Пачка 7.20 — read-only полная переписка одного чата для admin.
// id либо реальный chat_threads.id (personal 'direct' или групповой
// 'group' чат), либо синтетический "lesson__{student_id}__{lesson_id}"
// (lesson-scoped AI-помощник) — см. lib/admin-chats.ts.
//
// Резолвинг отправителя для thread-based чатов обобщён через
// chat_participants (thread_id, user_id, role_in_thread) — работает
// одинаково для direct (student+teacher, и в будущем parent+teacher) и
// group (curator+students ИЛИ curator+parents): role_in_thread говорит,
// в какой таблице (teachers/students/parents) искать user_id.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { decodeLessonChatId, AI_PARTICIPANT, type AdminChatMessage, type AdminChatInfo } from "@/lib/admin-chats";

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

    // studentId/lessonId приходят напрямую из URL (decodeLessonChatId), не
    // из БД — прежде чем service-role'ом (bypass RLS) резолвить имя/тему,
    // явно проверяем, что ОБА принадлежат школе админа. Без этого пара из
    // чужой школы вернула бы 200 с реальным именем ученика/темой урока
    // чужой школы (messages были бы пустыми, но label — нет) — cross-
    // tenant утечка PII + oracle существования пары, найдено ревью перед
    // коммитом.
    const [{ data: studentRow }, { data: lessonRow }] = await Promise.all([
      adminDb.from("students").select("full_name").eq("id", lessonRef.studentId).eq("school_id", adminRow.school_id).maybeSingle(),
      adminDb.from("lessons").select("topic").eq("id", lessonRef.lessonId).eq("school_id", adminRow.school_id).maybeSingle(),
    ]);
    if (!studentRow || !lessonRow) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    const studentName = studentRow.full_name ?? "?";

    let q = adminDb
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("student_id", lessonRef.studentId)
      .eq("lesson_id", lessonRef.lessonId)
      .eq("school_id", adminRow.school_id);
    if (cursor) q = q.gt("created_at", cursor);

    const { data: rows, error } = await q.order("created_at", { ascending: true }).limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
    const topic = lessonRow?.topic ?? "урок";

    const chatInfo: AdminChatInfo = {
      id,
      type: "lesson_ai_helper",
      label: `${studentName} · AI-помощник (${topic})`,
      lesson_id: lessonRef.lessonId,
      last_message_at: lastAt,
      message_count: count ?? messages.length,
    };

    return NextResponse.json({ messages, chat_info: chatInfo });
  }

  // ── Personal ('direct') или групповой ('group') чат — cookie-клиент,
  //    RLS после миграции 142 пускает admin'а на оба kind. ────────────
  const { data: thread, error: threadErr } = await sb
    .from("chat_threads")
    .select("id, kind, student_id, teacher_id, group_id, title, updated_at")
    .eq("id", id)
    .single();
  if (threadErr || !thread || (thread.kind !== "direct" && thread.kind !== "group")) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let q = sb.from("chat_messages").select("id, sender_id, body, created_at").eq("thread_id", id);
  if (cursor) q = q.gt("created_at", cursor);
  const { data: msgRows, error: msgErr } = await q.order("created_at", { ascending: true }).limit(limit);
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Резолвим ВСЕХ участников треда через chat_participants → auth user_id
  // → (teachers|students|parents) по role_in_thread. Работает одинаково
  // для direct (student+teacher) и group (curator+students ИЛИ
  // curator+parents) — раньше direct-ветка резолвила только teacher/
  // student вручную и не умела показать parent-отправителя вообще.
  const { data: participantRows } = await sb
    .from("chat_participants")
    .select("user_id, role_in_thread")
    .eq("thread_id", id);
  const participants = (participantRows ?? []) as Array<{ user_id: string; role_in_thread: string }>;

  const teacherAuthIds = participants.filter((p) => p.role_in_thread === "teacher" || p.role_in_thread === "curator").map((p) => p.user_id);
  const studentAuthIds = participants.filter((p) => p.role_in_thread === "student").map((p) => p.user_id);
  const parentAuthIds = participants.filter((p) => p.role_in_thread === "parent").map((p) => p.user_id);

  const [{ data: teacherRows }, { data: studentRows }, { data: parentRows }] = await Promise.all([
    teacherAuthIds.length ? sb.from("teachers").select("id, full_name, user_id").in("user_id", teacherAuthIds) : Promise.resolve({ data: [] }),
    studentAuthIds.length ? sb.from("students").select("id, full_name, user_id").in("user_id", studentAuthIds) : Promise.resolve({ data: [] }),
    parentAuthIds.length ? sb.from("parents").select("id, full_name, user_id").in("user_id", parentAuthIds) : Promise.resolve({ data: [] }),
  ]);

  type NamedRow = { id: string; full_name: string; user_id: string };
  const senderByAuthId = new Map<string, { id: string; name: string; role: string }>();
  ((teacherRows ?? []) as NamedRow[]).forEach((t) => senderByAuthId.set(t.user_id, { id: t.id, name: t.full_name, role: "teacher" }));
  ((studentRows ?? []) as NamedRow[]).forEach((s) => senderByAuthId.set(s.user_id, { id: s.id, name: s.full_name, role: "student" }));
  ((parentRows ?? []) as NamedRow[]).forEach((p) => senderByAuthId.set(p.user_id, { id: p.id, name: p.full_name, role: "parent" }));

  const messages: AdminChatMessage[] = ((msgRows ?? []) as Array<{ id: string; sender_id: string | null; body: string; created_at: string }>).map((m) => ({
    id: m.id,
    sender: (m.sender_id && senderByAuthId.get(m.sender_id)) || { id: m.sender_id ?? "", name: "?", role: "unknown" },
    content: m.body,
    created_at: m.created_at,
    is_ai: false,
  }));

  const { count } = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", id);

  let label: string | null;
  let chatType: AdminChatInfo["type"];
  if (thread.kind === "direct") {
    const teacherName = senderByAuthId.get(participants.find((p) => p.role_in_thread === "teacher")?.user_id ?? "")?.name ?? "?";
    if (thread.student_id !== null) {
      const studentName = senderByAuthId.get(participants.find((p) => p.role_in_thread === "student")?.user_id ?? "")?.name ?? "?";
      chatType = "teacher_student";
      label = `${teacherName} ↔ ${studentName}`;
    } else {
      const parentName = senderByAuthId.get(participants.find((p) => p.role_in_thread === "parent")?.user_id ?? "")?.name ?? "?";
      chatType = "parent_teacher";
      label = `${teacherName} ↔ ${parentName}`;
    }
  } else {
    chatType = "class_group";
    label = thread.title ?? null;
    if (!label && thread.group_id) {
      const { data: groupRow } = await sb.from("groups").select("name").eq("id", thread.group_id).maybeSingle();
      label = groupRow?.name ?? null;
    }
    label = label ?? "Групповой чат";
  }

  const chatInfo: AdminChatInfo = {
    id: thread.id,
    type: chatType,
    label: label ?? "Групповой чат",
    last_message_at: thread.updated_at,
    message_count: count ?? messages.length,
  };

  return NextResponse.json({ messages, chat_info: chatInfo });
}
