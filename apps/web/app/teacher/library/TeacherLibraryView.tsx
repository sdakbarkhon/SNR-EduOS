"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Library, Plus, FileText, Video, FileImage, File as FileIcon,
  MoreHorizontal, Trash2, X, Upload, Search, AlertTriangle, Link as LinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLibraryMaterial, deleteLibraryMaterial, getLibraryMaterialUrl, getSubjectStyle } from "@snr/core";
import type { LibraryMaterialWithDetails } from "@snr/core";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components";
import { SubjectIcon } from "@/components/SubjectIcon";
import { ErrorState } from "@/components/ErrorState";
import { FileViewerModal } from "@/components/FileViewerModal";
import { parseVideoUrl } from "@/lib/video-url";
import { useRouter } from "next/navigation";

// 6А, Заход B — Библиотека материалов учителей (/teacher/library, migration
// 147). Заход C — прикрепление к уроку (через пикер «База знаний»). Заход D
// (эта правка) — видео-ссылки (YouTube/RuTube), миграция 148: та же
// content_type/external_url/source_url форма, что lesson_materials
// (миграция 138) — переиспользуем готовый parseVideoUrl (lib/video-url.ts)
// и готовый embed-вьюер (FileViewerModal, kind "embed"), ничего не изобретаем.

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "video/mp4",
];
const MAX_SIZE = 52428800; // 50 МБ — совпадает с лимитом бакета "materials"

type DisplayType = "pdf" | "pptx" | "image" | "video" | "file";

function resolveType(mat: Pick<LibraryMaterialWithDetails, "content_type" | "file_type">): DisplayType {
  if (mat.content_type === "video_youtube" || mat.content_type === "video_rutube") return "video";
  const m = mat.file_type ?? "";
  if (m === "application/pdf") return "pdf";
  if (m.includes("presentation")) return "pptx";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return "file";
}

const TYPE_ICON: Record<DisplayType, typeof FileText> = {
  pdf: FileText, pptx: FileImage, image: FileImage, video: Video, file: FileIcon,
};

const TYPE_COLORS: Record<DisplayType, string> = {
  pdf:   "text-red-500 bg-red-100/60",
  pptx:  "text-orange-500 bg-orange-100/60",
  image: "text-emerald-500 bg-emerald-100/60",
  video: "text-purple-500 bg-purple-100/60",
  file:  "text-slate-500 bg-slate-100/60",
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  // timeZone: "UTC" — идентичный вывод на сервере и клиенте (нет hydration mismatch).
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

// ── Toast (тот же самодостаточный паттерн, что TeacherMaterialsView — на
// учительском шелле ToastProvider не смонтирован, useToast() был бы no-op) ──

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl">
      {msg}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────

function UploadModal({
  groups,
  teacherId,
  subjectSlug,
  d,
  onClose,
  onSuccess,
}: {
  groups: Array<{ id: string; name: string }>;
  teacherId: string;
  subjectSlug: string;
  d: ReturnType<typeof getDictionary>;
  onClose: () => void;
  onSuccess: (title: string) => void;
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
    if (!title.trim()) { setError(d.teacher.libraryErrTitleRequired); return; }
    if (!file) { setError(d.teacher.libraryErrFileRequired); return; }
    if (!ALLOWED_MIME.includes(file.type)) { setError(d.teacher.libraryErrFileType); return; }
    if (file.size > MAX_SIZE) { setError(d.teacher.libraryErrFileTooLarge); return; }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const sb = createClient();
      const materialId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${teacherId}/library/${materialId}/${safeName}`;

      const ramp = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 300);
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

      setProgress(100);
      onSuccess(title.trim());
    } catch (err) {
      console.error("[library] upload error:", err);
      setError(err instanceof Error ? err.message : d.teacher.libraryErrUploadFailed);
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">{d.teacher.libraryUploadTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {d.teacher.libraryName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={d.teacher.libraryNamePlaceholder}
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Предмет — read-only, из роли учителя, не из формы. */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{d.teacher.librarySubjectLabel}</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <SubjectIcon subject={subjectSlug} size={22} />
              {subjectLabel}
            </div>
          </div>

          {/* Классы — мультиселект + "Все классы" (пусто = все, ничего в junction не создаём). */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{d.teacher.libraryClassesLabel}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGroupIds(new Set())}
                disabled={uploading}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  allClasses ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {d.teacher.libraryAllClasses}
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
              {d.teacher.libraryFile} <span className="text-red-500">*</span>
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
                <p className="text-sm font-semibold text-blue-700">{file.name} ({formatSize(file.size)})</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{d.teacher.libraryDragDrop}</p>
                  <p className="text-xs text-slate-400">{d.teacher.libraryMaxSize}</p>
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
                <span>{d.teacher.libraryUploading}</span>
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
              {d.teacher.libraryCancel}
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim() || !file}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? d.teacher.libraryUploading : d.teacher.libraryUpload}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Video link modal ─────────────────────────────────────────────────────

function VideoLinkModal({
  groups,
  subjectSlug,
  d,
  onClose,
  onSuccess,
}: {
  groups: Array<{ id: string; name: string }>;
  subjectSlug: string;
  d: ReturnType<typeof getDictionary>;
  onClose: () => void;
  onSuccess: (title: string) => void;
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
    if (!title.trim()) { setError(d.teacher.libraryErrTitleRequired); return; }
    if (!urlInput.trim()) { setError(d.teacher.libraryErrVideoUrlRequired); return; }
    const p = parseVideoUrl(urlInput.trim());
    if (!p) { setError(d.teacher.libraryErrVideoUrlInvalid); return; }

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
      onSuccess(title.trim());
    } catch (err) {
      console.error("[library] video link error:", err);
      setError(err instanceof Error ? err.message : d.teacher.libraryErrUploadFailed);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">{d.teacher.libraryVideoModalTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {d.teacher.libraryName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={d.teacher.libraryNamePlaceholder}
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{d.teacher.librarySubjectLabel}</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <SubjectIcon subject={subjectSlug} size={22} />
              {subjectLabel}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{d.teacher.libraryClassesLabel}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGroupIds(new Set())}
                disabled={saving}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  allClasses ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {d.teacher.libraryAllClasses}
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
              {d.teacher.libraryVideoUrlLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={d.teacher.libraryVideoUrlPlaceholder}
                disabled={saving}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
            </div>
            {urlInput.trim() && !parsed && (
              <p className="mt-1.5 text-xs font-medium text-amber-600">{d.teacher.libraryErrVideoUrlInvalid}</p>
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
              {d.teacher.libraryCancel}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !parsed}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? d.teacher.libraryUploading : d.teacher.libraryUpload}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────

export function TeacherLibraryView({
  materials: initialMaterials,
  loadError,
  groups,
  teacherId,
  subjectSlug,
}: {
  materials: LibraryMaterialWithDetails[];
  loadError: boolean;
  groups: Array<{ id: string; name: string }>;
  teacherId: string;
  subjectSlug: string | null;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const isCurator = !subjectSlug;

  const [materials, setMaterials] = useState(initialMaterials);
  const [showUpload, setShowUpload] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => { setMaterials(initialMaterials); }, [initialMaterials]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  useEffect(() => {
    if (!menuOpenId) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest(`[data-menu-id="${menuOpenId}"]`)) setMenuOpenId(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpenId(null); }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  const subjectOptions = useMemo(() => {
    const set = new Set(materials.map((m) => m.subject_slug).filter((s): s is string => Boolean(s)));
    return Array.from(set);
  }, [materials]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return materials.filter((m) => {
      const matchSubject = filterSubject === "all" || m.subject_slug === filterSubject;
      const matchGroup =
        filterGroup === "all" ||
        m.groups.length === 0 || // 0 групп = видно всем классам — совпадает с любым фильтром
        m.groups.some((g) => g.id === filterGroup);
      const matchQuery = !q || m.title.toLowerCase().includes(q);
      return matchSubject && matchGroup && matchQuery;
    });
  }, [materials, filterSubject, filterGroup, query]);

  function notifyAdded(title: string) {
    setToast(`${d.teacher.librarySuccess}: ${title}`);
    router.refresh();
  }

  function handleUploadSuccess(title: string) {
    setShowUpload(false);
    notifyAdded(title);
  }

  function handleVideoSuccess(title: string) {
    setShowVideoModal(false);
    notifyAdded(title);
  }

  async function handleOpen(mat: LibraryMaterialWithDetails) {
    setMenuOpenId(null);
    // Видео-ссылка — нет Storage-объекта, открываем встроенный плеер
    // напрямую по уже нормализованному external_url (тот же FileViewerModal,
    // что материалы урока/базы знаний — resolveFileViewerKind распознаёт
    // embed-URL сам, без доп. классификации здесь).
    if (mat.content_type !== "file") {
      if (mat.external_url) setViewer({ url: mat.external_url, title: mat.title });
      return;
    }
    if (!mat.storage_path) return;
    setOpeningId(mat.id);
    try {
      const url = await getLibraryMaterialUrl(createClient(), mat.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[library] open error:", err);
      setToast(d.common.error);
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(mat: LibraryMaterialWithDetails) {
    setMenuOpenId(null);
    setDeleting(mat.id);
    try {
      await deleteLibraryMaterial(createClient(), mat.id);
      setMaterials((prev) => prev.filter((m) => m.id !== mat.id));
      router.refresh();
    } catch (err) {
      console.error("[library] delete error:", err);
      setToast(d.teacher.libraryErrDeleteFailed);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="text-slate-800">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {viewer && (
        <FileViewerModal
          url={viewer.url}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      )}
      {showUpload && !isCurator && subjectSlug && (
        <UploadModal
          groups={groups}
          teacherId={teacherId}
          subjectSlug={subjectSlug}
          d={d}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
      {showVideoModal && !isCurator && subjectSlug && (
        <VideoLinkModal
          groups={groups}
          subjectSlug={subjectSlug}
          d={d}
          onClose={() => setShowVideoModal(false)}
          onSuccess={handleVideoSuccess}
        />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-gray-900 md:text-[26px]">{d.teacher.libraryTitle}</h1>
        {isCurator ? (
          <span className="rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
            {d.teacher.libraryCuratorNotice}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-2xl bg-[#185AF7] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {d.teacher.libraryUploadBtn}
            </button>
            <button
              onClick={() => setShowVideoModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              <LinkIcon className="h-4 w-4" />
              {d.teacher.libraryAddVideoBtn}
            </button>
          </div>
        )}
      </div>

      {loadError && <div className="mb-6"><ErrorState>{d.teacher.libraryError}</ErrorState></div>}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder={d.teacher.librarySearchPlaceholder}
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            className="w-56 rounded-xl border border-white/50 bg-white/60 py-2 pl-9 pr-4 text-sm text-slate-700 backdrop-blur-md placeholder-slate-400 focus:outline-none"
          />
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
        >
          <option value="all">{d.teacher.libraryAllSubjects}</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>{getSubjectStyle(s).label}</option>
          ))}
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
        >
          <option value="all">{d.teacher.libraryAllClasses}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {!loadError && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <Library className="h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-500">
            {materials.length === 0 ? d.teacher.libraryEmpty : d.teacher.libraryEmptyFiltered}
          </p>
        </div>
      ) : !loadError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((mat) => {
            const dtype = resolveType(mat);
            const isVideo = mat.content_type !== "file";
            const Icon = TYPE_ICON[dtype];
            const isDeleting = deleting === mat.id;
            const isOpening = openingId === mat.id;
            const isAuthor = mat.uploaded_by === teacherId;
            const subjectLabel = getSubjectStyle(mat.subject_slug).label;
            const classesLabel = mat.groups.length === 0 ? d.teacher.libraryAllClasses : mat.groups.map((g) => g.name).join(", ");
            return (
              <div
                key={mat.id}
                onClick={() => handleOpen(mat)}
                className="group relative flex h-[210px] cursor-pointer flex-col rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-lg"
              >
                {isAuthor && (
                  <div className="absolute right-3 top-3 z-30" data-menu-id={mat.id}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === mat.id ? null : mat.id); }}
                      className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpenId === mat.id && (
                      <div className="absolute right-0 top-8 min-w-[140px] overflow-hidden rounded-xl border border-white/60 bg-white shadow-xl">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(mat); }}
                          disabled={isDeleting}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? d.teacher.libraryDeleting : d.teacher.libraryDelete}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="z-10 flex flex-1 flex-col items-center justify-center">
                  <div className="relative mb-2">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${TYPE_COLORS[dtype]}`}>
                      {isOpening ? (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Icon className="h-8 w-8" />
                      )}
                    </div>
                    {isVideo && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white shadow">
                        {d.teacher.libraryVideoBadge}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 px-2 text-center text-sm font-bold leading-tight text-slate-800">{mat.title}</p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                    <SubjectIcon subject={mat.subject_slug} size={16} />
                    {subjectLabel}
                  </div>
                </div>

                <div className="z-10 mt-auto flex flex-col gap-1 pt-2">
                  <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {classesLabel}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate">{d.teacher.libraryUploadedBy}: {mat.uploader_name ?? "—"}</span>
                    <span className="whitespace-nowrap">{formatDate(mat.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
