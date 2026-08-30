/* Announcements + notifications queries (migration 34). New tables aren't in the
 * generated types yet → `(db as any)`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";
import type {
  AnnouncementScope, AnnouncementCategory, Announcement,
  TeacherAnnouncement, TeacherAnnouncementFeedItem, StudentAnnouncement, ParentAnnouncement, AppNotification,
} from "../types";

// ── Teacher / Admin: announcements ──
// Промт 7.1 Часть 2: exactly one of teacherId/adminId must be set (matches
// the announcements_author_check CHECK constraint, migration 121) — teacher
// call sites pass only teacherId (unchanged), the admin call site passes
// only adminId.
export const createAnnouncement = async (
  db: Db,
  input: {
    teacherId?: string | null;
    adminId?: string | null;
    scope: AnnouncementScope;
    groupId?: string | null;
    targetStudentId?: string | null;
    title: string;
    body: string;
    isPinned?: boolean;
    category?: AnnouncementCategory;
    isTicker?: boolean;
    validUntil?: string | null;
  },
): Promise<string> => {
  const { data, error } = await (db as any).from("announcements").insert({
    created_by: input.teacherId ?? null,
    admin_id: input.adminId ?? null,
    scope: input.scope,
    group_id: input.scope === "group" ? input.groupId : null,
    target_student_id: input.scope === "student" ? input.targetStudentId : null,
    title: input.title,
    body: input.body,
    is_pinned: input.isPinned ?? false,
    category: input.category ?? "general",
    is_ticker: input.isTicker ?? false,
    valid_until: input.validUntil ?? null,
  }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
};

export const updateAnnouncement = async (
  db: Db, announcementId: string, data: { title?: string; body?: string; is_pinned?: boolean },
): Promise<void> => {
  const { error } = await (db as any).from("announcements").update(data).eq("id", announcementId);
  if (error) throw error;
};

export const togglePinAnnouncement = async (db: Db, announcementId: string, isPinned: boolean): Promise<void> => {
  const { error } = await (db as any).from("announcements").update({ is_pinned: isPinned }).eq("id", announcementId);
  if (error) throw error;
};

export const deleteAnnouncement = async (db: Db, announcementId: string): Promise<void> => {
  const { error } = await (db as any).from("announcements").delete().eq("id", announcementId);
  if (error) throw error;
};

export const getTeacherAnnouncements = async (db: Db, teacherId: string): Promise<TeacherAnnouncement[]> => {
  // Base select drives visibility (RLS: own). Keep it free of joins so a join
  // problem can never hide the teacher's own announcements.
  const { data, error } = await (db as any).from("announcements")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as any[];

  // ── Enrichment (best-effort; never throws) ──
  const gName = new Map<string, string>();
  const gSize = new Map<string, number>();
  try {
    const { data: groups } = await (db as any).from("groups").select("id, name, student_groups(count)");
    for (const g of (groups ?? [])) { gName.set(g.id, g.name); gSize.set(g.id, g.student_groups?.[0]?.count ?? 0); }
  } catch { /* ignore */ }

  let totalAll = 0;
  try {
    const { data: memb } = await (db as any).from("student_groups")
      .select("student_id, group:groups!inner(teacher_id)").eq("group.teacher_id", teacherId);
    totalAll = new Set((memb ?? []).map((m: any) => m.student_id)).size;
  } catch { /* ignore */ }

  const sName = new Map<string, string>();
  const sids = list.filter((a) => a.target_student_id).map((a) => a.target_student_id);
  if (sids.length) {
    try {
      const { data: studs } = await (db as any).from("students").select("id, full_name").in("id", sids);
      for (const s of (studs ?? [])) sName.set(s.id, s.full_name);
    } catch { /* ignore */ }
  }

  // Промт 7.2 Часть 2: was one awaited announcement_reads count query PER
  // ROW (N+1, ~20s+ hang once 1+ announcements exist) — replaced with a
  // single batched .in() query + a Map, matching the existing
  // per-parent-count idiom already used above for gSize and elsewhere in
  // the codebase (packages/core/src/queries/projects.ts's
  // getStudentProjects).
  const readCountByAnnouncementId = new Map<string, number>();
  const annIds = list.map((a) => a.id);
  if (annIds.length) {
    try {
      const { data: reads } = await (db as any).from("announcement_reads")
        .select("announcement_id").in("announcement_id", annIds);
      for (const r of (reads ?? []) as any[]) {
        readCountByAnnouncementId.set(r.announcement_id, (readCountByAnnouncementId.get(r.announcement_id) ?? 0) + 1);
      }
    } catch { /* ignore */ }
  }

  return list.map((a) => ({
    ...a,
    groupName: a.group_id ? (gName.get(a.group_id) ?? null) : null,
    targetStudentName: a.target_student_id ? (sName.get(a.target_student_id) ?? null) : null,
    readCount: readCountByAnnouncementId.get(a.id) ?? 0,
    totalRecipients: a.scope === "group" ? (gSize.get(a.group_id) ?? 0)
      : a.scope === "student" ? 1 : totalAll,
  })) as TeacherAnnouncement[];
};

// Большой фикс, Блок 4 (учительский дашборд) — отдельно от
// getTeacherAnnouncements (CRUD-вид ТОЛЬКО своих постов, страница "Мои
// объявления"): читает школьные + классные (свои группы) объявления, включая
// чужие/админские, по новой SELECT-политике "teacher reads announcements for
// their groups" (миграция 158) — тот же no-client-filter/RLS-driven паттерн,
// что getParentAnnouncements. РАЗВЕДКА: до 158 у учителя вообще не было
// SELECT-доступа к чужим/админским строкам (только created_by=self) — не
// баг фильтра на клиенте, чинить было нечего без новой RLS-политики.
// 24.08.2026 — ПОЧЕМУ ИМЯ СВЯЗИ ВПИСАНО ЯВНО.
// Блок «Объявления» на дашборде учителя показывал «Пока нет объявлений» при
// одиннадцати доступных объявлениях. Правила доступа были ни при чём: проверено
// запросом от лица каждого демо-учителя — по политике «teacher reads
// announcements for their groups» (миграция 158) каждый видит 11 строк, пятеро
// школьных и шестеро классных.
//
// Ломалось раньше: у `announcements` ДВА внешних ключа на `groups` —
// `group_id` (рабочий) и `target_group_id` (мёртвый остаток, заполнен в нуле
// строк из одиннадцати). Короткая запись `group:groups(name)` не говорит, какой
// из них имеется в виду, и PostgREST отвечает 300 PGRST201 «Could not embed
// because more than one relationship was found». Ошибку глотал safeQuery и
// подставлял пустой список — потому блок и молчал, ни разу не пожаловавшись.
//
// Проверено живым запросом к API: короткая запись → HTTP 300, запись с именем
// ключа → HTTP 200. Другие экраны объявлений это не задевало: ни один из них
// не встраивает группу (getStudentAnnouncements, getParentAnnouncements,
// getTeacherAnnouncements — без такого вложения).
export const getTeacherAnnouncementsFeed = async (db: Db, limit = 10): Promise<TeacherAnnouncementFeedItem[]> => {
  const { data, error } = await (db as any).from("announcements")
    .select("*, teacher:teachers(full_name), admin:admins(full_name), group:groups!announcements_group_id_fkey(name)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    authorName: a.teacher?.full_name ?? a.admin?.full_name ?? null,
    isFromAdmin: a.admin_id != null,
    groupName: a.group?.name ?? null,
    teacher: undefined,
    admin: undefined,
    group: undefined,
  })) as TeacherAnnouncementFeedItem[];
};

// ── Student: announcements ──
export const getStudentAnnouncements = async (db: Db, _studentId: string): Promise<StudentAnnouncement[]> => {
  const { data, error } = await (db as any).from("announcements")
    .select("*, teacher:teachers(full_name), reads:announcement_reads(id)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    teacherName: a.teacher?.full_name ?? null,
    isRead: (a.reads ?? []).length > 0,
  })) as StudentAnnouncement[];
};

// Returns live ticker announcements visible to the current user (RLS filters).
// Sorted by pinned-first, then newest. Excludes expired (valid_until < now).
// onlyFromAdmins=true → further filters to announcements where created_by is in admins.id.
export const getActiveTickerAnnouncements = async (
  db: Db,
  options?: { onlyFromAdmins?: boolean },
): Promise<Announcement[]> => {
  const now = new Date().toISOString();
  const { data, error } = await (db as any).from("announcements")
    .select("*")
    .eq("is_ticker", true)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  let announcements = (data ?? []) as Announcement[];

  if (options?.onlyFromAdmins && announcements.length > 0) {
    const creatorIds = [...new Set(announcements.map((a) => a.created_by).filter(Boolean))];
    const { data: admins } = await (db as any).from("admins").select("id").in("id", creatorIds);
    const adminIds = new Set(((admins ?? []) as any[]).map((a) => a.id));
    announcements = announcements.filter((a) => adminIds.has(a.created_by));
  }

  return announcements;
};

// Returns ticker announcements not yet seen by the current user (using announcement_user_reads).
export const getUnreadTickerAnnouncements = async (
  db: Db, userId: string, options?: { onlyFromAdmins?: boolean },
): Promise<Announcement[]> => {
  const all = await getActiveTickerAnnouncements(db, options);
  if (all.length === 0) return [];
  const ids = all.map((a) => a.id);
  const { data: reads } = await (db as any).from("announcement_user_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .in("announcement_id", ids);
  const readSet = new Set(((reads ?? []) as any[]).map((r) => r.announcement_id));
  return all.filter((a) => !readSet.has(a.id));
};

export const markTickerAnnouncementsRead = async (db: Db, userId: string, announcementIds: string[]): Promise<void> => {
  if (announcementIds.length === 0) return;
  const rows = announcementIds.map((id) => ({ user_id: userId, announcement_id: id }));
  // v2 query builder is a thenable, not a real Promise — it has no .catch()
  // method (calling it threw "TypeError: ... .catch is not a function" and
  // crashed the whole handler, uncaught). Destructure the error instead.
  const { error } = await (db as any).from("announcement_user_reads")
    .upsert(rows, { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
  if (error) console.error("[markTickerAnnouncementsRead] upsert failed:", error.message);
};

export const markAnnouncementRead = async (db: Db, announcementId: string, studentId: string): Promise<void> => {
  const { error } = await (db as any).from("announcement_reads")
    .upsert({ announcement_id: announcementId, student_id: studentId }, { onConflict: "announcement_id,student_id", ignoreDuplicates: true });
  if (error && error.code !== "23505") throw error;
};

// ── Parent: announcements (Промт МОБ-4, migration 126) ──
// RLS on `announcements` denied parents outright before migration 126 (no
// parent-identity path in any policy qual) — parents previously only saw a
// truncated preview via notifications (kind='announcement'). Now that the
// new "parent reads announcements for their children" SELECT policy exists,
// this mirrors getStudentAnnouncements' shape/ordering exactly.
/**
 * Автор объявления для родителя.
 *
 * Учителя достаём вложением (`teachers` родителю читать можно), а имя
 * администратора — вычисляемым полем `admin_name` (миграция 198). Вложение
 * `admin:admins(full_name)` тут не работало и молча отдавало null: на
 * public.admins защита строк пускает только самого администратора, и
 * родитель получал ноль строк. Вместе с именем через таблицу приехал бы и
 * `username` — логин администратора, поэтому политику не расширяли, а
 * завели поле ровно из одного значения.
 *
 * Запасной вариант остаётся: у объявления учителя и у администратора чужой
 * школы `admin_name` придёт NULL, и приложение подставит «Администрация
 * школы» (parentApp.more.newsAuthorFallback).
 */
const PARENT_ANNOUNCEMENT_SELECT = "*, teacher:teachers(full_name), admin_name";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toParentAnnouncement = (a: any): ParentAnnouncement =>
  ({
    ...a,
    authorName: a.teacher?.full_name ?? a.admin_name ?? null,
    isFromAdmin: a.admin_id != null,
    teacher: undefined,
    admin_name: undefined,
  }) as ParentAnnouncement;

export const getParentAnnouncements = async (db: Db, limit = 100): Promise<ParentAnnouncement[]> => {
  const { data, error } = await (db as any).from("announcements")
    .select(PARENT_ANNOUNCEMENT_SELECT)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map(toParentAnnouncement);
};

export const getParentAnnouncementById = async (db: Db, id: string): Promise<ParentAnnouncement | null> => {
  const { data, error } = await (db as any).from("announcements")
    .select(PARENT_ANNOUNCEMENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toParentAnnouncement(data);
};

// ── Настройки уведомлений (миграция 236) ────────────────────────────────

/**
 * Категории экрана настроек.
 *
 * 30.08.2026 — ИХ ТРИ, А НЕ ЧЕТЫРЕ. Миграция 240 сняла рассылку про
 * сообщения в чате вместе с ещё девятью источниками, и категория
 * «сообщения» осталась тумблером, которому нечего выключать. Тумблер,
 * который ничего не делает, хуже отсутствующего: человек им пользуется и
 * считает, что настроил.
 *
 * В CHECK таблицы значений по-прежнему четыре — сузить его можно только
 * после уборки старых строк, отдельным файлом (см. хвост миграции 240).
 * Лишнее значение в базе безвредно: сюда оно не попадёт, потому что
 * getNotificationPrefs сверяется с этим списком.
 */
export const NOTIFICATION_CATEGORIES = ["grades", "homework", "announcements"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
/** Категория включена, если её не выключили. Ключи — все четыре всегда. */
export type NotificationPrefs = Record<NotificationCategory, boolean>;

/**
 * ВИД УВЕДОМЛЕНИЯ → КАТЕГОРИЯ ЭКРАНА.
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В БАЗЕ. Фильтр по решению заказчика стоит при ЧТЕНИИ,
 * а чтение — это вот эти две функции на TypeScript. Таблица соответствия в
 * базе стоила бы лишнего запроса (или соединения) на каждую загрузку ленты
 * И на каждый опрос колокольчика, а выиграть было бы нечего: ни один
 * триггер её не спросит — они пишут всё подряд, в том и смысл решения.
 * Плюс подписи категорий уже живут в общем словаре, тоже на TypeScript:
 * правило и подпись меняются одним выпуском, а не двумя.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Виды, не попавшие ни в одну категорию
 * (lesson_material, lesson_created, student_excused, leave_request,
 * leave_decision, lesson_starting_soon), ПОКАЗЫВАЮТСЯ ВСЕГДА.
 *
 * Прятать их по умолчанию нельзя по двум причинам. Первая: у них нет
 * тумблера, значит выключатель был бы без включателя — человек не смог бы
 * вернуть скрытое. Вторая, тяжелее: вид, заведённый будущей миграцией и
 * забытый в этой таблице, ИСЧЕЗ БЫ МОЛЧА. Лишняя строка в ленте — мелкая
 * беда, пропавшее уведомление — крупная и незаметная.
 *
 * Мёртвый lesson_created (121 строка) тоже показывается — и правильно: он
 * должен уйти удалением строк (блок в хвосте миграции 236), а не спрятаться
 * за фильтром. Спрятать значило бы замести беду под ковёр.
 */
const CATEGORY_BY_KIND: Readonly<Record<string, NotificationCategory>> = {
  // Оценки: всё, что несёт отметку.
  grade_received: "grades",
  new_grade: "grades",
  homework_graded: "grades",
  // Домашние задания: выдали и сдали.
  new_homework: "homework",
  student_submitted: "homework",
  // Объявления школы: оба вида — ученикам и учителям.
  announcement: "announcements",
  announcement_new: "announcements",
  // chat_message здесь БЫЛ и убран 30.08.2026 вместе с категорией
  // «сообщения»: миграция 240 сняла триггер, источника больше нет.
};

/** Школа текущего человека. Нужна только на ЗАПИСЬ настройки: правило
 *  доступа требует school_id = current_school_id(), а колонка умолчания не
 *  имеет. Спрашиваем по очереди четыре таблицы — свою строку в своей видит
 *  каждая роль. На чтении этот запрос не выполняется ни разу. */
async function resolveMySchoolId(db: Db): Promise<string | null> {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const источники = ["students", "teachers", "parents", "admins"];
  const ответы = await Promise.all(источники.map((t) =>
    sb.from(t).select("school_id").eq("user_id", user.id).maybeSingle()));
  for (const r of ответы) {
    const id = (r?.data as { school_id?: string } | null)?.school_id;
    if (id) return id;
  }
  return null;
}

/**
 * Настройки текущего человека. Все четыре ключа всегда на месте: отсутствие
 * строки в таблице означает «включено», и разворачивать это в объект должен
 * один код, а не каждый экран по-своему.
 */
export const getNotificationPrefs = async (db: Db): Promise<NotificationPrefs> => {
  const итог = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])) as NotificationPrefs;
  const { data, error } = await (db as any).from("notification_prefs").select("category, enabled");
  // Не роняем ленту из-за настроек: не прочитались — считаем всё включённым.
  // Это безопасная сторона отказа: человек увидит лишнее, а не потеряет своё.
  if (error) {
    console.error("[getNotificationPrefs] чтение настроек не удалось:", error.message);
    return итог;
  }
  for (const r of (data ?? []) as Array<{ category: string; enabled: boolean }>) {
    if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(r.category)) {
      итог[r.category as NotificationCategory] = r.enabled;
    }
  }
  return итог;
};

/**
 * Включить или выключить категорию.
 *
 * ВКЛЮЧЕНИЕ УДАЛЯЕТ СТРОКУ, а не пишет enabled = true. Отсутствие строки и
 * есть «включено» — держать оба представления одного состояния значит рано
 * или поздно получить их расхождение.
 */
export const setNotificationPref = async (
  db: Db,
  category: NotificationCategory,
  enabled: boolean,
): Promise<void> => {
  const sb = db as any;
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (enabled) {
    const { error } = await sb.from("notification_prefs").delete()
      .eq("user_id", user.id).eq("category", category);
    if (error) throw error;
    return;
  }

  const schoolId = await resolveMySchoolId(db);
  if (!schoolId) throw new Error("NOTIF_PREF_NO_SCHOOL");
  const { error } = await sb.from("notification_prefs").upsert(
    { user_id: user.id, school_id: schoolId, category, enabled: false, updated_at: new Date().toISOString() },
    { onConflict: "user_id,category" },
  );
  if (error) throw error;
};

/**
 * СПИСОК СКРЫТЫХ ВИДОВ — ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ЖИВЁТ ПРАВИЛО ПОКАЗА.
 *
 * Обе читающие функции ниже зовут ЕЁ, и ни одна не решает сама. Это не
 * вкусовщина: счётчик колокольчика и лента расходились бы ровно так же, как
 * семь раз расходились копии среднего балла. Одна копия — расходиться
 * нечему.
 */
async function hiddenKinds(db: Db): Promise<string[]> {
  const prefs = await getNotificationPrefs(db);
  const выключены = new Set(NOTIFICATION_CATEGORIES.filter((c) => !prefs[c]));
  if (выключены.size === 0) return [];
  return Object.entries(CATEGORY_BY_KIND)
    .filter(([, category]) => выключены.has(category))
    .map(([kind]) => kind);
}

// ── Notifications (any role; RLS limits to own) ──

/**
 * Лента уведомлений. Скрытые категории отсекаются В ЗАПРОСЕ, а не после
 * него: limit должен применяться к тому, что человек увидит. Отфильтруй мы
 * после выборки — при выключенной категории страница возвращала бы меньше
 * строк, чем просили, и «показать ещё» вело бы себя непредсказуемо.
 */
export const getMyNotifications = async (db: Db, limit = 50): Promise<AppNotification[]> => {
  const скрытые = await hiddenKinds(db);
  let q = (db as any).from("notifications")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (скрытые.length) q = q.not("kind", "in", `(${скрытые.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AppNotification[];
};

/** Непрочитанные — тем же отбором, что и лента. Иначе колокольчик считал бы
 *  скрытое: красный кружок, ведущий в никуда. */
export const getUnreadCount = async (db: Db): Promise<number> => {
  const скрытые = await hiddenKinds(db);
  let q = (db as any).from("notifications")
    .select("id", { count: "exact", head: true }).eq("is_read", false);
  if (скрытые.length) q = q.not("kind", "in", `(${скрытые.join(",")})`);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
};

export const markNotificationRead = async (db: Db, id: string): Promise<void> => {
  const { error } = await (db as any).from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (db: Db): Promise<void> => {
  const { error } = await (db as any).from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
  if (error) throw error;
};

export const deleteNotification = async (db: Db, id: string): Promise<void> => {
  const { error } = await (db as any).from("notifications").delete().eq("id", id);
  if (error) throw error;
};
