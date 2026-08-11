"use client";

// Регенерация 29.07, ЭТАП 12 (+ финал) — "Материалы кафедры", отдельная
// просматриваемая вкладка (не только модалка-пикер прикрепления).
// Переиспользует 100% существующий бэкенд миграции 147/148
// (teacher_library_materials) — getLibraryMaterials/createLibraryMaterial/
// deleteLibraryMaterial и LibraryUploadModal/LibraryVideoLinkModal
// (экспортированы из KnowledgeBaseFilePicker.tsx, форма 1:1, без
// дублирования кода). Никакой новой таблицы/RLS в базовом Этапе 12 — см.
// resheniya_2.md.
//
// НЕТ "Избранное" — не реализовывалось (нет такой колонки/RLS на этой
// таблице, в отличие от books/book_favorites).
//
// Финал Этапа 12 — material_type/author/description: колонки добавлены
// миграцией 153 (supabase/migrations/153_teacher_library_metadata.sql),
// которую заказчик применяет вручную через Supabase Dashboard (в этой
// среде нет прямого Postgres-подключения/привязанного Supabase CLI — см.
// комментарий в самом файле миграции). До применения миграции эти поля
// просто отсутствуют в объекте, вернувшемся из select("*") — весь код
// ниже читает их через truthy-проверку (m.material_type && ...), поэтому
// безопасно работает и до, и после применения (просто бейджа не будет,
// пока колонки нет).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Link as LinkIcon, Trash2, Search, Video, FileText, FileImage, File as FileIcon, Library, X, BookOpen,
} from "lucide-react";
import { useLocale } from "@/components";
import { getDictionary, getSubjectStyle, deleteLibraryMaterial } from "@snr/core";
import type { Locale, LibraryMaterialWithDetails } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { FileViewerModal } from "@/components/FileViewerModal";
import { VideoEmbedPlayer } from "@/components/video/VideoEmbedPlayer";
import { LibraryUploadModal, LibraryVideoLinkModal } from "@/components/KnowledgeBaseFilePicker";
import { canUseDepartmentLibrary } from "@/lib/curator";

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

// Этап 12 финал, Фикс 1 — цвет/подпись бейджа material_type. Значения в
// БД (CHECK на teacher_library_materials.material_type, миграция 153) —
// нижним регистром: сборник/конспект/план/учебник/методичка/презентация.
// "план" отображается как "План урока" (промт фикса 1 просит именно эту
// подпись), остальные — с большой буквы как есть.
const MATERIAL_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  "сборник": { label: "Сборник", className: "bg-blue-100 text-blue-700" },
  "конспект": { label: "Конспект", className: "bg-emerald-100 text-emerald-700" },
  "план": { label: "План урока", className: "bg-orange-100 text-orange-700" },
  "методичка": { label: "Методичка", className: "bg-purple-100 text-purple-700" },
  "учебник": { label: "Учебник", className: "bg-slate-200 text-slate-700" },
  "презентация": { label: "Презентация", className: "bg-pink-100 text-pink-700" },
  // 08.08.2026 — вид «видео» добавлен в CHECK миграцией 178. Ролик заметно
  // отличается от документа, поэтому и цвет отдельный.
  "видео": { label: "Видео", className: "bg-red-100 text-red-700" },
};
function materialTypeStyle(materialType: string) {
  return MATERIAL_TYPE_STYLES[materialType] ?? { label: materialType, className: "bg-slate-100 text-slate-600" };
}

function MaterialTypeBadge({ materialType, large }: { materialType: string; large?: boolean }) {
  const style = materialTypeStyle(materialType);
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${style.className} ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[10px]"}`}
    >
      {style.label}
    </span>
  );
}

// ── Detail modal (Фикс 1 — "в модалке при открытии материала — большая
// надпись material_type под title/рядом с автором"), 1:1 по структуре с
// TeacherBookDetailModal (apps/web/app/teacher/books/TeacherBooksView.tsx). ──
function LibraryMaterialDetailModal({
  material,
  onClose,
  onOpen,
  opening,
}: {
  material: LibraryMaterialWithDetails;
  onClose: () => void;
  onOpen: () => void;
  opening: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const style = material.subject_slug ? getSubjectStyle(material.subject_slug) : null;
  const isVideo = material.content_type !== "file";

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/40 bg-white p-8 shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 pr-8 text-2xl font-bold leading-tight text-slate-900">{material.title}</h2>
        {material.author && <p className="mb-3 text-sm text-slate-500">{material.author}</p>}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {material.material_type && <MaterialTypeBadge materialType={material.material_type} large />}
          {style && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${style.color}22`, color: style.color }}>
              {style.label}
            </span>
          )}
        </div>

        {material.description && (
          <p className="mb-3 line-clamp-5 text-sm leading-relaxed text-slate-600">{material.description}</p>
        )}

        <div className="mt-4">
          <button
            onClick={onOpen}
            disabled={opening}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#185AF7] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
          >
            {opening ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {opening ? "Открываем…" : isVideo ? "Смотреть видео" : "Открыть материал"}
          </button>
        </div>
      </div>
    </div>
  );
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
  // K.1, 05.08.2026 — video_mp4-материалы (bucket lesson-videos) рендерятся
  // через VideoEmbedPlayer, не FileViewerModal (тот не умеет .mp4).
  const [videoPlayer, setVideoPlayer] = useState<{ url: string; title: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setMaterials(initialMaterials); }, [initialMaterials]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Не «куратор», а «есть ли у меня кафедра» — см. lib/curator.ts.
  const hasDepartment = canUseDepartmentLibrary(initialSubjectSlug);

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

  const selectedMaterial = selectedId ? (materials.find((m) => m.id === selectedId) ?? null) : null;

  function handleUploadSuccess() {
    setShowUpload(false);
    router.refresh();
  }
  function handleVideoSuccess() {
    setShowVideo(false);
    router.refresh();
  }

  async function handleOpen(m: LibraryMaterialWithDetails) {
    // 07.08.2026 — YouTube/RuTube показываем тем же inline-плеером, что и
    // загруженный .mp4 строкой ниже. Раньше здесь был window.open: видео
    // уходило в новую вкладку (а при включённом блокировщике всплывающих
    // окон — никуда), и это единственная вкладка «Базы знаний», где реально
    // лежат видео-ссылки. Именно так выглядело «в базе знаний видео не
    // работает». VideoEmbedPlayer уже импортирован здесь и уже умеет обе
    // площадки — своей ветки рендера не заводим.
    if (m.content_type === "video_youtube" || m.content_type === "video_rutube") {
      if (!m.external_url) { setError(dt.libraryErrUploadFailed); return; }
      setSelectedId(null);
      setVideoPlayer({ url: m.external_url, title: m.title });
      return;
    }
    if (m.content_type === "video_mp4") {
      // Миграция 175 — video_mp4 теперь бывает двух видов: загруженный файл
      // (есть storage_path, getLibraryMaterials подписал его в m.url) и
      // прямая ссылка (storage_path пуст, подписывать нечего — адрес лежит в
      // external_url). Плеер один и тот же.
      const url = m.url ?? m.external_url;
      if (!url) { setError(dt.libraryErrUploadFailed); return; }
      setSelectedId(null);
      setVideoPlayer({ url, title: m.title });
      return;
    }
    if (!m.url) { setError(dt.libraryErrUploadFailed); return; }
    setOpeningId(m.id);
    try {
      const fileName = m.storage_path?.split("/").pop() || m.title;
      setSelectedId(null);
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
      {selectedMaterial && (
        <LibraryMaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedId(null)}
          onOpen={() => handleOpen(selectedMaterial)}
          opening={openingId === selectedMaterial.id}
        />
      )}

      {viewer && (
        <FileViewerModal url={viewer.url} title={viewer.title} fileName={viewer.fileName} onClose={() => setViewer(null)} />
      )}

      {videoPlayer && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setVideoPlayer(null)}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{videoPlayer.title}</p>
              <button
                onClick={() => setVideoPlayer(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <VideoEmbedPlayer url={videoPlayer.url} />
          </div>
        </div>
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
        {hasDepartment ? (
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
              <div key={m.id} className="group relative cursor-pointer" onClick={() => setSelectedId(m.id)}>
                <div
                  className="relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl"
                  style={{ background: style ? `linear-gradient(135deg, ${style.color}, ${style.color}CC)` : "linear-gradient(135deg, #64748B, #334155)" }}
                >
                  {/* Фикс 1 — бейдж material_type в углу карточки */}
                  {m.material_type && (
                    <div className="absolute left-2 top-2 z-10">
                      <MaterialTypeBadge materialType={m.material_type} />
                    </div>
                  )}
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
                </div>
                {style && <p className="mb-0.5 text-xs uppercase tracking-wide text-slate-400">{style.label}</p>}
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">{m.title}</h3>
                {m.author && <p className="mt-0.5 text-xs text-slate-400">{m.author}</p>}
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
