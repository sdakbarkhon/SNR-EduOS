// Пачка 7.20 — read-only список всех чатов для admin: прямые
// (учитель↔ученик, chat_threads/chat_messages) + lesson-scoped AI-помощник
// (ai_chat_messages). EduOS Assistant (callAiChat Server Action) сюда
// НЕ входит — у него нет persistence вообще (проверено: чистый Gemini-
// вызов, ничего не пишет в БД), показывать нечего в принципе.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { encodeLessonChatId, AI_PARTICIPANT, type AdminChatSummary } from "@/lib/admin-chats";

const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
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
  const teacherId = sp.get("teacher_id") || null;
  const studentId = sp.get("student_id") || null;
  const groupId = sp.get("group_id") || null;
  const dateFrom = sp.get("date_from") || null;
  const dateTo = sp.get("date_to") || null;
  const type = (sp.get("type") || "all") as "direct" | "lesson" | "all";
  const cursor = sp.get("cursor") || null; // ISO timestamp — chats older than this
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || DEFAULT_LIMIT));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Резолвим school_id админа — нужен явно для service-role запроса к
  // ai_chat_messages (там нет current_school_id()-based RLS, admin-клиент
  // сессии не имеет вообще).
  const { data: adminRow } = await sb.from("admins").select("school_id").eq("user_id", user.id).maybeSingle();
  const schoolId: string | null = adminRow?.school_id ?? null;

  // group_id фильтр общий для обоих источников — резолвим student_id'ы
  // группы один раз.
  let groupStudentIds: string[] | null = null;
  if (groupId) {
    const { data: sgRows } = await sb.from("student_groups").select("student_id").eq("group_id", groupId);
    groupStudentIds = ((sgRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id);
  }

  const results: AdminChatSummary[] = [];

  // ── Прямые чаты (chat_threads kind='direct') — обычный cookie-клиент,
  //    RLS уже пускает admin'а читать всё в своей школе. ──────────────
  if (type === "all" || type === "direct") {
    let q = sb.from("chat_threads").select("id, student_id, teacher_id, updated_at").eq("kind", "direct");
    if (teacherId) q = q.eq("teacher_id", teacherId);
    if (studentId) q = q.eq("student_id", studentId);
    if (groupStudentIds) q = q.in("student_id", groupStudentIds.length ? groupStudentIds : ["00000000-0000-0000-0000-000000000000"]);
    if (dateFrom) q = q.gte("updated_at", dateFrom);
    if (dateTo) q = q.lte("updated_at", dateTo);
    if (cursor) q = q.lt("updated_at", cursor);

    const { data: threads, error: threadsErr } = await q.order("updated_at", { ascending: false }).limit(limit);
    if (threadsErr) return NextResponse.json({ error: threadsErr.message }, { status: 500 });

    const threadRows = (threads ?? []) as Array<{ id: string; student_id: string | null; teacher_id: string | null; updated_at: string }>;
    if (threadRows.length > 0) {
      const threadIds = threadRows.map((t) => t.id);
      const teacherIds = Array.from(new Set(threadRows.map((t) => t.teacher_id).filter(Boolean))) as string[];
      const studentIds = Array.from(new Set(threadRows.map((t) => t.student_id).filter(Boolean))) as string[];

      const [{ data: teacherRows }, { data: studentRows }, { data: msgRows }] = await Promise.all([
        teacherIds.length ? sb.from("teachers").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] }),
        studentIds.length ? sb.from("students").select("id, full_name").in("id", studentIds) : Promise.resolve({ data: [] }),
        sb.from("chat_messages").select("thread_id").in("thread_id", threadIds),
      ]);
      const teacherNameById = new Map<string, string>((teacherRows ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name]));
      const studentNameById = new Map<string, string>((studentRows ?? []).map((s: { id: string; full_name: string }) => [s.id, s.full_name]));
      const countByThread = new Map<string, number>();
      ((msgRows ?? []) as Array<{ thread_id: string }>).forEach((m) => countByThread.set(m.thread_id, (countByThread.get(m.thread_id) ?? 0) + 1));

      for (const t of threadRows) {
        results.push({
          id: t.id,
          type: "direct_teacher_student",
          participant_1: { id: t.teacher_id ?? "", name: teacherNameById.get(t.teacher_id ?? "") ?? "?", role: "teacher" },
          participant_2: { id: t.student_id ?? "", name: studentNameById.get(t.student_id ?? "") ?? "?", role: "student" },
          last_message_at: t.updated_at,
          message_count: countByThread.get(t.id) ?? 0,
        });
      }
    }
  }

  // ── Lesson AI-помощник (ai_chat_messages) — service-role, у таблицы
  //    нет admin RLS-политики. "Чат" = пара (student_id, lesson_id). ──
  if ((type === "all" || type === "lesson") && schoolId) {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = admin as any;

    let q = adminDb
      .from("ai_chat_messages")
      .select("student_id, lesson_id, created_at")
      .eq("school_id", schoolId);
    if (studentId) q = q.eq("student_id", studentId);
    if (groupStudentIds) q = q.in("student_id", groupStudentIds.length ? groupStudentIds : ["00000000-0000-0000-0000-000000000000"]);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo);

    const { data: aiRows, error: aiErr } = await q;
    if (aiErr) return NextResponse.json({ error: aiErr.message }, { status: 500 });

    type AiRow = { student_id: string; lesson_id: string; created_at: string };
    const byPair = new Map<string, { student_id: string; lesson_id: string; count: number; lastAt: string }>();
    for (const r of (aiRows ?? []) as AiRow[]) {
      const key = `${r.student_id}|${r.lesson_id}`;
      const existing = byPair.get(key);
      if (existing) {
        existing.count++;
        if (r.created_at > existing.lastAt) existing.lastAt = r.created_at;
      } else {
        byPair.set(key, { student_id: r.student_id, lesson_id: r.lesson_id, count: 1, lastAt: r.created_at });
      }
    }
    let pairs = Array.from(byPair.values());
    if (cursor) pairs = pairs.filter((p) => p.lastAt < cursor);

    // teacher_id фильтр для lesson-чатов — резолвим через lessons.group_id
    // -> groups.teacher_id (основной преподаватель группы; ко-teacher/
    // per-subject teacher не учитываем — та же упрощённая логика, что и
    // остальные фильтры этой задачи).
    if (teacherId && pairs.length) {
      const lessonIds = Array.from(new Set(pairs.map((p) => p.lesson_id)));
      const { data: lessonRows } = await adminDb.from("lessons").select("id, group_id").in("id", lessonIds);
      const { data: groupRows } = await adminDb
        .from("groups")
        .select("id, teacher_id")
        .in("id", Array.from(new Set(((lessonRows ?? []) as Array<{ group_id: string }>).map((l) => l.group_id))));
      const teacherByGroup = new Map<string, string>((groupRows ?? []).map((g: { id: string; teacher_id: string | null }) => [g.id, g.teacher_id ?? ""]));
      const groupByLesson = new Map<string, string>((lessonRows ?? []).map((l: { id: string; group_id: string }) => [l.id, l.group_id]));
      pairs = pairs.filter((p) => teacherByGroup.get(groupByLesson.get(p.lesson_id) ?? "") === teacherId);
    }

    pairs.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    pairs = pairs.slice(0, limit);

    if (pairs.length > 0) {
      const studentIds = Array.from(new Set(pairs.map((p) => p.student_id)));
      const lessonIds = Array.from(new Set(pairs.map((p) => p.lesson_id)));
      const [{ data: studentRows }, { data: lessonRows }] = await Promise.all([
        adminDb.from("students").select("id, full_name").in("id", studentIds),
        adminDb.from("lessons").select("id, topic").in("id", lessonIds),
      ]);
      const studentNameById = new Map<string, string>((studentRows ?? []).map((s: { id: string; full_name: string }) => [s.id, s.full_name]));
      const lessonTopicById = new Map<string, string>((lessonRows ?? []).map((l: { id: string; topic: string | null }) => [l.id, l.topic ?? "Урок"]));

      for (const p of pairs) {
        results.push({
          id: encodeLessonChatId(p.student_id, p.lesson_id),
          type: "lesson_ai_helper",
          participant_1: { id: p.student_id, name: studentNameById.get(p.student_id) ?? "?", role: "student" },
          participant_2: { ...AI_PARTICIPANT, name: `${AI_PARTICIPANT.name} (${lessonTopicById.get(p.lesson_id) ?? "урок"})` },
          lesson_id: p.lesson_id,
          last_message_at: p.lastAt,
          message_count: p.count,
        });
      }
    }
  }

  results.sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
  const page = results.slice(0, limit);

  return NextResponse.json({ chats: page });
}
