import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Архивирование и удаление школы. Миграция 202.
 *
 * ДВА РАЗНЫХ ДЕЙСТВИЯ. Архив обратим: школа исчезает из списков и в неё нельзя
 * войти, данные лежат. Удаление необратимо: уходит всё.
 *
 * ЧТО ДЕЛАЕТ БАЗА, А ЧТО КОД. Строки удаляет каскад: миграция 202 перевела все
 * 55 связей на ON DELETE CASCADE, и порядок удаления Postgres знает лучше нас.
 * Кодом остаются две вещи, до которых каскад не дотягивается:
 *
 *   1. ФАЙЛЫ. Пути лежат в колонках (file_storage_path и родня), само хранилище
 *      о школах не знает. Пути собираются ДО удаления строк и удаляются через
 *      API хранилища — иначе файлы остались бы призраками, занимая место и
 *      оставаясь доступными по подписанной ссылке.
 *
 *   2. УЧЁТНЫЕ ЗАПИСИ. Связь идёт в обратную сторону: students.user_id →
 *      auth.users. Каскад по школе строку ученика убирает, а его учётную
 *      запись — нет, и «удалённый» человек продолжал бы входить. Записи
 *      удаляются после школы.
 *
 * ДЕМО-ШКОЛУ УДАЛИТЬ НЕЛЬЗЯ. Запрет стоит триггером в базе (миграция 202) —
 * проверка здесь только для понятного текста ошибки, а не вместо него.
 */

/** Где лежат файлы: таблица со school_id → колонка с путём → бакет. */
const FILE_SOURCES: Array<{ table: string; column: string; bucket: string }> = [
  { table: "lesson_materials", column: "file_storage_path", bucket: "lesson-materials" },
  { table: "course_materials", column: "storage_path", bucket: "materials" },
  { table: "teacher_library_materials", column: "storage_path", bucket: "materials" },
  { table: "homework", column: "attachment_storage_path", bucket: "homework-files" },
  { table: "homework", column: "hint_storage_path", bucket: "homework-files" },
  { table: "homework", column: "tests_attachment_path", bucket: "homework-files" },
  { table: "homework_submissions", column: "file_storage_path", bucket: "homework-files" },
  { table: "classwork", column: "attachment_storage_path", bucket: "homework-files" },
  { table: "classwork_submissions", column: "file_storage_path", bucket: "homework-files" },
  { table: "books", column: "file_storage_path", bucket: "books" },
  { table: "books", column: "cover_storage_path", bucket: "books" },
  { table: "curriculum_plans", column: "source_file_url", bucket: "curriculum-plans" },
  { table: "h5p_content", column: "storage_path", bucket: "h5p-content" },
  { table: "projects", column: "cover_image_path", bucket: "projects" },
  { table: "project_attachments", column: "storage_path", bucket: "projects" },
  { table: "sandbox_projects", column: "file_path", bucket: "scratch-projects" },
];

export type SchoolWipePreview = {
  id: string;
  name: string;
  isDemo: boolean;
  isActive: boolean;
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  groups: number;
  lessons: number;
  grades: number;
  files: number;
};

/**
 * Что именно уйдёт при удалении. Показывается человеку ДО подтверждения:
 * решение должно приниматься с ценой перед глазами, а не вслепую.
 */
export async function getSchoolWipePreview(schoolId: string): Promise<SchoolWipePreview | null> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = sb as any;

  const { data: school } = await any
    .from("schools").select("id, name, is_demo, is_active").eq("id", schoolId).maybeSingle();
  if (!school) return null;

  const count = async (table: string): Promise<number> => {
    const { count: c } = await any
      .from(table).select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    return c ?? 0;
  };

  const [students, teachers, parents, admins, groups, lessons, grades] = await Promise.all([
    count("students"), count("teachers"), count("parents"), count("admins"),
    count("groups"), count("lessons"), count("lesson_grades"),
  ]);

  const files = (await collectFiles(schoolId)).reduce((a, b) => a + b.paths.length, 0);

  return {
    id: school.id, name: school.name, isDemo: !!school.is_demo, isActive: school.is_active !== false,
    students, teachers, parents, admins, groups, lessons, grades, files,
  };
}

/** Пути к файлам школы, сгруппированные по бакетам. */
async function collectFiles(schoolId: string): Promise<Array<{ bucket: string; paths: string[] }>> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = sb as any;
  const byBucket = new Map<string, Set<string>>();

  for (const src of FILE_SOURCES) {
    const { data, error } = await any
      .from(src.table).select(src.column).eq("school_id", schoolId).not(src.column, "is", null);
    if (error) {
      // Таблица могла не иметь такой колонки в старой базе — это не повод
      // ронять удаление, но и молчать нельзя.
      console.error(`[school-lifecycle] ${src.table}.${src.column}: ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as Array<Record<string, string | null>>) {
      const raw = row[src.column];
      if (!raw) continue;
      // В части колонок исторически лежит полный адрес, а не путь: берём хвост
      // после имени бакета, иначе хранилище такой ключ не узнает.
      const marker = `/${src.bucket}/`;
      const path = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw;
      if (!path || path.startsWith("http")) continue;
      const set = byBucket.get(src.bucket) ?? new Set<string>();
      set.add(path);
      byBucket.set(src.bucket, set);
    }
  }
  return [...byBucket.entries()].map(([bucket, paths]) => ({ bucket, paths: [...paths] }));
}

/** Архивировать школу или вернуть из архива. Демо не трогается — запрет в базе. */
export async function setSchoolArchived(schoolId: string, archived: boolean): Promise<void> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("schools").update({ is_active: !archived }).eq("id", schoolId);
  if (error) throw error;
}

export type WipeResult = { files: number; users: number };

/**
 * Удаляет школу насовсем. Возвращает, сколько файлов и учётных записей ушло.
 *
 * Порядок важен: сначала собрать пути и идентификаторы (после удаления строк их
 * узнать будет негде), потом снести школу, потом убрать файлы и записи.
 */
export async function deleteSchoolForever(schoolId: string): Promise<WipeResult> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = sb as any;

  const { data: school } = await any
    .from("schools").select("id, is_demo").eq("id", schoolId).maybeSingle();
  if (!school) throw new Error("Школа не найдена");
  if (school.is_demo) throw new Error("demo_school_cannot_be_deleted");

  const files = await collectFiles(schoolId);

  const userIds = new Set<string>();
  for (const table of ["students", "teachers", "parents", "admins"]) {
    const { data } = await any.from(table).select("user_id").eq("school_id", schoolId).not("user_id", "is", null);
    for (const row of (data ?? []) as Array<{ user_id: string | null }>) {
      if (row.user_id) userIds.add(row.user_id);
    }
  }

  // Строки уходят каскадом — миграция 202.
  const { error: delErr } = await any.from("schools").delete().eq("id", schoolId);
  if (delErr) throw delErr;

  let removedFiles = 0;
  for (const { bucket, paths } of files) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await sb.storage.from(bucket).remove(chunk);
      if (error) console.error(`[school-lifecycle] бакет ${bucket}: ${error.message}`);
      else removedFiles += chunk.length;
    }
  }

  let removedUsers = 0;
  for (const id of userIds) {
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) console.error(`[school-lifecycle] учётная запись ${id}: ${error.message}`);
    else removedUsers += 1;
  }

  return { files: removedFiles, users: removedUsers };
}
