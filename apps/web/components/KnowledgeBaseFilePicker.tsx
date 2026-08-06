"use client";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.3 — модалка выбора файла в стиле проводника:
// сетка иконок, мультивыбор кликом, вкладки (Материалы группы / Библиотека /
// Библиотека учителей). Возвращает выбранные файлы БЕЗ их загрузки —
// вызывающая сторона линкует существующий storage_path (Этап 3.4: без
// дублирования).
//
// 6А, Заход C — вкладка "Библиотека учителей" (teacher_library_materials,
// migration 147). Файлы этой таблицы физически лежат в том же бакете
// "materials", что и course_materials — поэтому source:"teacherLibrary"
// НАМЕРЕННО не требует правок в вызывающих компонентах:
// TeacherLessonDetailView.tsx/CreateHomeworkForm.tsx уже резолвят
// "любой источник, кроме book" в бакет "materials"
// (`pickedFromKB.source === "book" ? ... : ...`), а "teacherLibrary" !== "book".
//
// Уборка (после Захода 2) — отдельная страница /teacher/library снесена:
// загрузка файла / добавление видео-ссылки / удаление своего материала
// перенесены СЮДА, внутрь вкладки "Библиотека учителей", один вход в базу
// знаний вместо двух. Формы 1:1 из снесённой TeacherLibraryView.tsx —
// тот же parseVideoUrl, те же MIME-типы/лимит 50 МБ, тот же
// classes+"Все классы" селектор (полный список групп учителя, НЕ groupIds
// пикера — тот сужен до групп текущего урока/задания, библиотечный материал
// таргетируется независимо). teacherId/subjectSlug резолвятся здесь же
// через getMyTeacher() — новые обязательные пропсы не нужны, оба вызывающих
// места (CreateHomeworkForm.tsx, TeacherLessonDetailView.tsx) не тронуты.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Search, FileText, FileImage, Video, File as FileIcon, Link as LinkIcon, BookOpen,
  Plus, Upload, Trash2,
} from "lucide-react";
import type { MaterialWithGroup, Book, LibraryMaterialWithDetails } from "@snr/core";
import {
  getDictionary,
  getLibraryMaterials,
  createLibraryMaterial,
  deleteLibraryMaterial,
  getMyTeacher,
  getMyGroups,
  getSubjectStyle,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components";
import { createClient } from "@/lib/supabase/client";
import { SubjectIcon } from "@/components/SubjectIcon";
import { parseVideoUrl } from "@/lib/video-url";
import { uploadVideoFile } from "@/lib/video-storage";

export type PickedKnowledgeBaseFile = {
  source: "material" | "book" | "teacherLibrary";
  id: string;
  title: string;
  // Для видео-ссылок библиотеки (contentType video_*, D3) не используется —
  // пусто, реальные данные в externalUrl/sourceUrl ниже.
  storagePath: string;
  fileType: string | null;
  sizeBytes: number | null;
  // D3 — только для source==="teacherLibrary" (migration 148): отличает
  // обычный файл от видео-ссылки. undefined для source "material"/"book"
  // (у них своя, файловая, форма данных).
  contentType?: "file" | "video_youtube" | "video_rutube" | "video_mp4";
  externalUrl?: string | null;
  sourceUrl?: string | null;
};

type Tab = "materials" | "library" | "teacherLibrary";

function iconFor(fileType: string | null, hasLink: boolean) {
  if (hasLink) return LinkIcon;
  const t = fileType ?? "";
  if (t === "application/pdf") return FileText;
  if (t.startsWith("video/")) return Video;
  if (t.startsWith("image/")) return FileImage;
  if (t.includes("presentation") || t.includes("powerpoint")) return FileImage;
  return FileIcon;
}

// ── Библиотека учителей: загрузка/видео-ссылка/удаление (порт из снесённой
// apps/web/app/teacher/library/TeacherLibraryView.tsx, 1:1) ────────────────

const LIB_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "video/mp4",
];
const LIB_MAX_SIZE = 52428800; // 50 МБ — совпадает с лимитом бакета "materials"

function formatLibSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function LibraryUploadModal({
  groups,
  teacherId,
  subjectSlug,
  dt,
  onClose,
  onSuccess,
}: {
  groups: Array<{ id: string; name: string }>;
  teacherId: string;
  subjectSlug: string;
  dt: ReturnType<typeof getDictionary>["teacher"];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const subjectLabel = getSubjectStyle(subjectSlug).label;
  const allClasses = selectedGroupIds.size === 0;

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError(dt.libraryErrTitleRequired); return; }
    if (!file) { setError(dt.libraryErrFileRequired); return; }
    if (!LIB_ALLOWED_MIME.includes(file.type)) { setError(dt.libraryErrFileType); return; }
    if (file.size > LIB_MAX_SIZE) { setError(dt.libraryErrFileTooLarge); return; }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const sb = createClient();
      const ramp = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 300);

      // K.1, 05.08.2026 — .mp4 идёт отдельным путём: bucket lesson-videos
      // (не "materials") + content_type='video_mp4'.
      if (file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4")) {
        const uploaded = await uploadVideoFile(sb, teacherId, file);
        clearInterval(ramp);
        setProgress(95);
        await createLibraryMaterial(sb, {
          contentType: "video_mp4",
          title: title.trim(),
          storagePath: uploaded.storagePath,
          fileSizeBytes: uploaded.sizeBytes,
          groupIds: Array.from(selectedGroupIds),
        });
      } else {
        const materialId = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${teacherId}/library/${materialId}/${safeName}`;

        const { error: uploadErr } = await sb.storage
          .from("materials")
          .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
        clearInterval(ramp);

        if (uploadErr) throw uploadErr;
        setProgress(95);

        await createLibraryMaterial(sb, {
          title: title.trim(),
          storagePath,
          fileType: file.type || null,
          fileSizeBytes: file.size,
          groupIds: Array.from(selectedGroupIds),
        });
      }

      setProgress(100);
      onSuccess();
    } catch (err) {
      console.error("[library] upload error:", err);
      setError(err instanceof Error ? err.message : dt.libraryErrUploadFailed);
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ zIndex: 10010 }}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">{dt.libraryUploadTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {dt.libraryName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={dt.libraryNamePlaceholder}
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Предмет — read-only, из роли учителя, не из формы. */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{dt.librarySubjectLabel}</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <SubjectIcon subject={subjectSlug} size={22} />
              {subjectLabel}
            </div>
          </div>

          {/* Классы — мультиселект + "Все классы" (пусто = все, ничего в junction не создаём). */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{dt.libraryClassesLabel}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGroupIds(new Set())}
                disabled={uploading}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  allClasses ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {dt.libraryAllClasses}
              </button>
              {groups.map((g) => {
                const active = selectedGroupIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    disabled={uploading}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      active ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {dt.libraryFile} <span className="text-red-500">*</span>
            </label>
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                file ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <Upload className="h-6 w-6 text-slate-400" />
              {file ? (
                <p className="text-sm font-semibold text-blue-700">{file.name} ({formatLibSize(file.size)})</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{dt.libraryDragDrop}</p>
                  <p className="text-xs text-slate-400">{dt.libraryMaxSize}</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.pptx,.jpg,.jpeg,.png,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {uploading && (
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                <span>{dt.libraryUploading}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {dt.libraryCancel}
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim() || !file}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? dt.libraryUploading : dt.libraryUpload}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LibraryVideoLinkModal({
  groups,
  subjectSlug,
  dt,
  onClose,
  onSuccess,
}: {
  groups: Array<{ id: string; name: string }>;
  subjectSlug: string;
  dt: ReturnType<typeof getDictionary>["teacher"];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectLabel = getSubjectStyle(subjectSlug).label;
  const allClasses = selectedGroupIds.size === 0;
  // Клиентский парсинг — тот же parseVideoUrl, что уже используют материалы
  // урока (Пачка 4); никакого серверного oEmbed-запроса, без CORS.
  const parsed = useMemo(() => parseVideoUrl(urlInput), [urlInput]);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError(dt.libraryErrTitleRequired); return; }
    if (!urlInput.trim()) { setError(dt.libraryErrVideoUrlRequired); return; }
    const p = parseVideoUrl(urlInput.trim());
    if (!p) { setError(dt.libraryErrVideoUrlInvalid); return; }

    setError(null);
    setSaving(true);
    try {
      await createLibraryMaterial(createClient(), {
        contentType: p.platform === "youtube" ? "video_youtube" : "video_rutube",
        title: title.trim(),
        externalUrl: p.embedUrl,
        sourceUrl: urlInput.trim(),
        groupIds: Array.from(selectedGroupIds),
      });
      onSuccess();
    } catch (err) {
      console.error("[library] video link error:", err);
      setError(err instanceof Error ? err.message : dt.libraryErrUploadFailed);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ zIndex: 10010 }}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">{dt.libraryVideoModalTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {dt.libraryName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={dt.libraryNamePlaceholder}
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{dt.librarySubjectLabel}</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <SubjectIcon subject={subjectSlug} size={22} />
              {subjectLabel}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{dt.libraryClassesLabel}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGroupIds(new Set())}
                disabled={saving}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  allClasses ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {dt.libraryAllClasses}
              </button>
              {groups.map((g) => {
                const active = selectedGroupIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    disabled={saving}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      active ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {dt.libraryVideoUrlLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={dt.libraryVideoUrlPlaceholder}
                disabled={saving}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
            </div>
            {urlInput.trim() && !parsed && (
              <p className="mt-1.5 text-xs font-medium text-amber-600">{dt.libraryErrVideoUrlInvalid}</p>
            )}
          </div>

          {/* Превью — тот же embed-URL, что уйдёт в external_url при сохранении. */}
          {parsed && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
              <div className="aspect-video w-full">
                <iframe
                  src={parsed.embedUrl}
                  title={title || "preview"}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {dt.libraryCancel}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !parsed}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? dt.libraryUploading : dt.libraryUpload}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function KnowledgeBaseFilePicker({
  open,
  onClose,
  onSelect,
  groupIds,
  multiSelect = true,
  acceptedTypes,
  allowVideoLinks = false,
  initialTab,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: PickedKnowledgeBaseFile[]) => void;
  /** Group(s) whose "Материалы группы" should be shown — student/teacher's accessible groups. */
  groupIds: string[];
  multiSelect?: boolean;
  /** Этап 12 финал, Фикс 2 — какая вкладка открыта при показе пикера.
   *  По умолчанию "materials" (как раньше) — передаётся только вызывающей
   *  стороной, у которой есть отдельная кнопка-шорткат ("+ Прикрепить из
   *  Кафедры" в TeacherLessonDetailView.tsx), чтобы не заставлять учителя
   *  кликать вкладку вручную после явного намерения. */
  initialTab?: Tab;
  /** When set, both tabs only show items whose fileType matches (e.g.
   *  ["application/pdf"] for lesson-materials, which now accepts PDF only).
   *  Omit to show everything — the homework-attachment picker relies on
   *  this default to keep accepting all file types. */
  acceptedTypes?: string[];
  /** D3 — показывать ли видео-ссылки библиотеки (content_type video_*) во
   *  вкладке "Библиотека учителей". По умолчанию false: вложение
   *  видео-ссылки поддерживает пока только урок (lesson_materials уже умеет
   *  video_* с миграции 138) — задание/homework video_*-вложения не имеет
   *  вовсе (отдельная будущая миграция), поэтому его форма явно передаёт
   *  false, чтобы учитель не выбрал то, что физически не прикрепится. */
  allowVideoLinks?: boolean;
}) {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale);
  const d = dict.knowledgeBase;
  const dt = dict.teacher;
  const [tab, setTab] = useState<Tab>("materials");
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState<MaterialWithGroup[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<LibraryMaterialWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  // Промт 6А/C — per-source, не общий: одна вкладка может упасть, пока
  // остальные две загрузились нормально; не путать реальный сбой с "пусто".
  const [tabError, setTabError] = useState<Record<Tab, boolean>>({ library: false, materials: false, teacherLibrary: false });
  const [selected, setSelected] = useState<Map<string, PickedKnowledgeBaseFile>>(new Map());

  // Уборка (после Захода 2) — учитель+его группы резолвятся здесь же
  // (getMyTeacher/getMyGroups), а не пропсами: единственные два вызывающих
  // места (форма задания, урок) передают groupIds ТЕКУЩЕГО контекста
  // (сужены до одной группы/группы урока), а библиотечный материал
  // таргетируется на ЛЮБОЙ поднабор ВСЕХ групп учителя — та же семантика,
  // что была на снесённой странице /teacher/library.
  const [myTeacher, setMyTeacher] = useState<{ id: string; subject_slug: string | null } | null>(null);
  const [myGroups, setMyGroups] = useState<Array<{ id: string; name: string }>>([]);
  const isCurator = !myTeacher?.subject_slug;
  const [showLibUpload, setShowLibUpload] = useState(false);
  const [showLibVideo, setShowLibVideo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // groupIds приходит как новый массив-литерал на каждый рендер родителя
  // (см. TeacherLessonDetailView.tsx/CreateHomeworkForm.tsx) — использовать
  // сам массив как dependency сбрасывал бы query/selected и перезапускал
  // fetch при КАЖДОМ ре-рендере родителя, пока модалка открыта (например,
  // от таймеров/realtime в уроке), стирая то, что учитель уже начал искать.
  // groupIdsKey — стабильная строка, меняется только когда реально
  // меняется состав групп.
  const groupIdsKey = groupIds.join(",");

  function loadLibraryFiles(sb: ReturnType<typeof createClient>) {
    return getLibraryMaterials(sb);
  }

  useEffect(() => {
    if (!open) return;
    setTab(initialTab ?? "materials");
    setSelected(new Map());
    setQuery("");
    setTabError({ library: false, materials: false, teacherLibrary: false });
    setDeleteError(null);
    let cancelled = false;
    setLoading(true);
    const sb = createClient();
    Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("course_materials").select("*, group:groups(name, subject)").in("group_id", groupIds.length ? groupIds : ["__none__"])
        .then((res: { data: unknown; error: unknown }) => { if (res.error) throw res.error; return res.data; }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("books").select("*")
        .then((res: { data: unknown; error: unknown }) => { if (res.error) throw res.error; return res.data; }),
      loadLibraryFiles(sb),
      getMyTeacher(sb),
      getMyGroups(sb),
    ]).then(([m, b, lib, teacherRes, groupsRes]) => {
      if (cancelled) return;
      if (m.status === "fulfilled") setMaterials((m.value ?? []) as MaterialWithGroup[]);
      else console.error("[KnowledgeBaseFilePicker] failed to load course_materials:", m.reason);
      if (b.status === "fulfilled") setBooks((b.value ?? []) as Book[]);
      else console.error("[KnowledgeBaseFilePicker] failed to load books:", b.reason);
      if (lib.status === "fulfilled") setLibraryFiles(lib.value);
      else console.error("[KnowledgeBaseFilePicker] failed to load teacher library:", lib.reason);
      if (teacherRes.status === "fulfilled") {
        const t = teacherRes.value as unknown as { id: string; subject_slug: string | null };
        setMyTeacher({ id: t.id, subject_slug: t.subject_slug });
      } else {
        console.error("[KnowledgeBaseFilePicker] failed to resolve current teacher:", teacherRes.reason);
      }
      if (groupsRes.status === "fulfilled") setMyGroups(groupsRes.value as unknown as Array<{ id: string; name: string }>);
      else console.error("[KnowledgeBaseFilePicker] failed to load teacher groups:", groupsRes.reason);
      setTabError({
        materials: m.status === "rejected",
        library: b.status === "rejected",
        teacherLibrary: lib.status === "rejected",
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupIdsKey, initialTab]);

  async function refetchLibrary() {
    try {
      const lib = await getLibraryMaterials(createClient());
      setLibraryFiles(lib);
    } catch (err) {
      console.error("[KnowledgeBaseFilePicker] refetch library failed:", err);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    setDeleteError(null);
    setDeletingId(materialId);
    try {
      await deleteLibraryMaterial(createClient(), materialId);
      setLibraryFiles((prev) => prev.filter((m) => m.id !== materialId));
      setSelected((prev) => {
        const key = `teacherLibrary:${materialId}`;
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } catch (err) {
      console.error("[KnowledgeBaseFilePicker] delete material failed:", err);
      setDeleteError(dt.libraryErrDeleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredMaterials = useMemo(
    () => materials.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())),
    [materials, query],
  );
  const filteredBooks = useMemo(
    () => books.filter((b) => b.title.toLowerCase().includes(query.toLowerCase())),
    [books, query],
  );
  const filteredLibraryFiles = useMemo(
    () =>
      libraryFiles.filter(
        // 6А, Заход D3 — видео-ссылки (content_type video_*) показываем
        // только когда вызывающая сторона явно разрешила (allowVideoLinks,
        // сейчас — только урок; задание video_* пока не прикрепляет).
        (m) => (m.content_type === "file" || allowVideoLinks) && m.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [libraryFiles, query, allowVideoLinks],
  );

  function toggle(item: PickedKnowledgeBaseFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `${item.source}:${item.id}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (!multiSelect) next.clear();
        next.set(key, item);
      }
      return next;
    });
  }

  function confirm() {
    onSelect(Array.from(selected.values()));
    onClose();
  }

  if (!open) return null;

  const allItems: { key: string; title: string; picked: PickedKnowledgeBaseFile; hasLink: boolean; isMine?: boolean }[] =
    tab === "library"
      ? filteredBooks.map((b) => ({
          key: `book:${b.id}`,
          title: b.title,
          hasLink: false,
          picked: { source: "book", id: b.id, title: b.title, storagePath: b.file_storage_path, fileType: "application/pdf", sizeBytes: b.file_size_bytes },
        }))
      : tab === "teacherLibrary"
      ? filteredLibraryFiles.map((m) => ({
          key: `teacherLibrary:${m.id}`,
          title: m.title,
          // hasLink здесь означает "видео-ссылка" для целей выбора иконки —
          // тот же LinkIcon, что materials-вкладка уже использует для
          // link_url-материалов без файла.
          hasLink: m.content_type !== "file",
          isMine: !!myTeacher && m.uploaded_by === myTeacher.id,
          picked: {
            source: "teacherLibrary",
            id: m.id,
            title: m.title,
            storagePath: m.storage_path ?? "",
            fileType: m.file_type,
            sizeBytes: m.file_size_bytes,
            contentType: m.content_type,
            externalUrl: m.external_url,
            sourceUrl: m.source_url,
          },
        }))
      : filteredMaterials.map((m) => ({
          key: `material:${m.id}`,
          title: m.title,
          hasLink: !!m.link_url && !m.storage_path,
          picked: { source: "material", id: m.id, title: m.title, storagePath: m.storage_path ?? m.link_url ?? "", fileType: m.file_type, sizeBytes: m.file_size_bytes },
        }));

  // acceptedTypes is opt-in per call site (undefined = show everything, e.g.
  // the homework-attachment picker) — only lesson-materials passes it, to
  // restrict to PDF-only per the customer's requirement for that form.
  // D3 — video-link items have fileType=null (no MIME — they're not a file
  // at all) and must NOT be caught by this file-type filter: acceptedTypes
  // describes an upload-file restriction, a categorically different axis
  // from "is this a video link". The lesson form already accepts pasted
  // video URLs alongside PDF-only file uploads (see handleUpload below) —
  // letting a KB-sourced video link through here is the same content kind,
  // just picked instead of typed.
  const isVideoItem = (it: { picked: PickedKnowledgeBaseFile }) =>
    it.picked.contentType === "video_youtube" || it.picked.contentType === "video_rutube" || it.picked.contentType === "video_mp4";
  const items = acceptedTypes
    ? allItems.filter((it) => isVideoItem(it) || (it.picked.fileType && acceptedTypes.includes(it.picked.fileType)))
    : allItems;

  const canManageLibrary = tab === "teacherLibrary" && !!myTeacher && !isCurator;

  return (
    // z-index above 9999 — the app's other full-screen modals (e.g. "Прикрепить
    // материал" in TeacherLessonDetailView) use style={{ zIndex: 9999 }}, and this
    // picker can be opened from inside one of them; z-[60] used to render behind it.
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: 10000 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] max-h-[700px] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">{d.pickerTitle}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs — порядок: Материалы группы → Библиотека → Библиотека учителей */}
        <div className="flex gap-2 border-b border-slate-100 px-6 pt-3">
          <button
            onClick={() => setTab("materials")}
            className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${tab === "materials" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            {d.tabGroupMaterials}
          </button>
          <button
            onClick={() => setTab("library")}
            className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${tab === "library" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            {d.tabLibrary}
          </button>
          <button
            onClick={() => setTab("teacherLibrary")}
            className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${tab === "teacherLibrary" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            {d.tabTeacherLibrary}
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-100 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={d.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Уборка — загрузка/видео-ссылка теперь живут прямо во вкладке
            "Библиотека учителей" (была отдельная страница /teacher/library).
            Куратор (subject_slug NULL) видит вкладку, но не эти кнопки —
            RLS insert на teacher_library_materials требует subject_slug,
            createLibraryMaterial() тоже фейлится для куратора с понятной
            ошибкой, но проще не показывать то, что всё равно не сработает. */}
        {tab === "teacherLibrary" && canManageLibrary && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
            <button
              type="button"
              onClick={() => setShowLibUpload(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#185AF7] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {dt.libraryUploadBtn}
            </button>
            <button
              type="button"
              onClick={() => setShowLibVideo(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {dt.libraryAddVideoBtn}
            </button>
            {deleteError && <span className="text-xs font-medium text-red-600">{deleteError}</span>}
          </div>
        )}
        {tab === "teacherLibrary" && isCurator && myTeacher && (
          <div className="border-b border-slate-100 px-6 py-3">
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              {dt.libraryCuratorNotice}
            </span>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">…</div>
          ) : tabError[tab] ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-red-600">{d.loadError}</div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">{d.noResults}</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {items.map((it) => {
                const key = `${it.picked.source}:${it.picked.id}`;
                const isSelected = selected.has(key);
                // teacherLibrary: hasLink=true для видео-ссылок (см. allItems выше)
                // — iconFor уже отдаёт LinkIcon для hasLink, файловую иконку иначе.
                const Icon = tab === "library" ? BookOpen : iconFor(it.picked.fileType, it.hasLink);
                const canDelete = tab === "teacherLibrary" && it.isMine;
                const isDeleting = deletingId === it.picked.id;
                return (
                  <div key={it.key} className="relative">
                    <button
                      type="button"
                      onClick={() => toggle(it.picked)}
                      className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition ${
                        isSelected ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isSelected ? "bg-blue-100" : "bg-slate-100"}`}>
                        <Icon className={`h-6 w-6 ${isSelected ? "text-blue-600" : "text-slate-500"}`} />
                      </div>
                      <p className="line-clamp-2 w-full break-words text-[11px] font-semibold leading-tight text-slate-700">{it.title}</p>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(it.picked.id); }}
                        disabled={isDeleting}
                        title={dt.libraryDelete}
                        className="absolute right-1 top-1 z-10 rounded-full bg-white/95 p-1 text-slate-400 shadow transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
            {d.cancel}
          </button>
          <button
            onClick={confirm}
            disabled={selected.size === 0}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected.size > 0 ? d.selectCount.replace("{n}", String(selected.size)) : d.select}
          </button>
        </div>
      </div>

      {showLibUpload && myTeacher && !isCurator && (
        <LibraryUploadModal
          groups={myGroups}
          teacherId={myTeacher.id}
          subjectSlug={myTeacher.subject_slug ?? ""}
          dt={dt}
          onClose={() => setShowLibUpload(false)}
          onSuccess={() => { setShowLibUpload(false); refetchLibrary(); }}
        />
      )}
      {showLibVideo && myTeacher && !isCurator && (
        <LibraryVideoLinkModal
          groups={myGroups}
          subjectSlug={myTeacher.subject_slug ?? ""}
          dt={dt}
          onClose={() => setShowLibVideo(false)}
          onSuccess={() => { setShowLibVideo(false); refetchLibrary(); }}
        />
      )}
    </div>
  );
}
