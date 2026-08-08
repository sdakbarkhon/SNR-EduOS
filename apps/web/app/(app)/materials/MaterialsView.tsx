"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search, FileText, BookOpen, Link as LinkIcon,
  Video, FileImage, File, FolderOpen, X, CalendarDays, ChevronDown,
} from "lucide-react";
import type { MaterialWithGroup, LessonSlide } from "@snr/core";
import { buildFilterOptions, matchesFilters, groupByDay } from "@/lib/material-filters";
import {
  filterSelectClass, withCount, FILTER_ICON, FILTER_CHEVRON, FILTER_RESET,
} from "@/components/material-filter-styles";
import { getMaterialUrl, getMaterialSlides } from "@/app/actions/materials";
import { FileViewerModal } from "@/components/FileViewerModal";
import { SlidesViewerModal } from "@/components/SlidesViewerModal";
import { VideoEmbedPlayer } from "@/components/video/VideoEmbedPlayer";
import { isVideoUrl } from "@/lib/video-url";

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

export function MaterialsView({ materials, hideHeading }: { materials: MaterialWithGroup[]; hideHeading?: boolean }) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<DisplayType | "all">("all");
  const [filterSubject, setFilterSubject] = useState("all");
  // 07.08.2026 — фильтры по дате урока и по уроку. Правила общие с
  // учительским экраном (lib/material-filters.ts), UI у каждого свой.
  const [filterDate, setFilterDate] = useState("all");
  const [filterLesson, setFilterLesson] = useState("all");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string; fileName: string } | null>(null);
  const [slideViewer, setSlideViewer] = useState<{ slides: LessonSlide[]; title: string } | null>(null);
  // K.3 — video-ссылки (link_url, YouTube/RuTube/.mp4) раньше открывались
  // window.open вместо inline-плеера. Отдельное состояние вместо `viewer`
  // (тот заточен под FileViewerModal — pdf/image/office/text, не видео).
  const [videoPlayer, setVideoPlayer] = useState<{ url: string; title: string } | null>(null);
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
    // 07.08.2026: источник — предмет САМОЙ записи, а не единое поле группы.
    const set = new Set(decorated.map((m) => m.subject).filter(Boolean));
    return Array.from(set) as string[];
  }, [decorated]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return decorated.filter((m) => {
      const matchesType = activeType === "all" || m._type === activeType;
      // 07.08.2026: было `m.group.subject` — устаревшее единое поле ГРУППЫ
      // (groups.subject одинаков у всех трёх групп), из-за чего сужение по
      // предмету не работало. У самой записи предмет заполнен всегда.
      const matchesRest = matchesFilters(m, { date: filterDate, lesson: filterLesson, subject: filterSubject });
      const matchesQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q);
      return matchesType && matchesRest && matchesQuery;
    });
  }, [decorated, query, activeType, filterSubject, filterDate, filterLesson]);

  const filterOptions = useMemo(
    () => buildFilterOptions(decorated, filterDate),
    [decorated, filterDate],
  );

  // "Недавно открытые" = 4 newest by created_at
  const recent = useMemo(() => decorated.slice(0, 4), [decorated]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleOpen(mat: MaterialWithGroup) {
    // AI-сгенерированные презентации не имеют ни storage_path, ни link_url —
    // их контент живёт в lesson_stages.slides (course_materials.stage_id,
    // миграция 119), а не в Storage. Открываем тем же SlideViewer, что и урок,
    // вместо попытки построить несуществующий файловый URL.
    if (resolveType(mat) === "presentation" && !mat.storage_path && !mat.link_url) {
      setOpeningId(mat.id);
      try {
        const slides = await getMaterialSlides(mat.id);
        if (slides && slides.length > 0) {
          setSlideViewer({ slides, title: mat.title });
        } else {
          showToast("Не удалось загрузить презентацию");
        }
      } catch (err) {
        console.error("[materials] getMaterialSlides threw:", err);
        showToast("Не удалось загрузить презентацию");
      } finally {
        setOpeningId(null);
      }
      return;
    }

    if (!mat.storage_path && !mat.link_url) {
      showToast("У этого материала нет файла");
      return;
    }
    setOpeningId(mat.id);
    try {
      const url = await getMaterialUrl(mat.id);
      if (!url) {
        showToast("Не удалось открыть файл");
        return;
      }
      if (mat.link_url && !mat.storage_path) {
        // K.3 — YouTube/RuTube/.mp4 открываем inline-плеером; прочие
        // ссылки (статьи и т.п., не видео) — как раньше, во внешней вкладке.
        if (isVideoUrl(url)) {
          setVideoPlayer({ url, title: mat.title });
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        return;
      }
      // K.1, 05.08.2026 — загруженный .mp4-файл (не ссылка) показываем тем же
      // videoPlayer-состоянием, что и видео-ссылки выше.
      //
      // 07.08.2026 — оговорка «FileViewerModal не умеет .mp4» снята: теперь
      // умеет (классифицирует через demoKind, kind='video'). Ветка ниже
      // оставлена как есть — она работает и открывает ровно тот же
      // VideoEmbedPlayer, просто без обвязки просмотрщика; менять рабочий
      // путь ради единообразия здесь незачем.
      if (mat.storage_path && resolveType(mat) === "video") {
        setVideoPlayer({ url, title: mat.title });
        return;
      }
      const fileName = mat.storage_path?.split("/").pop() || mat.title || "material";
      setViewer({ url, title: mat.title, fileName });
    } catch (err) {
      console.error("[materials] getMaterialUrl threw:", err);
      showToast("Не удалось открыть файл");
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

      {viewer && (
        <FileViewerModal
          url={viewer.url}
          title={viewer.title}
          fileName={viewer.fileName}
          onClose={() => setViewer(null)}
        />
      )}
      {slideViewer && (
        <SlidesViewerModal
          slides={slideViewer.slides}
          title={slideViewer.title}
          onClose={() => setSlideViewer(null)}
        />
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
      {/* Header — omitted when hosted under the Knowledge Base tab switcher
          (БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.2), which already shows its own title. */}
      <header className="mb-6 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!hideHeading && <h1 className="text-3xl font-bold tracking-tight text-slate-800">Учебные материалы</h1>}
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
        {/* 07.08.2026 — дата урока и урок. Даты берутся из самих материалов,
            не «все подряд»; список уроков сужается выбранной датой, иначе в
            нём была бы вся неделя (18 уроков в день). При смене даты выбор
            урока сбрасывается — иначе остался бы урок из другого дня и список
            молча опустел бы. */}
        {filterOptions.dates.length > 1 && (
          <div className="relative">
            <CalendarDays className={`${FILTER_ICON} ${filterDate !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setFilterLesson("all"); }}
              className={filterSelectClass(filterDate !== "all")}
            >
              <option value="all">Все даты</option>
              {filterOptions.dates.map((d) => (
                <option key={d.key} value={d.key}>{withCount(d.label, d.count)}</option>
              ))}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${filterDate !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        )}
        {filterOptions.lessons.length > 1 && (
          <div className="relative">
            <BookOpen className={`${FILTER_ICON} ${filterLesson !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select
              value={filterLesson}
              onChange={(e) => setFilterLesson(e.target.value)}
              className={filterSelectClass(filterLesson !== "all", "max-w-[280px]")}
            >
              <option value="all">Все уроки</option>
              {filterOptions.lessons.map((l) => (
                <option key={l.id} value={l.id}>{withCount(l.label, l.count)}</option>
              ))}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${filterLesson !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        )}
        {/* Subject dropdown */}
        {subjects.length > 1 && (
          <div className="relative">
            <FolderOpen className={`${FILTER_ICON} ${filterSubject !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className={filterSelectClass(filterSubject !== "all")}
            >
              <option value="all">Все предметы</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{SUBJECT_LABELS[s] ?? s}</option>
              ))}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${filterSubject !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
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

        {/* Сброс — появляется только когда есть что сбрасывать, иначе занимал
            бы место и мигал бы при каждом клике. Логику отбора не трогает,
            просто возвращает все четыре контрола в исходное состояние. */}
        {(filterDate !== "all" || filterLesson !== "all" || filterSubject !== "all" || activeType !== "all") && (
          <button
            onClick={() => { setFilterDate("all"); setFilterLesson("all"); setFilterSubject("all"); setActiveType("all"); }}
            className={FILTER_RESET}
          >
            <X className="h-4 w-4" />
            Сбросить
          </button>
        )}
      </div>

      {/* Recently opened */}
      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 px-1 text-lg font-bold text-slate-800">Недавно загруженные</h2>
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
        // 07.08.2026 — группировка по дате урока. groupByDay была написана и
        // типизирована ещё в 4746c93, но ни один экран её не звал: обе сетки
        // рисовали плоский список. Свежие дни сверху, внутри дня — по времени
        // урока, записи без урока уезжают в «Общие материалы» последней
        // группой. Разметка карточки не менялась ни на символ — каждая группа
        // получает ТУ ЖЕ сетку, поэтому раскладка не поехала.
        <div className="space-y-8">
          {groupByDay(filtered).map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-2.5">
                <h2 className="text-[15px] font-extrabold text-slate-700">{group.label}</h2>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur-md">
                  {group.items.length}
                </span>
                <div className="h-px flex-1 bg-slate-200/70" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.items.map((mat) => {
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
