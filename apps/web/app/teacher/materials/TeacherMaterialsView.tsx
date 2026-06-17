"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import {
  FolderOpen, Plus, FileText, Video, FileImage, File, BookOpen,
  Link as LinkIcon, MoreHorizontal, Download, Trash2, X, Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMaterialDownloadUrl, insertMaterial, deleteMaterial } from "@snr/core";
import type { MaterialWithGroup } from "@snr/core";
import { useRouter } from "next/navigation";

// ── File type helpers (same as student view) ──────────────────────────

type DisplayType = "pdf" | "video" | "presentation" | "book" | "link" | "image" | "file";

function resolveType(mat: MaterialWithGroup): DisplayType {
  const m = mat.file_type ?? "";
  const t = mat.type ?? "";
  if (m === "application/pdf" || t === "pdf") return "pdf";
  if (m.startsWith("video/") || t === "video") return "video";
  if (m.includes("presentation") || t === "presentation") return "presentation";
  if (t === "book") return "book";
  if (mat.link_url && !mat.storage_path) return "link";
  if (m.startsWith("image/") || t === "image") return "image";
  return "file";
}

const TYPE_ICON: Record<DisplayType, typeof FileText> = {
  pdf: FileText, video: Video, presentation: FileImage,
  book: BookOpen, link: LinkIcon, image: FileImage, file: File,
};

const TYPE_COLORS: Record<DisplayType, string> = {
  pdf:          "text-red-500 bg-red-100/60",
  video:        "text-purple-500 bg-purple-100/60",
  presentation: "text-orange-500 bg-orange-100/60",
  book:         "text-blue-500 bg-blue-100/60",
  link:         "text-gray-500 bg-gray-100/60",
  image:        "text-emerald-500 bg-emerald-100/60",
  file:         "text-slate-500 bg-slate-100/60",
};

function mimeToType(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("presentation")) return "presentation";
  if (mime.startsWith("image/")) return "image";
  return "file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  // timeZone: "UTC" ensures server and browser produce identical output,
  // preventing React hydration mismatch #418.
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

// ── Type for teacher group (matches getTeacherGroups shape) ──────────

type TeacherGroup = {
  id: string;
  name: string;
  subject: string;
  teacher_id: string | null;
};

// ── Toast ─────────────────────────────────────────────────────────────

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

// ── Upload modal ──────────────────────────────────────────────────────

function UploadModal({
  groups,
  teacherId,
  onClose,
  onSuccess,
}: {
  groups: TeacherGroup[];
  teacherId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selectedGroup = groups.find((g) => g.id === groupId);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Введите название"); return; }
    if (!groupId) { setError("Выберите группу"); return; }
    if (!file) { setError("Прикрепите файл"); return; }
    if (file.size > 52428800) { setError("Файл слишком большой (макс 50 МБ)"); return; }
    // Guard against the bug where empty teacherId/groupId would let the file
    // land at the bucket root instead of the planned folder structure.
    if (!teacherId) { setError("Не удалось определить учителя — обновите страницу"); return; }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const sb = createClient();
      const materialId = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "bin";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Single source of truth: same path goes to storage.upload AND DB insert.
      const storagePath = `${teacherId}/${groupId}/${materialId}/${safeName}`;

      // Hard invariant: every segment must be non-empty, otherwise the path
      // collapses and the file ends up at the bucket root (real bug we saw).
      const segments = storagePath.split("/");
      if (segments.some((s) => !s)) {
        throw new Error(`Invalid storage path "${storagePath}" — empty segment`);
      }
      console.log("[materials] uploading to", storagePath);

      const ramp = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 300);

      const { error: uploadErr } = await sb.storage
        .from("materials")
        .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

      clearInterval(ramp);

      if (uploadErr) {
        console.error("[materials] storage upload failed:", uploadErr);
        throw uploadErr;
      }
      setProgress(95);

      await insertMaterial(sb, {
        group_id: groupId,
        title: title.trim(),
        description: description.trim() || null,
        subject: selectedGroup?.subject ?? "",
        lesson_id: null,
        file_type: file.type || `application/${ext}`,
        storage_path: storagePath,
        file_size_bytes: file.size,
        uploaded_by: teacherId,
        type: mimeToType(file.type),
      });

      setProgress(100);
      onSuccess();
    } catch (err) {
      console.error("[materials] upload error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/40 bg-white/90 p-8 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">Загрузить материал</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Лабораторная работа №3"
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание (необязательно)"
              rows={2}
              disabled={uploading}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Group */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Группа <span className="text-red-500">*</span>
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* File drop zone */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Файл <span className="text-red-500">*</span>
            </label>
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                file
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <Upload className="h-6 w-6 text-slate-400" />
              {file ? (
                <p className="text-sm font-semibold text-blue-700">
                  {file.name} ({formatSize(file.size)})
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Перетащите файл или <span className="text-blue-600 underline">выберите</span>
                  </p>
                  <p className="text-xs text-slate-400">PDF, DOCX, PPTX, XLSX, JPG, PNG, MP4 — макс. 50 МБ</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                <span>Загружаем…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
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
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim() || !groupId || !file}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Загружаем…" : "Загрузить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────

export function TeacherMaterialsView({
  materials: initialMaterials,
  groups,
  initialTeacherId,
}: {
  materials: MaterialWithGroup[];
  groups: TeacherGroup[];
  initialTeacherId: string;
}) {
  const router = useRouter();
  const [materials, setMaterials] = useState(initialMaterials);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  // teacherId comes from the RSC — no client-side fetch needed.
  const teacherId = initialTeacherId;

  const subjects = useMemo(() => {
    const set = new Set(materials.map((m) => m.subject ?? m.group.subject).filter(Boolean));
    return Array.from(set) as string[];
  }, [materials]);

  const filtered = useMemo(
    () =>
      materials.filter((m) => {
        const matchSubject =
          filterSubject === "all" || (m.subject ?? m.group.subject) === filterSubject;
        const matchGroup = filterGroup === "all" || m.group_id === filterGroup;
        return matchSubject && matchGroup;
      }),
    [materials, filterSubject, filterGroup],
  );

  function handleUploadSuccess() {
    setShowUpload(false);
    setToast("Материал загружен, ученики уже видят его в /materials");
    router.refresh();
    startTransition(() => {
      // Optimistic: refetch via router.refresh triggers RSC re-render
    });
  }

  async function handleDownload(mat: MaterialWithGroup) {
    setMenuOpenId(null);
    if (!mat.storage_path && !mat.link_url) return;
    const sb = createClient();
    try {
      const url = mat.link_url ?? await getMaterialDownloadUrl(sb, mat.storage_path!);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setToast("Не удалось скачать файл");
    }
  }

  async function handleDelete(mat: MaterialWithGroup) {
    setMenuOpenId(null);
    if (!confirm("Удалить материал? Это действие нельзя отменить.")) return;
    setDeleting(mat.id);
    const sb = createClient();
    try {
      await deleteMaterial(sb, mat.id, mat.storage_path);
      setMaterials((prev) => prev.filter((m) => m.id !== mat.id));
      setToast("Материал удалён");
    } catch {
      setToast("Не удалось удалить материал");
    } finally {
      setDeleting(null);
    }
  }

  const subjectLabel: Record<string, string> = {
    robotics: "Робототехника", math: "Математика", english: "Английский",
    informatics: "Информатика", chemistry: "Химия", programming: "Программирование",
  };

  return (
    <>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {showUpload && teacherId && (
        <UploadModal
          groups={groups}
          teacherId={teacherId}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      <div className="text-slate-800">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[22px] font-bold text-gray-900 md:text-[26px]">Мои материалы</h1>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#185AF7] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Загрузить материал
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
          >
            <option value="all">Все предметы</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{subjectLabel[s] ?? s}</option>
            ))}
          </select>
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
          >
            <option value="all">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
            <FolderOpen className="h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">
              {materials.length === 0 ? "Материалов пока нет" : "Ничего не найдено"}
            </p>
            {materials.length === 0 && (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
              >
                + Загрузить первый материал
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((mat) => {
              const dtype = resolveType(mat);
              const Icon = TYPE_ICON[dtype];
              const isDeleting = deleting === mat.id;
              return (
                <div
                  key={mat.id}
                  className="group relative flex h-[190px] flex-col overflow-hidden rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-lg"
                >
                  {/* ••• menu */}
                  <div className="absolute right-3 top-3 z-10">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === mat.id ? null : mat.id)}
                      className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpenId === mat.id && (
                      <div className="absolute right-0 top-8 z-20 min-w-[140px] overflow-hidden rounded-xl border border-white/60 bg-white shadow-xl">
                        {(mat.storage_path || mat.link_url) && (
                          <button
                            onClick={() => handleDownload(mat)}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                            Скачать
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(mat)}
                          disabled={isDeleting}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? "Удаляем…" : "Удалить"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="z-10 flex flex-1 flex-col items-center justify-center">
                    <div className={`mb-2 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${TYPE_COLORS[dtype]}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <p className="line-clamp-2 px-2 text-center text-sm font-bold leading-tight text-slate-800">
                      {mat.title}
                    </p>
                  </div>

                  <div className="z-10 mt-auto flex items-end justify-between pt-2">
                    <span className="mr-2 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {mat.group.name}
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">
                      {formatDate(mat.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Close menu on outside click */}
      {menuOpenId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpenId(null)}
        />
      )}
    </>
  );
}
