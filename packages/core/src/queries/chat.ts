/* Chat queries (migration 78). Tables aren't in the generated types yet, so
 * we use `(db as any)` like the other migration-30+ modules (see projects.ts). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";

export type ChatThreadKind = "group" | "direct" | "admin_ai";
export type ChatParticipantRole = "curator" | "student" | "teacher" | "parent" | "admin" | "bot";

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type ChatParticipantInfo = {
  user_id: string;
  role_in_thread: ChatParticipantRole;
  full_name: string;
};

export type ChatThreadSummary = {
  id: string;
  kind: ChatThreadKind;
  title: string | null;
  group_id: string | null;
  updated_at: string;
  participants: ChatParticipantInfo[];
  lastMessage: { body: string; created_at: string; sender_id: string | null } | null;
  unreadCount: number;
  // Промт 7.2 (migration 122) — set only for kind === "direct" (student↔teacher
  // personal chat); undefined for "group"/"admin_ai" threads.
  directStudentId?: string | null;
  directTeacherId?: string | null;
  directGroupId?: string | null;
  directGroupName?: string | null;
  directSubjectName?: string | null;
  isCuratorThread?: boolean;
};

/** Все треды, где текущий пользователь — участник (RLS сама это гарантирует), с превью последнего сообщения и числом непрочитанных. */
export async function getMyThreadSummaries(db: Db): Promise<ChatThreadSummary[]> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  const myId: string | null = user?.id ?? null;

  const { data: threads, error: threadsErr } = await sb
    .from("chat_threads")
    .select("id, kind, title, group_id, updated_at, student_id, teacher_id")
    .order("updated_at", { ascending: false });
  if (threadsErr) throw threadsErr;

  const threadIds: string[] = (threads ?? []).map((t: any) => t.id);
  if (threadIds.length === 0) return [];

  const [{ data: participants, error: participantsErr }, { data: messages, error: messagesErr }, { data: readStates, error: readErr }] =
    await Promise.all([
      sb.from("chat_participants").select("thread_id, user_id, role_in_thread").in("thread_id", threadIds),
      sb.from("chat_messages").select("id, thread_id, sender_id, body, created_at").in("thread_id", threadIds).order("created_at", { ascending: true }),
      myId ? sb.from("chat_read_state").select("thread_id, last_read_message_id").eq("user_id", myId) : Promise.resolve({ data: [], error: null }),
    ]);
  if (participantsErr) throw participantsErr;
  if (messagesErr) throw messagesErr;
  if (readErr) throw readErr;

  const userIds = Array.from(new Set((participants ?? []).map((p: any) => p.user_id)));
  const [{ data: teacherRows }, { data: studentRows }, { data: parentRows }] = await Promise.all([
    userIds.length ? sb.from("teachers").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
    userIds.length ? sb.from("students").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
    userIds.length ? sb.from("parents").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const nameByUserId = new Map<string, string>();
  (teacherRows ?? []).forEach((t: any) => nameByUserId.set(t.user_id, t.full_name));
  (studentRows ?? []).forEach((s: any) => nameByUserId.set(s.user_id, s.full_name));
  (parentRows ?? []).forEach((p: any) => nameByUserId.set(p.user_id, p.full_name));

  const participantsByThread = new Map<string, ChatParticipantInfo[]>();
  (participants ?? []).forEach((p: any) => {
    const arr = participantsByThread.get(p.thread_id) ?? [];
    arr.push({ user_id: p.user_id, role_in_thread: p.role_in_thread, full_name: nameByUserId.get(p.user_id) ?? "" });
    participantsByThread.set(p.thread_id, arr);
  });

  const messagesByThread = new Map<string, any[]>();
  (messages ?? []).forEach((m: any) => {
    const arr = messagesByThread.get(m.thread_id) ?? [];
    arr.push(m);
    messagesByThread.set(m.thread_id, arr);
  });

  const readByThread = new Map<string, string | null>();
  (readStates ?? []).forEach((r: any) => readByThread.set(r.thread_id, r.last_read_message_id));

  // ── Промт 7.2: direct-thread (student↔teacher) enrichment — one batch
  // of queries keyed by the distinct student_ids among kind='direct'
  // threads, not one query per thread (same batched-Map idiom as above). ──
  const directStudentIds = Array.from(new Set(
    (threads ?? []).filter((t: any) => t.kind === "direct" && t.student_id).map((t: any) => t.student_id),
  ));
  const groupIdByStudentId = new Map<string, string>();
  const groupById = new Map<string, { name: string; teacher_id: string | null }>();
  const subjectNameByGroupTeacher = new Map<string, string>();
  if (directStudentIds.length) {
    const { data: sgRows } = await sb.from("student_groups").select("student_id, group_id").in("student_id", directStudentIds);
    for (const sg of (sgRows ?? []) as any[]) {
      if (!groupIdByStudentId.has(sg.student_id)) groupIdByStudentId.set(sg.student_id, sg.group_id);
    }
    const groupIds = Array.from(new Set(Array.from(groupIdByStudentId.values())));
    if (groupIds.length) {
      const [{ data: groupRows }, { data: subjectRows }] = await Promise.all([
        sb.from("groups").select("id, name, teacher_id").in("id", groupIds),
        sb.from("subjects").select("group_id, teacher_id, name").in("group_id", groupIds),
      ]);
      for (const g of (groupRows ?? []) as any[]) groupById.set(g.id, { name: g.name, teacher_id: g.teacher_id });
      for (const s of (subjectRows ?? []) as any[]) {
        if (!s.teacher_id) continue;
        const key = `${s.group_id}:${s.teacher_id}`;
        if (!subjectNameByGroupTeacher.has(key)) subjectNameByGroupTeacher.set(key, s.name);
      }
    }
  }

  return (threads ?? []).map((t: any) => {
    const msgs = messagesByThread.get(t.id) ?? [];
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const lastReadId = readByThread.get(t.id) ?? null;

    let unreadCount = 0;
    if (lastReadId) {
      const idx = msgs.findIndex((m: any) => m.id === lastReadId);
      unreadCount = (idx === -1 ? msgs : msgs.slice(idx + 1)).filter((m: any) => m.sender_id !== myId).length;
    } else {
      unreadCount = msgs.filter((m: any) => m.sender_id !== myId).length;
    }

    const summary: ChatThreadSummary = {
      id: t.id,
      kind: t.kind,
      title: t.title,
      group_id: t.group_id,
      updated_at: t.updated_at,
      participants: participantsByThread.get(t.id) ?? [],
      lastMessage: last ? { body: last.body, created_at: last.created_at, sender_id: last.sender_id } : null,
      unreadCount,
    };

    if (t.kind === "direct") {
      const groupId = t.student_id ? groupIdByStudentId.get(t.student_id) ?? null : null;
      const group = groupId ? groupById.get(groupId) ?? null : null;
      summary.directStudentId = t.student_id ?? null;
      summary.directTeacherId = t.teacher_id ?? null;
      summary.directGroupId = groupId;
      summary.directGroupName = group?.name ?? null;
      summary.directSubjectName = groupId && t.teacher_id ? subjectNameByGroupTeacher.get(`${groupId}:${t.teacher_id}`) ?? null : null;
      summary.isCuratorThread = !!(group && t.teacher_id && group.teacher_id === t.teacher_id);
    }

    return summary;
  });
}

/** Число тредов с непрочитанными сообщениями — для красного кружка в сайдбаре. */
export async function getUnreadThreadCount(db: Db): Promise<number> {
  const summaries = await getMyThreadSummaries(db);
  return summaries.filter((s) => s.unreadCount > 0).length;
}

export async function getThreadMessages(db: Db, threadId: string): Promise<ChatMessageRow[]> {
  const sb = db as any;
  const { data, error } = await sb
    .from("chat_messages")
    .select("id, thread_id, sender_id, body, created_at, edited_at, deleted_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendChatMessage(db: Db, threadId: string, body: string): Promise<ChatMessageRow> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await sb
    .from("chat_messages")
    .insert({ thread_id: threadId, sender_id: user.id, body })
    .select("id, thread_id, sender_id, body, created_at, edited_at, deleted_at")
    .single();
  if (error) throw error;
  return data;
}

export async function markThreadRead(db: Db, threadId: string, lastMessageId: string | null): Promise<void> {
  if (!lastMessageId) return;
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const { error } = await sb
    .from("chat_read_state")
    .upsert(
      { thread_id: threadId, user_id: user.id, last_read_message_id: lastMessageId, updated_at: new Date().toISOString() },
      { onConflict: "thread_id,user_id" },
    );
  if (error) throw error;
}
