// Промт 5Б — сохранённые проекты песочницы (migration 118). Реализовано
// только для CodeSandbox (service_id 'python'|'cpp') — единственный режим
// песочницы с реальным персистируемым состоянием (текст кода) в текущем
// коде; 12 iframe-инструментов не имеют канала для чтения состояния из
// чужого iframe, поэтому не подключены к автосохранению в этом промте.

import type { Db } from "../supabase/factory";
import type { SandboxProject } from "../types";
import { unwrap } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export const SANDBOX_PROJECT_LIMIT = 20;

/** Автосейв-слот (is_autosave=true) для (студент, сервис) — не более одного
 *  в БД (partial unique index). null, если ученик ещё не работал в этом
 *  сервисе. */
export async function getSandboxAutosave(
  db: Db,
  studentId: string,
  serviceId: string,
): Promise<SandboxProject | null> {
  const { data, error } = await (db as AnyDb)
    .from("sandbox_projects")
    .select("*")
    .eq("student_id", studentId)
    .eq("service_id", serviceId)
    .eq("is_autosave", true)
    .maybeSingle();
  if (error) throw error;
  return data as SandboxProject | null;
}

/** UPSERT автосейва по (student_id, service_id). Ручной select-then-write
 *  вместо .upsert(onConflict) — уникальность на is_autosave частичная
 *  (WHERE is_autosave=true), PostgREST upsert не умеет целиться в partial
 *  unique index через onConflict-строку. */
export async function upsertSandboxAutosave(
  db: Db,
  input: { studentId: string; serviceId: string; code: string },
): Promise<SandboxProject> {
  const existing = await getSandboxAutosave(db, input.studentId, input.serviceId);
  if (existing) {
    return (db as AnyDb)
      .from("sandbox_projects")
      .update({ code: input.code })
      .eq("id", existing.id)
      .select("*")
      .single()
      .then(unwrap) as Promise<SandboxProject>;
  }
  return (db as AnyDb)
    .from("sandbox_projects")
    .insert({
      student_id: input.studentId,
      service_id: input.serviceId,
      code: input.code,
      is_autosave: true,
      name: "Автосохранение",
    })
    .select("*")
    .single()
    .then(unwrap) as Promise<SandboxProject>;
}

/** Именованные проекты (is_autosave=false) ученика для сервиса, новые сверху. */
export async function listSandboxProjects(
  db: Db,
  studentId: string,
  serviceId: string,
): Promise<SandboxProject[]> {
  const { data, error } = await (db as AnyDb)
    .from("sandbox_projects")
    .select("*")
    .eq("student_id", studentId)
    .eq("service_id", serviceId)
    .eq("is_autosave", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SandboxProject[];
}

export class SandboxProjectLimitError extends Error {
  constructor() { super(`Достигнут лимит ${SANDBOX_PROJECT_LIMIT} проектов`); }
}
export class SandboxProjectNameTakenError extends Error {
  constructor() { super("Проект с таким названием уже есть"); }
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("Название проекта: 1-100 символов");
  }
  return trimmed;
}

/** "Сохранить как..." — новый именованный проект. Бросает
 *  SandboxProjectLimitError (>=20 существующих) или
 *  SandboxProjectNameTakenError (имя занято — проверка до INSERT для
 *  дружелюбного тоста; UNIQUE-индекс в БД — второй рубеж на гонку). */
export async function createSandboxProject(
  db: Db,
  input: { studentId: string; serviceId: string; name: string; code: string },
): Promise<SandboxProject> {
  const name = validateName(input.name);
  const existing = await listSandboxProjects(db, input.studentId, input.serviceId);
  if (existing.length >= SANDBOX_PROJECT_LIMIT) throw new SandboxProjectLimitError();
  if (existing.some((p) => p.name === name)) throw new SandboxProjectNameTakenError();

  const { data, error } = await (db as AnyDb)
    .from("sandbox_projects")
    .insert({
      student_id: input.studentId,
      service_id: input.serviceId,
      name,
      code: input.code,
      is_autosave: false,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new SandboxProjectNameTakenError();
    throw error;
  }
  return data as SandboxProject;
}

/** UPDATE кода активного именованного проекта — вызывается автосохранением,
 *  когда открыт именованный проект (не создаёт новый автосейв-слот). */
export async function updateSandboxProjectCode(db: Db, projectId: string, code: string): Promise<void> {
  const { error } = await (db as AnyDb).from("sandbox_projects").update({ code }).eq("id", projectId);
  if (error) throw error;
}

/** "Переименовать" — только для is_autosave=false (проверка на клиенте до
 *  вызова; RLS не завязана на is_autosave, так что defensive re-check тут
 *  не требуется отдельным запросом — просто не даём UI вызвать это для
 *  автосейва). */
export async function renameSandboxProject(
  db: Db,
  input: { projectId: string; studentId: string; serviceId: string; newName: string },
): Promise<void> {
  const name = validateName(input.newName);
  const existing = await listSandboxProjects(db, input.studentId, input.serviceId);
  if (existing.some((p) => p.name === name && p.id !== input.projectId)) throw new SandboxProjectNameTakenError();

  const { error } = await (db as AnyDb).from("sandbox_projects").update({ name }).eq("id", input.projectId);
  if (error) {
    if (error.code === "23505") throw new SandboxProjectNameTakenError();
    throw error;
  }
}

export async function deleteSandboxProject(db: Db, projectId: string): Promise<void> {
  const { error } = await (db as AnyDb).from("sandbox_projects").delete().eq("id", projectId);
  if (error) throw error;
}
