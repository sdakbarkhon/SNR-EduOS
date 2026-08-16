"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolStoragePath } from "@snr/core";

/**
 * Работы Polotno: сохранение, список, открытие, удаление. Проба, 16.08.2026.
 *
 * ХРАНЕНИЕ — БЕЗ СВОЕЙ СХЕМЫ. Строка в той же public.sandbox_projects, что у
 * Scratch и CodeSandbox (service_id = 'polotno', добавлен миграцией 200), файлы
 * в том же приватном бакете scratch-projects. Своей таблицы и своего бакета у
 * пробной карточки нет намеренно: если проба не понравится, удаляется карточка
 * и строки — больше ничего.
 *
 * ДВА ФАЙЛА НА РАБОТУ:
 *   {id}.json — сам проект (store.toJSON), им работа открывается обратно;
 *   {id}.png  — картинка (store.toDataURL), ею работа показывается и её же
 *               ученик уносит к себе.
 * Оба лежат рядом по тому же пути «школа/ученик/…», что и .sb3 у Scratch.
 *
 * ПРАВА. Как у Scratch: запись и чтение идут служебным клиентом, поэтому
 * владение проверяется здесь явно на каждом действии — под service-role RLS не
 * применяется вовсе.
 */

const BUCKET = "scratch-projects";
const SERVICE_ID = "polotno";

/**
 * Тот же потолок, что у Scratch: 20 именованных работ на ученика.
 *
 * Не экспортируется намеренно: файл помечен "use server", а из такого файла
 * наружу можно отдавать ТОЛЬКО асинхронные функции — обычная константа роняет
 * сборку («Only async functions are allowed to be exported»). Число, которое
 * видит ученик, живёт в словаре.
 */
const POLOTNO_PROJECT_LIMIT = 20;
/** Проект — это JSON со сценой; 8 МБ хватает с запасом даже с картинками. */
const MAX_JSON_BYTES = 8 * 1024 * 1024;
/** Картинка-снимок страницы. */
const MAX_PNG_BYTES = 12 * 1024 * 1024;

export type PolotnoProject = {
  id: string;
  name: string;
  updatedAt: string;
  sizeBytes: number | null;
};

/** Текущий ученик. null — вошёл не ученик. */
async function currentStudent(): Promise<{ id: string; schoolId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("students").select("id, school_id").eq("user_id", user.id).maybeSingle();
  return data ? { id: data.id as string, schoolId: data.school_id as string } : null;
}

export type SavePolotnoResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_student" | "too_big" | "limit" | "failed" };

/**
 * Сохраняет работу. `projectId` пуст — новая, иначе перезапись своей.
 *
 * Картинка необязательна: если браузер не смог её отрисовать, проект всё равно
 * сохранится — терять работу из-за снимка нельзя.
 */
export async function savePolotnoProject(fd: FormData): Promise<SavePolotnoResult> {
  const student = await currentStudent();
  if (!student) return { ok: false, error: "not_student" };

  const json = fd.get("json");
  if (!(json instanceof File)) return { ok: false, error: "failed" };
  if (json.size > MAX_JSON_BYTES) return { ok: false, error: "too_big" };

  const png = fd.get("png");
  const preview = png instanceof File && png.size > 0 && png.size <= MAX_PNG_BYTES ? png : null;

  const name = String(fd.get("name") ?? "").trim().slice(0, 120) || "Без названия";
  const projectId = String(fd.get("projectId") ?? "").trim() || null;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  // Перезапись — только своей работы: чужой id в форме иначе затёр бы чужой
  // проект, служебный клиент прав не спрашивает.
  let rowId = projectId;
  if (rowId) {
    const { data: own } = await anyAdmin
      .from("sandbox_projects").select("id").eq("id", rowId).eq("student_id", student.id).maybeSingle();
    if (!own) return { ok: false, error: "failed" };
  } else {
    const { count } = await anyAdmin
      .from("sandbox_projects").select("id", { count: "exact", head: true })
      .eq("student_id", student.id).eq("service_id", SERVICE_ID).eq("is_autosave", false);
    if ((count ?? 0) >= POLOTNO_PROJECT_LIMIT) return { ok: false, error: "limit" };

    const { data: created, error: insErr } = await anyAdmin
      .from("sandbox_projects")
      .insert({
        student_id: student.id, school_id: student.schoolId, name,
        service_id: SERVICE_ID, origin: "sandbox", is_autosave: false,
      })
      .select("id").single();
    if (insErr || !created) return { ok: false, error: "failed" };
    rowId = created.id as string;
  }

  const jsonPath = schoolStoragePath(student.schoolId, student.id, `${rowId}.json`);
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(jsonPath, json, { contentType: "application/json", upsert: true });
  if (upErr) return { ok: false, error: "failed" };

  if (preview) {
    const pngPath = schoolStoragePath(student.schoolId, student.id, `${rowId}.png`);
    const { error: pngErr } = await admin.storage
      .from(BUCKET)
      .upload(pngPath, preview, { contentType: "image/png", upsert: true });
    // Снимок не критичен: работа уже сохранена, ошибку только пишем в журнал.
    if (pngErr) console.error("[polotno] снимок не сохранился:", pngErr.message);
  }

  const { error: updErr } = await anyAdmin
    .from("sandbox_projects")
    .update({ name, file_path: jsonPath, updated_at: new Date().toISOString() })
    .eq("id", rowId).eq("student_id", student.id);
  if (updErr) return { ok: false, error: "failed" };

  revalidatePath("/projects");
  return { ok: true, id: rowId! };
}

/** Свои работы Polotno, свежие сверху. */
export async function listPolotnoProjects(): Promise<PolotnoProject[]> {
  const student = await currentStudent();
  if (!student) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  const { data } = await anyAdmin
    .from("sandbox_projects")
    .select("id, name, updated_at, file_path")
    .eq("student_id", student.id).eq("service_id", SERVICE_ID).eq("is_autosave", false)
    .not("file_path", "is", null)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as Array<{ id: string; name: string; updated_at: string; file_path: string }>;
  if (rows.length === 0) return [];

  const { data: listed } = await admin.storage
    .from(BUCKET)
    .list(`${student.schoolId}/${student.id}`, { limit: 200 });
  const sizeByName = new Map<string, number>(
    ((listed ?? []) as Array<{ name: string; metadata?: { size?: number } }>)
      .map((o) => [o.name, o.metadata?.size ?? 0]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    updatedAt: r.updated_at,
    sizeBytes: sizeByName.get(`${r.id}.json`) ?? null,
  }));
}

/**
 * Содержимое своей работы — прямо строкой JSON.
 *
 * Подписанной ссылкой, как у Scratch, здесь ходить незачем: файл маленький и
 * текстовый, его читает наш же сервер и отдаёт разобранным. Одним запросом
 * меньше, и адрес хранилища наружу не уходит вовсе.
 */
export async function getPolotnoProjectJson(id: string): Promise<string | null> {
  const student = await currentStudent();
  if (!student) return null;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (admin as any)
    .from("sandbox_projects").select("file_path")
    .eq("id", id).eq("student_id", student.id).maybeSingle();
  if (!row?.file_path) return null;

  const { data, error } = await admin.storage.from(BUCKET).download(row.file_path as string);
  if (error || !data) return null;
  return await data.text();
}

/** Подписанная ссылка на картинку работы — бакет приватный, ссылка живёт минуту. */
export async function getPolotnoProjectImageUrl(id: string): Promise<string | null> {
  const student = await currentStudent();
  if (!student) return null;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (admin as any)
    .from("sandbox_projects").select("file_path")
    .eq("id", id).eq("student_id", student.id).maybeSingle();
  if (!row?.file_path) return null;
  const pngPath = String(row.file_path).replace(/\.json$/, ".png");
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(pngPath, 60);
  return data?.signedUrl ?? null;
}

export async function deletePolotnoProject(id: string): Promise<{ ok: boolean }> {
  const student = await currentStudent();
  if (!student) return { ok: false };
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;
  const { data: row } = await anyAdmin
    .from("sandbox_projects").select("file_path")
    .eq("id", id).eq("student_id", student.id).maybeSingle();
  if (!row) return { ok: false };

  if (row.file_path) {
    const jsonPath = row.file_path as string;
    await admin.storage.from(BUCKET).remove([jsonPath, jsonPath.replace(/\.json$/, ".png")]);
  }
  const { error } = await anyAdmin
    .from("sandbox_projects").delete().eq("id", id).eq("student_id", student.id);
  if (error) return { ok: false };

  revalidatePath("/projects");
  return { ok: true };
}
