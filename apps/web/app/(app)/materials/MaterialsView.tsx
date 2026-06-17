"use client";

import { useState, useMemo, useTransition } from "react";
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
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// ── Component ─────────────────────────────────────────────────────────

export function MaterialsView({ materials }: { materials: MaterialWithGroup[] }) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<DisplayType | "all">("all");
  const [pending, startTransition] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const decorated = useMemo(
    () => materials.map((m) => ({ ...m, _type: resolveType(m) })),
    [materials],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return decorated.filter((m) => {
      const matchesType = activeType === "all" || m._type === activeType;
      const matchesQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [decorated, query, activeType]);

  // "Недавно открытые" = 4 newest by created_at
  const recent = useMemo(() => decorated.slice(0, 4), [decorated]);

  function handleOpen(mat: MaterialWithGroup) {
    if (!mat.storage_path && !mat.link_url) return;
    setOpeningId(mat.id);
    startTransition(async () => {
      const url = await getMaterialUrl(mat.id);
      setOpeningId(null);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        alert("Не удалось открыть файл. Попробуйте позже.");
      }
    });
  }

  return (
    <div className="text-slate-800">
      {/* Header */}
      <header className="mb-6 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Материалы</h1>
        <div className="relative w-full max-w-xs sm:w-80">
          <input
            type="text"
            placeholder="Поиск материалов…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-white/60 py-3 pl-12 pr-4 text-sm text-slate-700 shadow-sm backdrop-blur-xl transition-all placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          />
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        </div>
      </header>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
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
              const canOpen = !!(mat.storage_path || mat.link_url);
              const isOpening = openingId === mat.id && pending;
              return (
                <button
                  key={`recent-${mat.id}`}
                  onClick={() => handleOpen(mat)}
                  disabled={!canOpen || isOpening}
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
            const canOpen = !!(mat.storage_path || mat.link_url);
            const isOpening = openingId === mat.id && pending;
            return (
              <button
                key={mat.id}
                onClick={() => handleOpen(mat)}
                disabled={!canOpen || isOpening}
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
