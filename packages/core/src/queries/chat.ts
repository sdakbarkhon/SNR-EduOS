/* Chat queries (migration 78). Tables aren't in the generated types yet, so
 * we use `(db as any)` like the other migration-30+ modules (see projects.ts). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";

/**
 * Виды переписки. "support" — комната родитель↔школа, миграция 234:
 * одна на родителя, внутри он сам и все админы его школы.
 */
export type ChatThreadKind = "group" | "direct" | "admin_ai" | "support";
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
  // 30.08.2026 — признака isCuratorThread здесь больше нет. Он отличал чат
  // с куратором класса от чата с предметником: group.teacher_id ===
  // thread.teacher_id. Роль убрана из продукта, groups.teacher_id пуст у
  // всех групп — признак был бы вечно ложным.
  /**
   * Заполняются только для kind === "support" — той же формы, что direct*
   * выше.
   *
   * ЗАЧЕМ ИМЯ РОДИТЕЛЯ ОТДЕЛЬНЫМ ПОЛЕМ. Заголовок комнаты в базе — имя
   * родителя, и в общем списке он читается по-разному с двух сторон: админу
   * нужно «кто написал», а родителю такой заголовок показывал бы его
   * собственное имя — то есть переписку с самим собой. Подпись выбирает
   * экран, слой отдаёт материал: вид комнаты и чьё это обращение.
   */
  supportParentId?: string | null;
  supportParentName?: string | null;
};

/**
 * Имена участников по их user_id. ЧЕТЫРЕ источника, и все четыре нужны:
 *
 *   teachers, students          — читаются напрямую;
 *   chat_parent_names (мигр.204) — представление, а не public.parents: в
 *     строке родителя лежат телефон и почты для входа, чату нужно только имя;
 *   chat_admin_names  (мигр.235) — то же самое для администратора.
 *
 * ПОЧЕМУ ЧЕТВЁРТЫЙ ИСТОЧНИК ПОЯВИЛСЯ. У public.admins ровно одно правило
 * чтения — «админ читает свою запись». Родитель не видит оттуда ни строки,
 * включая админа собственной школы. Без представления имя отвечающего в
 * комнате поддержки приходило бы пустым, а решение заказчика — показывать
 * имя у каждого сообщения: у боевой школы админов трое.
 *
 * Вынесено в отдельную функцию, потому что источников теперь четыре и их
 * читают два запроса. Вторая копия рано или поздно забыла бы один из них.
 */
async function resolveParticipantNames(sb: any, userIds: string[]): Promise<Map<string, string>> {
  const nameByUserId = new Map<string, string>();
  if (!userIds.length) return nameByUserId;
  const [{ data: teacherRows }, { data: studentRows }, { data: parentRows }, { data: adminRows }] =
    await Promise.all([
      sb.from("teachers").select("user_id, full_name").in("user_id", userIds),
      sb.from("students").select("user_id, full_name").in("user_id", userIds),
      sb.from("chat_parent_names").select("user_id, full_name").in("user_id", userIds),
      sb.from("chat_admin_names").select("user_id, full_name").in("user_id", userIds),
    ]);
  (teacherRows ?? []).forEach((t: any) => nameByUserId.set(t.user_id, t.full_name));
  (studentRows ?? []).forEach((s: any) => nameByUserId.set(s.user_id, s.full_name));
  (parentRows ?? []).forEach((p: any) => nameByUserId.set(p.user_id, p.full_name));
  (adminRows ?? []).forEach((a: any) => nameByUserId.set(a.user_id, a.full_name));
  return nameByUserId;
}

/** Все треды, где текущий пользователь — участник (RLS сама это гарантирует), с превью последнего сообщения и числом непрочитанных. */
export async function getMyThreadSummaries(db: Db): Promise<ChatThreadSummary[]> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  const myId: string | null = user?.id ?? null;

  const { data: threads, error: threadsErr } = await sb
    .from("chat_threads")
    .select("id, kind, title, group_id, updated_at, student_id, teacher_id, parent_id")
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

  // Тип указан явно: participants приходит из `any`-клиента, и Set над `any`
  // сворачивается в unknown[] — раньше это никого не задевало, потому что
  // список уходил прямо в `.in()` того же `any`.
  const userIds: string[] = Array.from(new Set((participants ?? []).map((p: any) => String(p.user_id))));
  const nameByUserId = await resolveParticipantNames(sb, userIds);

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
    const { data: sgRows, error: sgErr } = await sb.from("student_groups").select("student_id, group_id").in("student_id", directStudentIds);
    if (sgErr) console.error("[getMyThreadSummaries] student_groups enrichment failed:", sgErr.message);
    for (const sg of (sgRows ?? []) as any[]) {
      if (!groupIdByStudentId.has(sg.student_id)) groupIdByStudentId.set(sg.student_id, sg.group_id);
    }
    const groupIds = Array.from(new Set(Array.from(groupIdByStudentId.values())));
    if (groupIds.length) {
      const [{ data: groupRows, error: groupErr }, { data: subjectRows, error: subjectErr }] = await Promise.all([
        sb.from("groups").select("id, name, teacher_id").in("id", groupIds),
        sb.from("subjects").select("group_id, teacher_id, name").in("group_id", groupIds),
      ]);
      if (groupErr) console.error("[getMyThreadSummaries] groups enrichment failed:", groupErr.message);
      if (subjectErr) console.error("[getMyThreadSummaries] subjects enrichment failed:", subjectErr.message);
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
    }

    if (t.kind === "support") {
      summary.supportParentId = t.parent_id ?? null;
      // Имя берём у участника с ролью parent, а не из заголовка: заголовок
      // проставляется один раз при создании комнаты и после переименования
      // родителя устареет. Заголовок остаётся запасным вариантом на случай,
      // когда имя не разрешилось.
      const parentPart = (participantsByThread.get(t.id) ?? []).find((p) => p.role_in_thread === "parent");
      summary.supportParentName = parentPart?.full_name || t.title || null;
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

/** Идентификатор реального сообщения. Оптимистичные («optimistic-xxxx»)
 *  живут только в памяти экрана и в базу попадать не должны. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Отметить тред прочитанным по последнему сообщению.
 *
 * 10.08.2026 — ПОЧЕМУ ЗДЕСЬ ПРОВЕРКА ФОРМАТА. Экран чата показывает своё
 * только что отправленное сообщение сразу, не дожидаясь сервера, и даёт ему
 * временный идентификатор `optimistic-<случайное>` (MessagesView). Отметка
 * прочтения срабатывала на появление этого сообщения и отправляла временный
 * идентификатор в колонку `last_read_message_id uuid` — Postgres отвечал
 * 22P02 «invalid input syntax for type uuid», а PostgREST превращал это в
 * 400 на `chat_read_state?on_conflict=thread_id,user_id`. Ограничение и
 * схема тут ни при чём: первичный ключ (thread_id, user_id) на месте, и тот
 * же ON CONFLICT в чистом SQL отрабатывает — проверено прогоном с откатом.
 *
 * Вызывающий экран тоже научен не брать оптимистичное сообщение, но проверка
 * стоит и здесь: функцию зовут из трёх мест, включая родительский чат.
 */
export async function markThreadRead(db: Db, threadId: string, lastMessageId: string | null): Promise<void> {
  if (!lastMessageId || !UUID_RE.test(lastMessageId)) return;
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

// ── КОМНАТА ПОДДЕРЖКИ РОДИТЕЛЬ↔ШКОЛА (миграции 234 и 235) ──────────────────

export type SupportThread = {
  id: string;
  /** Заголовок в базе — имя родителя. Подпись на экране выбирает экран:
   *  родителю «Поддержка школы», админу — это имя. */
  title: string | null;
  schoolId: string;
  parentId: string;
  updatedAt: string;
  /** Родитель и все админы школы. Ролью различаются: `parent` и `admin`.
   *  «Родитель в комнате один» — это отсутствие участников с ролью `admin`;
   *  считать отдельным полем не стали, чтобы у признака не завелось двух
   *  расходящихся определений. */
  participants: ChatParticipantInfo[];
};

/**
 * Комната поддержки текущего родителя: создать, если её нет, и вернуть.
 *
 * ПОЧЕМУ ВЫЗОВ ФУНКЦИИ БАЗЫ, А НЕ ВСТАВКА ОТСЮДА. Родитель не может завести
 * комнату сам: в правиле INSERT на chat_threads родительской ветки нет вовсе
 * (есть суперадмин, админ школы и учитель), в правиле на chat_participants —
 * тоже. Комнату собирает fn_ensure_support_thread (SECURITY DEFINER, миграция
 * 234) — так же, как личные чаты собирает fn_ensure_direct_chat.
 *
 * Аргументов у функции нет намеренно: родителя и школу она берёт из
 * auth.uid(), поэтому чужую комнату получить нельзя. Позвал не родитель —
 * вернётся null, и это не ошибка.
 *
 * Повторный вызов безопасен и полезен: он ничего не создаёт заново, но
 * добирает в участники админов, заведённых после создания комнаты.
 */
export async function ensureSupportThread(db: Db): Promise<string | null> {
  const sb = db as any;
  const { data, error } = await sb.rpc("fn_ensure_support_thread");
  if (error) throw error;
  return (data as string | null) ?? null;
}

/**
 * Комната поддержки текущего родителя с участниками. null — если её ещё нет
 * или зовёт не родитель.
 *
 * ПОЧЕМУ ОТБОР ПО parent_id, А НЕ ПРОСТО ПО kind. Админ школы читает ВСЕ
 * комнаты своей школы (миграция 142, правило по kind не фильтрует). Запрос
 * «одна комната вида support» вернул бы ему произвольную чужую, и чем больше
 * родителей, тем чаще. Поэтому комната ищется по конкретному родителю, а кто
 * не родитель — получает null, а не чью-то переписку. Список комнат для
 * админского раздела «Поддержка» — отдельный запрос, он в заходе D.
 */
export async function getSupportThread(db: Db): Promise<SupportThread | null> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: parent, error: parentErr } = await sb
    .from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (parentErr) throw parentErr;
  if (!parent) return null;

  const { data: thread, error: threadErr } = await sb
    .from("chat_threads")
    .select("id, title, school_id, parent_id, updated_at")
    .eq("kind", "support")
    .eq("parent_id", parent.id)
    .maybeSingle();
  if (threadErr) throw threadErr;
  if (!thread) return null;

  const { data: participants, error: partErr } = await sb
    .from("chat_participants")
    .select("user_id, role_in_thread")
    .eq("thread_id", thread.id);
  if (partErr) throw partErr;

  const rows = (participants ?? []) as Array<{ user_id: string; role_in_thread: ChatParticipantRole }>;
  const nameByUserId = await resolveParticipantNames(sb, rows.map((p) => p.user_id));

  return {
    id: thread.id,
    title: thread.title ?? null,
    schoolId: thread.school_id,
    parentId: thread.parent_id,
    updatedAt: thread.updated_at,
    participants: rows.map((p) => ({
      user_id: p.user_id,
      role_in_thread: p.role_in_thread,
      full_name: nameByUserId.get(p.user_id) ?? "",
    })),
  };
}

/** Одно обращение в списке админского раздела «Поддержка». */
export type SupportThreadSummary = {
  id: string;
  parentId: string | null;
  /** Кто написал. Заголовок комнаты в базе — имя родителя, но берём его у
   *  участника с ролью parent: заголовок проставляется один раз и после
   *  переименования устареет. */
  parentName: string;
  updatedAt: string;
  lastMessage: { body: string; created_at: string; senderId: string | null; senderName: string } | null;
  unreadCount: number;
  /** Все участники комнаты, включая других админов, — чтобы было видно, кто
   *  ещё отвечает. Ответственного за обращение не заводим: решение заказчика. */
  participants: ChatParticipantInfo[];
};

/**
 * Обращения в поддержку для админского раздела.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ЗАПРОС, А НЕ ФИЛЬТР ПО getMyThreadSummaries. Тот читает
 * ВСЕ треды, которые видит вошедший, и ВСЕ их сообщения разом. Админ школы
 * видит все чаты школы (миграция 142) — в демо-школе это 195 комнат и 555
 * сообщений, и раздел поддержки тянул бы их целиком ради двух строк.
 * Здесь берутся только комнаты вида support и только их сообщения.
 *
 * Школу не проверяем руками: правило доступа уже сужает до своей
 * (school_id = current_school_id() AND fn_is_admin()). Родителю этот запрос
 * тоже отдаст ровно его собственную комнату — но у родителя свой путь,
 * getSupportThread, и он честнее по имени.
 */
export async function getSupportThreadsForAdmin(db: Db): Promise<SupportThreadSummary[]> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  const myId: string | null = user?.id ?? null;

  const { data: threads, error: threadsErr } = await sb
    .from("chat_threads")
    .select("id, title, parent_id, updated_at")
    .eq("kind", "support")
    .order("updated_at", { ascending: false });
  if (threadsErr) throw threadsErr;

  const rows = (threads ?? []) as Array<{ id: string; title: string | null; parent_id: string | null; updated_at: string }>;
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);

  const [{ data: participants, error: pErr }, { data: messages, error: mErr }, { data: readStates, error: rErr }] =
    await Promise.all([
      sb.from("chat_participants").select("thread_id, user_id, role_in_thread").in("thread_id", ids),
      sb.from("chat_messages").select("id, thread_id, sender_id, body, created_at").in("thread_id", ids).order("created_at", { ascending: true }),
      myId
        ? sb.from("chat_read_state").select("thread_id, last_read_message_id").eq("user_id", myId).in("thread_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (pErr) throw pErr;
  if (mErr) throw mErr;
  if (rErr) throw rErr;

  const partRows = (participants ?? []) as Array<{ thread_id: string; user_id: string; role_in_thread: ChatParticipantRole }>;
  const nameByUserId = await resolveParticipantNames(sb, Array.from(new Set(partRows.map((p) => p.user_id))));

  const byThread = new Map<string, ChatParticipantInfo[]>();
  for (const p of partRows) {
    const arr = byThread.get(p.thread_id) ?? [];
    arr.push({ user_id: p.user_id, role_in_thread: p.role_in_thread, full_name: nameByUserId.get(p.user_id) ?? "" });
    byThread.set(p.thread_id, arr);
  }

  const msgsByThread = new Map<string, Array<{ id: string; sender_id: string | null; body: string; created_at: string }>>();
  for (const m of (messages ?? []) as any[]) {
    const arr = msgsByThread.get(m.thread_id) ?? [];
    arr.push(m);
    msgsByThread.set(m.thread_id, arr);
  }
  const readByThread = new Map<string, string | null>();
  for (const r of (readStates ?? []) as any[]) readByThread.set(r.thread_id, r.last_read_message_id);

  return rows.map((t) => {
    const msgs = msgsByThread.get(t.id) ?? [];
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    const lastReadId = readByThread.get(t.id) ?? null;
    const idx = lastReadId ? msgs.findIndex((m) => m.id === lastReadId) : -1;
    const хвост = lastReadId && idx >= 0 ? msgs.slice(idx + 1) : msgs;
    const parts = byThread.get(t.id) ?? [];
    const parentPart = parts.find((p) => p.role_in_thread === "parent");
    return {
      id: t.id,
      parentId: t.parent_id ?? null,
      parentName: parentPart?.full_name || t.title || "",
      updatedAt: t.updated_at,
      lastMessage: last
        ? {
            body: last.body,
            created_at: last.created_at,
            senderId: last.sender_id,
            senderName: last.sender_id ? nameByUserId.get(last.sender_id) ?? "" : "",
          }
        : null,
      unreadCount: хвост.filter((m) => m.sender_id !== myId).length,
      participants: parts,
    };
  });
}
