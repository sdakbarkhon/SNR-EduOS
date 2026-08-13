"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_SB3_BYTES, SCRATCH_PROJECT_LIMIT } from "@/lib/scratch-bridge";
import { schoolStoragePath } from "@snr/core";

/**
 * Работы Scratch: сохранение, список, открытие, удаление. Z-Scratch, 10.08.2026.
 *
 * ХРАНЕНИЕ. Строка — в sandbox_projects (миграция 182, та же таблица, что у
 * работ песочницы CodeSandbox: это один и тот же список «мои работы»), файл —
 * в приватном бакете scratch-projects. В колонке code лежать не может: .sb3
 * двоичный и весит мегабайты.
 *
 * ПРАВА. Запись и чтение идут служебным клиентом, поэтому владение
 * проверяется здесь явно, на каждом действии: RLS под service-role не
 * применяется вовсе. Ученик работает только со своими работами.
 *
 * УЧИТЕЛЬ (добавлено 13.08.2026). Две функции внизу файла отдают ему работы
 * его классов. Они устроены иначе, чем ученические, и намеренно: список
 * фильтрует САМА БАЗА политикой «teacher reads class work by assignment»
 * (миграция 182), а не повторная проверка в коде. Поэтому чтение идёт
 * пользовательским клиентом, под которым RLS работает; служебный нужен
 * только чтобы подписать ссылку на файл — у бакета своих политик нет по
 * решению той же миграции. Второй копии правил доступа в коде нет: одно
 * правило, и оно в базе.
 */

const BUCKET = "scratch-projects";
const SERVICE_ID = "scratch";

export type ScratchProject = {
  id: string;
  name: string;
  origin: "sandbox" | "lesson" | "homework";
  sharedWithClass: boolean;
  updatedAt: string;
  /** Размер файла в байтах. Именно байты, а не готовая подпись: единицы
   *  измерения — видимый пользователю текст, а он обязан быть на трёх
   *  языках, поэтому подпись собирается на экране из словаря. */
  sizeBytes: number | null;
};

/** Текущий ученик. null — вошёл не ученик (учитель, админ, родитель). */
async function currentStudent(): Promise<{ id: string; schoolId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("students").select("id, school_id").eq("user_id", user.id).maybeSingle();
  return data ? { id: data.id as string, schoolId: data.school_id as string } : null;
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_student" | "too_big" | "limit" | "failed" };

/**
 * Сохраняет работу. `projectId` пуст — новая, иначе перезапись своей.
 *
 * Файл кладётся по пути «ученик/работа.sb3»: имя в пути не участвует, его
 * можно переименовать, не трогая хранилище, и оно не утечёт в адрес.
 */
export async function saveScratchProject(fd: FormData): Promise<SaveResult> {
  const student = await currentStudent();
  if (!student) return { ok: false, error: "not_student" };

  const file = fd.get("sb3");
  if (!(file instanceof File)) return { ok: false, error: "failed" };
  if (file.size > MAX_SB3_BYTES) return { ok: false, error: "too_big" };

  const name = String(fd.get("name") ?? "").trim().slice(0, 120) || "Без названия";
  const rawOrigin = String(fd.get("origin") ?? "sandbox");
  const origin = (["sandbox", "lesson", "homework"] as const).includes(rawOrigin as never)
    ? (rawOrigin as ScratchProject["origin"]) : "sandbox";
  const lessonStageId = String(fd.get("lessonStageId") ?? "").trim() || null;
  const homeworkId = String(fd.get("homeworkId") ?? "").trim() || null;
  const share = String(fd.get("share") ?? "") === "1";
  const projectId = String(fd.get("projectId") ?? "").trim() || null;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  // Перезапись — только своей работы. Без этой проверки чужой id в форме
  // позволил бы затереть чужой проект: служебный клиент RLS не спрашивает.
  let rowId = projectId;
  if (rowId) {
    const { data: own } = await anyAdmin
      .from("sandbox_projects").select("id").eq("id", rowId).eq("student_id", student.id).maybeSingle();
    if (!own) return { ok: false, error: "failed" };
  } else {
    const { count } = await anyAdmin
      .from("sandbox_projects").select("id", { count: "exact", head: true })
      .eq("student_id", student.id).eq("service_id", SERVICE_ID).eq("is_autosave", false);
    if ((count ?? 0) >= SCRATCH_PROJECT_LIMIT) return { ok: false, error: "limit" };

    const { data: created, error: insErr } = await anyAdmin
      .from("sandbox_projects")
      .insert({
        student_id: student.id, school_id: student.schoolId, name,
        service_id: SERVICE_ID, origin, lesson_stage_id: lessonStageId,
        homework_id: homeworkId, shared_with_class: share, is_autosave: false,
      })
      .select("id").single();
    if (insErr || !created) return { ok: false, error: "failed" };
    rowId = created.id as string;
  }

  const path = schoolStoragePath(student.schoolId, student.id, `${rowId}.sb3`);
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: "application/x.scratch.sb3", upsert: true });
  if (upErr) return { ok: false, error: "failed" };

  const { error: updErr } = await anyAdmin
    .from("sandbox_projects")
    .update({
      name, file_path: path, origin, lesson_stage_id: lessonStageId,
      homework_id: homeworkId, shared_with_class: share,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId).eq("student_id", student.id);
  if (updErr) return { ok: false, error: "failed" };

  revalidatePath("/projects");
  return { ok: true, id: rowId! };
}

/** Свои работы Scratch, свежие сверху. */
export async function listScratchProjects(): Promise<ScratchProject[]> {
  const student = await currentStudent();
  if (!student) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  const { data } = await anyAdmin
    .from("sandbox_projects")
    .select("id, name, origin, shared_with_class, updated_at, file_path")
    .eq("student_id", student.id).eq("service_id", SERVICE_ID).eq("is_autosave", false)
    .not("file_path", "is", null)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string; name: string; origin: ScratchProject["origin"];
    shared_with_class: boolean; updated_at: string; file_path: string;
  }>;
  if (rows.length === 0) return [];

  // Размер файла берём из хранилища одним листингом папки ученика, а не
  // запросом на каждую работу.
  const { data: listed } = await admin.storage.from(BUCKET).list(student.id, { limit: 200 });
  const sizeByName = new Map<string, number>(
    ((listed ?? []) as Array<{ name: string; metadata?: { size?: number } }>)
      .map((o) => [o.name, o.metadata?.size ?? 0]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    origin: r.origin,
    sharedWithClass: r.shared_with_class,
    updatedAt: r.updated_at,
    sizeBytes: sizeByName.get(`${r.id}.sb3`) ?? null,
  }));
}

/** Подписанная ссылка на файл своей работы. Бакет приватный, прямых адресов
 *  наружу нет — ссылка живёт минуту, ровно чтобы редактор её скачал. */
export async function getScratchProjectUrl(id: string): Promise<string | null> {
  const student = await currentStudent();
  if (!student) return null;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (admin as any)
    .from("sandbox_projects").select("file_path")
    .eq("id", id).eq("student_id", student.id).maybeSingle();
  if (!row?.file_path) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(row.file_path as string, 60);
  return data?.signedUrl ?? null;
}

// ── УЧИТЕЛЬ ────────────────────────────────────────────────────────────────

/** Работа ученика в списке учителя. */
export type ClassScratchWork = {
  id: string;
  name: string;
  studentName: string;
  groupName: string | null;
  /** lesson | homework. Работ из песочницы здесь не бывает — их отсекает
   *  политика в базе, а не этот код. */
  origin: "lesson" | "homework";
  /** Тема урока или название задания, откуда работа. */
  sourceTitle: string | null;
  sharedWithClass: boolean;
  updatedAt: string;
};

/**
 * Работы Scratch классов учителя, свежие сверху.
 *
 * Фильтрации по группам и по origin здесь НЕТ и быть не должно: и то и другое
 * делает политика «teacher reads class work by assignment». Клиент
 * пользовательский — под ним политика и срабатывает. Если войдёт не учитель,
 * его собственные политики просто ничего не вернут.
 */
export async function listClassScratchProjects(): Promise<ClassScratchWork[]> {
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("sandbox_projects")
    .select(
      "id, name, origin, shared_with_class, updated_at, student_id, " +
      "student:students(full_name), " +
      "stage:lesson_stages(title, lesson:lessons(topic, title, group:groups(name))), " +
      "hw:homework(title, group:groups(name))",
    )
    .eq("service_id", SERVICE_ID)
    .eq("is_autosave", false)
    .not("file_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[scratch] listClassScratchProjects failed:", error.message);
    return [];
  }

  type Row = {
    id: string; name: string; origin: "lesson" | "homework";
    shared_with_class: boolean; updated_at: string;
    student: { full_name: string } | null;
    stage: { title: string | null; lesson: { topic: string | null; title: string | null; group: { name: string } | null } | null } | null;
    hw: { title: string | null; group: { name: string } | null } | null;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    studentName: r.student?.full_name ?? "—",
    groupName: r.stage?.lesson?.group?.name ?? r.hw?.group?.name ?? null,
    origin: r.origin,
    sourceTitle:
      r.origin === "homework"
        ? r.hw?.title ?? null
        : r.stage?.lesson?.topic ?? r.stage?.lesson?.title ?? r.stage?.title ?? null,
    sharedWithClass: r.shared_with_class,
    updatedAt: r.updated_at,
  }));
}

/**
 * Подписанная ссылка на работу ученика — для просмотра учителем.
 *
 * Право на работу проверяет та же политика: сначала строку читаем
 * пользовательским клиентом, и если политика её не отдала, дальше не идём.
 * Служебный клиент подключается только на подписи файла.
 *
 * Перезаписать открытую работу учитель не может: сохранение идёт через
 * saveScratchProject, а та первым делом требует профиль ученика
 * (currentStudent) и учителю отвечает not_student. Экран учителя к тому же
 * не подписан на сообщения save/share — то есть отказ стоит дважды.
 */
export async function getClassScratchProjectUrl(id: string): Promise<string | null> {
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (sb as any)
    .from("sandbox_projects").select("file_path").eq("id", id).maybeSingle();
  if (!row?.file_path) return null;

  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(row.file_path as string, 60);
  return data?.signedUrl ?? null;
}

export async function deleteScratchProject(id: string): Promise<{ ok: boolean }> {
  const student = await currentStudent();
  if (!student) return { ok: false };
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;
  const { data: row } = await anyAdmin
    .from("sandbox_projects").select("file_path")
    .eq("id", id).eq("student_id", student.id).maybeSingle();
  if (!row) return { ok: false };

  if (row.file_path) await admin.storage.from(BUCKET).remove([row.file_path as string]);
  const { error } = await anyAdmin
    .from("sandbox_projects").delete().eq("id", id).eq("student_id", student.id);
  if (error) return { ok: false };

  revalidatePath("/projects");
  return { ok: true };
}
