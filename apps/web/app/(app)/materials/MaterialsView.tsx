"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search, FileText, BookOpen, Link as LinkIcon,
  Video, FileImage, File, FolderOpen,
} from "lucide-react";
import type { MaterialWithGroup } from "@snr/core";
import { getMaterialUrl } from "@/app/actions/materials";

// ── File type helpers ─────────────────────────────────────────────────

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

const TYPE_LABEL: Record<DisplayType, string> = {
  pdf: "PDF", video: "Видео", presentation: "Презентация",
  book: "Книга", link: "Ссылка", image: "Изображение", file: "Файл",
};

const FILTER_TABS: { key: DisplayType | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "presentation", label: "Презентации" },
  { key: "video", label: "Видео" },
  { key: "pdf", label: "PDF" },
  { key: "book", label: "Книги" },
  { key: "link", label: "Ссылки" },
];

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

// ── Component ─────────────────────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  robotics: "Робототехника", math: "Математика", english: "Английский",
  informatics: "Информатика", chemistry: "Химия", programming: "Программирование",
  physics: "Физика", biology: "Биология", history: "История",
};

export function MaterialsView({ materials }: { materials: MaterialWithGroup[] }) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<DisplayType | "all">("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const decorated = useMemo(
    () => materials.map((m) => ({ ...m, _type: resolveType(m) })),
    [materials],
  );

  const subjects = useMemo(() => {
    const set = new Set(decorated.map((m) => m.group.subject).filter(Boolean));
    return Array.from(set) as string[];
  }, [decorated]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return decorated.filter((m) => {
      const matchesType = activeType === "all" || m._type === activeType;
      const matchesSubject = filterSubject === "all" || m.group.subject === filterSubject;
      const matchesQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q);
      return matchesType && matchesSubject && matchesQuery;
    });
  }, [decorated, query, activeType, filterSubject]);

  // "Недавно открытые" = 4 newest by created_at
  const recent = useMemo(() => decorated.slice(0, 4), [decorated]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleOpen(mat: MaterialWithGroup) {
    console.log("[materials] click:", { id: mat.id, storage_path: mat.storage_path, link_url: mat.link_url });
    if (!mat.storage_path && !mat.link_url) {
      showToast("У этого материала нет файла");
      return;
    }
    setOpeningId(mat.id);
    try {
      console.log("[materials] calling getMaterialUrl for", mat.id);
      const url = await getMaterialUrl(mat.id);
      console.log("[materials] signed url result:", url);
      if (!url) {
        showToast("Не удалось открыть файл");
        return;
      }
      // Trigger a download via a programmatic <a download> click — avoids
      // popup blocker and forces save instead of inline PDF render. The
      // signed URL already carries Content-Disposition: attachment with
      // the filename (see getMaterialDownloadUrl).
      const filename = mat.storage_path?.split("/").pop() || mat.title || "material";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[materials] getMaterialUrl threw:", err);
      showToast("Ошибка при скачивании файла");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="text-slate-800">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
      {/* Header */}
      <header className="mb-6 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Учебные материалы</h1>
        <div className="relative w-full max-w-xs sm:w-80">
          <input
            type="text"
            placeholder="Поиск материалов…"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-white/60 py-3 pl-12 pr-4 text-sm text-slate-700 shadow-sm backdrop-blur-xl transition-all placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          />
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        </div>
      </header>

      {/* Filters row */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {/* Subject dropdown */}
        {subjects.length > 1 && (
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-md focus:outline-none"
          >
            <option value="all">Все предметы</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{SUBJECT_LABELS[s] ?? s}</option>
            ))}
          </select>
        )}
        {/* Type tabs */}
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveType(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeType === key
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "border border-white/40 bg-white/70 text-slate-700 backdrop-blur-md hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recently opened */}
      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 px-1 text-lg font-bold text-slate-800">Недавно открытые</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((mat) => {
              const Icon = TYPE_ICON[mat._type];
              const isOpening = openingId === mat.id;
              return (
                <button
                  key={`recent-${mat.id}`}
                  onClick={() => handleOpen(mat)}
                  disabled={isOpening}
                  className="flex w-full cursor-pointer items-center space-x-3 rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-md disabled:cursor-default disabled:opacity-60 text-left"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xs ${TYPE_COLORS[mat._type]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{mat.title}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(mat.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Main grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <FolderOpen className="h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-500">
            {materials.length === 0 ? "Материалов пока нет" : "Ничего не найдено"}
          </p>
          <p className="text-sm text-slate-400">
            {materials.length === 0
              ? "Преподаватель ещё не добавил материалы для вашей группы"
              : "Попробуйте изменить фильтр или запрос"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((mat) => {
            const Icon = TYPE_ICON[mat._type];
            const isOpening = openingId === mat.id;
            return (
              <button
                key={mat.id}
                onClick={() => handleOpen(mat)}
                disabled={isOpening}
                className="group relative flex h-[180px] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-lg disabled:cursor-default disabled:opacity-60 text-left w-full"
              >
                <div className="z-10 mb-2 flex w-full flex-1 flex-col items-center justify-center">
                  <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${TYPE_COLORS[mat._type]}`}>
                    {isOpening ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Icon className="h-10 w-10" />
                    )}
                  </div>
                  <p className="line-clamp-2 w-full px-2 text-center text-sm font-bold leading-tight text-slate-800">
                    {mat.title}
                  </p>
                </div>
                <div className="z-10 mt-auto flex w-full items-end justify-between">
                  <div className="mr-2 truncate text-[10px] text-slate-400">
                    {mat.group.subject} · {TYPE_LABEL[mat._type]}
                    {mat.file_size_bytes ? ` · ${formatSize(mat.file_size_bytes)}` : ""}
                  </div>
                  <div className="whitespace-nowrap text-[10px] text-slate-400">
                    {formatDate(mat.created_at)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
