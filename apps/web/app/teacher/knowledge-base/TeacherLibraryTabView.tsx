"use client";

// Регенерация 29.07, ЭТАП 12 — "Материалы кафедры", отдельная просматриваемая
// вкладка (не только модалка-пикер прикрепления). Переиспользует 100%
// существующий бэкенд миграции 147/148 (teacher_library_materials) —
// getLibraryMaterials/createLibraryMaterial/deleteLibraryMaterial и
// LibraryUploadModal/LibraryVideoLinkModal (экспортированы из
// KnowledgeBaseFilePicker.tsx, форма 1:1, без дублирования кода). Никакой
// новой таблицы/RLS — см. resheniya_2.md за полное объяснение (стандалон-
// страница "Материалы кафедры" существовала раньше под /teacher/library,
// была снесена и её CRUD перенесён в пикер — здесь тот же бэкенд просто
// снова получает отдельную вкладку для чтения/просмотра, не только выбора
// при прикреплении к уроку).
//
// НЕТ "Избранное" — не реализовывалось (нет такой колонки/RLS на этой
// таблице, в отличие от books/book_favorites).
// НЕТ material_type/author/description — колонок нет в живой схеме (RLS
// миграции 147/148 их не содержат) — см. resheniya_2.md, миграция-черновик
// с этими полями подготовлена, но НЕ применена (нет доступа к прямому
// Postgres-подключению/Supabase CLI с прод-проектом в этой среде — ручной
// шаг заказчика).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Link as LinkIcon, Trash2, Search, Video, FileText, FileImage, File as FileIcon, Library } from "lucide-react";
import { useLocale } from "@/components";
import { getDictionary, getSubjectStyle, deleteLibraryMaterial } from "@snr/core";
import type { Locale, LibraryMaterialWithDetails } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { FileViewerModal } from "@/components/FileViewerModal";
import { LibraryUploadModal, LibraryVideoLinkModal } from "@/components/KnowledgeBaseFilePicker";

function iconFor(fileType: string | null, isVideo: boolean) {
  if (isVideo) return Video;
  const t = fileType ?? "";
  if (t === "application/pdf") return FileText;
  if (t.startsWith("image/")) return FileImage;
  if (t.includes("presentation") || t.includes("powerpoint")) return FileImage;
  return FileIcon;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function TeacherLibraryTabView({
  initialMaterials,
  groups,
  initialTeacherId,
  initialSubjectSlug,
}: {
  initialMaterials: LibraryMaterialWithDetails[];
  groups: Array<{ id: string; name: string }>;
  initialTeacherId: string;
  initialSubjectSlug: string | null;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const dt = getDictionary(locale as Locale).teacher;
  const [materials, setMaterials] = useState(initialMaterials);
  const [showUpload, setShowUpload] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>(initialSubjectSlug ?? "all");
  const [viewer, setViewer] = useState<{ url: string; title: string; fileName: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => { setMaterials(initialMaterials); }, [initialMaterials]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const isCurator = !initialSubjectSlug;

  const subjectsPresent = useMemo(() => {
    const set = new Set(materials.map((m) => m.subject_slug).filter(Boolean));
    return Array.from(set) as string[];
  }, [materials]);

  const displayed = useMemo(() => {
    const q = query.toLowerCase();
    return materials.filter((m) => {
      const matchSubject = filterSubject === "all" || m.subject_slug === filterSubject;
      const matchQuery = !q || m.title.toLowerCase().includes(q) || (m.uploader_name ?? "").toLowerCase().includes(q);
      return matchSubject && matchQuery;
    });
  }, [materials, query, filterSubject]);

  function handleUploadSuccess() {
    setShowUpload(false);
    router.refresh();
  }
  function handleVideoSuccess() {
    setShowVideo(false);
    router.refresh();
  }

  async function handleOpen(m: LibraryMaterialWithDetails) {
    if (m.content_type !== "file") {
      if (m.external_url) window.open(m.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!m.url) { setError(dt.libraryErrUploadFailed); return; }
    setOpeningId(m.id);
    try {
      const fileName = m.storage_path?.split("/").pop() || m.title;
      setViewer({ url: m.url, title: m.title, fileName });
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(materialId: string) {
    setDeletingId(materialId);
    setError(null);
    try {
      await deleteLibraryMaterial(createClient(), materialId);
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
      router.refresh();
    } catch {
      setError(dt.libraryErrUploadFailed);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="text-slate-800">
      {viewer && (
        <FileViewerModal url={viewer.url} title={viewer.title} fileName={viewer.fileName} onClose={() => setViewer(null)} />
      )}

      {showUpload && (
        <LibraryUploadModal
          groups={groups}
          teacherId={initialTeacherId}
          subjectSlug={initialSubjectSlug ?? ""}
          dt={dt}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
      {showVideo && (
        <LibraryVideoLinkModal
          groups={groups}
          subjectSlug={initialSubjectSlug ?? ""}
          dt={dt}
          onClose={() => setShowVideo(false)}
          onSuccess={handleVideoSuccess}
        />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {!isCurator ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-2xl bg-[#185AF7] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95"
            >
              <Plus className="h-4 w-4" /> {dt.libraryUploadBtn}
            </button>
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <LinkIcon className="h-4 w-4" /> {dt.libraryAddVideoBtn}
            </button>
          </div>
        ) : (
          <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">{dt.libraryCuratorNotice}</span>
        )}
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>

      {materials.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск по названию или автору…"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              className="w-64 rounded-xl border border-white/50 bg-white/60 py-2 pl-9 pr-4 text-sm text-slate-700 backdrop-blur-md placeholder-slate-400 focus:outline-none"
            />
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
          {subjectsPresent.length > 1 && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
            >
              <option value="all">Все предметы</option>
              {subjectsPresent.map((s) => (
                <option key={s} value={s}>{getSubjectStyle(s).label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <Library className="h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-500">Материалов пока нет</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <p className="text-base font-semibold text-slate-500">Ничего не найдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayed.map((m) => {
            const isVideo = m.content_type !== "file";
            const Icon = iconFor(m.file_type, isVideo);
            const isMine = m.uploaded_by === initialTeacherId;
            const style = m.subject_slug ? getSubjectStyle(m.subject_slug) : null;
            return (
              <div key={m.id} className="group relative cursor-pointer" onClick={() => handleOpen(m)}>
                <div
                  className="relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl"
                  style={{ background: style ? `linear-gradient(135deg, ${style.color}, ${style.color}CC)` : "linear-gradient(135deg, #64748B, #334155)" }}
                >
                  {isMine && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                      disabled={deletingId === m.id}
                      title={dt.libraryDelete}
                      className="absolute right-2 top-2 z-10 rounded-lg border border-white/20 bg-white/70 p-1.5 backdrop-blur-xl transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-600" />
                    </button>
                  )}
                  <Icon className="h-12 w-12 text-white/90 transition-transform duration-300 group-hover:scale-110" />
                  {openingId === m.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                </div>
                {style && <p className="mb-0.5 text-xs uppercase tracking-wide text-slate-400">{style.label}</p>}
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">{m.title}</h3>
                {m.uploader_name && <p className="mt-0.5 text-xs text-slate-400">{m.uploader_name}</p>}
                {m.file_size_bytes ? <p className="mt-0.5 text-[10px] text-slate-300">{formatSize(m.file_size_bytes)}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
