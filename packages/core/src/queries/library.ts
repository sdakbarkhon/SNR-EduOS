// 6А, Заход A — Библиотека материалов учителей (migration 147).
//
// Раздел видим только учителям (RLS SELECT — EXISTS в teachers). v1: все
// учителя видят все материалы независимо от предмета/класса — subjectSlug/
// groupId в getLibraryMaterials — фильтры для удобства поиска на клиенте,
// НЕ ограничение доступа (RLS и так пускает любого учителя).
//
// attachLibraryMaterialToLesson (тонкая обёртка над
// linkLessonMaterialFromKnowledgeBase) сознательно живёт в index.ts, а не
// здесь — рядом с функцией, которую оборачивает, тем же паттерном, каким
// parent.ts/curriculum.ts не импортируют из index.ts, чтобы не создавать
// циклическую зависимость index.ts <-> library.ts (index.ts делает
// `export * from "./library"`).

import type { Db } from "../supabase/factory";
import type { LibraryMaterial, LibraryMaterialGroup, LibraryMaterialWithDetails } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

type LibraryMaterialRow = LibraryMaterial & {
  uploader: { full_name: string; subject_slug: string | null } | null;
  groups: Array<{ group: { id: string; name: string } | null }> | null;
};

/** Signed URL (1 час) на файл библиотеки — бакет "materials" по умолчанию,
 *  переиспользует тот же паттерн, что getMaterialDownloadUrl/
 *  getLessonMaterialUrl в index.ts (не импортируем их напрямую — см.
 *  комментарий в шапке файла про циклическую зависимость; каждый домен в
 *  этой кодовой базе держит свой тонкий сигнед-урл враппер, см.
 *  getLessonMaterialUrl/getMaterialDownloadUrl/getStageAttachmentUrl).
 *  bucket — K.1, 05.08.2026: video_mp4-записи лежат в "lesson-videos". */
export const getLibraryMaterialUrl = (
  db: Db,
  storagePath: string,
  downloadAs?: string,
  bucket: string = "materials",
): Promise<string> =>
  db.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined)
    .then(({ data, error }) => {
      if (error) throw error;
      return data!.signedUrl;
    });

export type LibraryMaterialFilters = { subjectSlug?: string; groupId?: string };

/** Все материалы библиотеки школы (v1 — вся школа, не только свой предмет),
 *  с классами (из junction-таблицы), именем+предметом загрузившего и
 *  signed URL файла. subjectSlug фильтруется в SQL (обычная колонка строки);
 *  groupId — на клиенте, т.к. "0 строк в junction = видно всем классам"
 *  должно совпадать с ЛЮБЫМ groupId-фильтром — SQL-джойн на junction этого
 *  не выразит (не отдаст строки без совпадающей junction-записи). */
export async function getLibraryMaterials(
  db: Db,
  filters?: LibraryMaterialFilters,
): Promise<LibraryMaterialWithDetails[]> {
  let q = (db as AnyDb)
    .from("teacher_library_materials")
    .select(
      "*, uploader:teachers!uploaded_by(full_name, subject_slug), " +
      "groups:teacher_library_material_groups(group:groups(id, name))",
    )
    .order("created_at", { ascending: false });
  if (filters?.subjectSlug) q = q.eq("subject_slug", filters.subjectSlug);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as LibraryMaterialRow[];
  const filtered = filters?.groupId
    ? rows.filter((r) => {
        const groups = r.groups ?? [];
        if (groups.length === 0) return true; // 0 строк = "все классы"
        return groups.some((g) => g.group?.id === filters.groupId);
      })
    : rows;

  return Promise.all(
    filtered.map(async (r) => ({
      ...r,
      uploader_name: r.uploader?.full_name ?? null,
      groups: (r.groups ?? [])
        .map((g) => g.group)
        .filter((g): g is LibraryMaterialGroup => g !== null),
      // migration 148 — video_youtube/video_rutube не имеют Storage-объекта:
      // signed URL не запрашиваем (нечего подписывать), открывать по
      // external_url. video_mp4 (K.1, 05.08.2026) — есть storage_path, но в
      // отдельном бакете lesson-videos, не "materials".
      url: r.storage_path
        ? await getLibraryMaterialUrl(db, r.storage_path, undefined, r.content_type === "video_mp4" ? "lesson-videos" : "materials")
        : null,
    })),
  );
}

export type CreateLibraryMaterialInput =
  | {
      contentType?: "file";
      title: string;
      storagePath: string;
      fileType: string | null;
      fileSizeBytes: number | null;
      /** Классы, которым виден материал. Пустой массив = "Все классы" (не
       *  создаём строк в junction-таблице). */
      groupIds: string[];
    }
  | {
      // migration 148 — видео-ссылка (YouTube/RuTube) вместо файла.
      // externalUrl — уже нормализованный embed-URL (toEmbedUrl() на
      // стороне apps/web/lib/video-url.ts — парсинг URL сюда не тащим, тем
      // же принципом, что addLessonMaterialVideo в index.ts). sourceUrl —
      // то, что вставил учитель, для показа "откуда" видео.
      // Миграция 175 — сюда добавился video_mp4: ПРЯМАЯ .mp4-ссылка (не
      // загруженный файл, тот ниже). Раньше ветка video_mp4 в CHECK требовала
      // storage_path, поэтому такую ссылку сохранить было нельзя — и до
      // 4fe7585 она молча ложилась как video_rutube. Теперь video_mp4 значит
      // «mp4 либо файлом, либо ссылкой», а какой это случай — видно по тому,
      // заполнен storage_path или external_url.
      contentType: "video_youtube" | "video_rutube" | "video_mp4";
      title: string;
      externalUrl: string;
      sourceUrl: string;
      groupIds: string[];
    }
  | {
      // K.1, 05.08.2026, миграция 167 — загруженный .mp4 (bucket
      // lesson-videos, не "materials"). storagePath уже готов — загрузку
      // делает apps/web/lib/video-storage.ts::uploadVideoFile.
      contentType: "video_mp4";
      title: string;
      storagePath: string;
      fileSizeBytes: number;
      groupIds: string[];
    };

/** Вставляет строку библиотеки (файл ИЛИ видео-ссылка — по contentType) +
 *  строки junction по groupIds. school_id НЕ передаём — берётся из DEFAULT
 *  current_school_id() (миграция 147/72), корректно резолвится для
 *  настоящей учительской сессии (auth.uid() заполнен). subject_slug тоже
 *  НЕ принимаем аргументом — резолвим здесь из роли текущего учителя: и
 *  для UX (RLS insert требует точного совпадения subject_slug с ролью
 *  автора — подставлять его на клиенте вручную было бы дублированием
 *  источника истины), и чтобы curator/не-учитель получили понятную ошибку
 *  ДО похода в БД, а не голый 42501 от RLS. Fail closed: ошибка резолва
 *  учителя — throw, не silent-null (тот же принцип, что
 *  getTeacherSubjectFilter в index.ts). Саму загрузку файла в Storage эта
 *  функция не делает — storagePath уже готов (Заход B); видео тоже не
 *  парсит URL — externalUrl/sourceUrl уже готовы (Заход D). */
export async function createLibraryMaterial(
  db: Db,
  input: CreateLibraryMaterialInput,
): Promise<LibraryMaterial> {
  const { data: userRes, error: userErr } = await db.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: teacher, error: teacherErr } = await (db as AnyDb)
    .from("teachers")
    .select("id, subject_slug")
    .eq("user_id", userId)
    .maybeSingle();
  if (teacherErr) throw teacherErr;
  if (!teacher) throw new Error("Текущий пользователь не является учителем");
  if (!teacher.subject_slug) {
    throw new Error("Куратор (без привязки к предмету) не может загружать материалы в библиотеку");
  }

  const insertRow = "externalUrl" in input
    ? {
        uploaded_by: teacher.id,
        subject_slug: teacher.subject_slug,
        title: input.title,
        content_type: input.contentType,
        external_url: input.externalUrl,
        source_url: input.sourceUrl,
      }
    : input.contentType === "video_mp4"
    ? {
        uploaded_by: teacher.id,
        subject_slug: teacher.subject_slug,
        title: input.title,
        content_type: "video_mp4" as const,
        storage_path: input.storagePath,
        file_size_bytes: input.fileSizeBytes,
      }
    : {
        uploaded_by: teacher.id,
        subject_slug: teacher.subject_slug,
        title: input.title,
        content_type: "file" as const,
        storage_path: input.storagePath,
        file_type: input.fileType,
        file_size_bytes: input.fileSizeBytes,
      };

  const { data: material, error: insertErr } = await (db as AnyDb)
    .from("teacher_library_materials")
    .insert(insertRow)
    .select()
    .single();
  if (insertErr) throw insertErr;

  if (input.groupIds.length > 0) {
    const { error: groupsErr } = await (db as AnyDb)
      .from("teacher_library_material_groups")
      .insert(input.groupIds.map((groupId) => ({ material_id: material.id, group_id: groupId })));
    if (groupsErr) throw groupsErr;
  }

  return material as LibraryMaterial;
}

/** Удаляет материал библиотеки (RLS: только автор или super_admin).
 *  Junction-строки чистятся ON DELETE CASCADE — руками не трогаем. Файл в
 *  Storage НЕ удаляется здесь: тот же storage_path (бакет "materials")
 *  может быть уже прилинкован к уроку через
 *  lesson_materials.from_knowledge_base (attachLibraryMaterialToLesson,
 *  index.ts) — удаление файла сломало бы такую ссылку ровно по той же
 *  причине, по которой deleteLessonMaterial уже не трогает Storage для
 *  from_knowledge_base=true записей. */
export async function deleteLibraryMaterial(db: Db, materialId: string): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("teacher_library_materials")
    .delete()
    .eq("id", materialId);
  if (error) throw error;
}
