"use client";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.3 — модалка выбора файла в стиле проводника:
// сетка иконок, мультивыбор кликом, две вкладки (Библиотека / Материалы
// группы), поиск по названию. Возвращает выбранные файлы БЕЗ их загрузки —
// вызывающая сторона линкует существующий storage_path (Этап 3.4: без
// дублирования).

import { useEffect, useMemo, useState } from "react";
import { X, Search, FileText, FileImage, Video, File as FileIcon, Link as LinkIcon, BookOpen } from "lucide-react";
import type { MaterialWithGroup, Book } from "@snr/core";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components";
import { createClient } from "@/lib/supabase/client";

export type PickedKnowledgeBaseFile = {
  source: "material" | "book";
  id: string;
  title: string;
  storagePath: string;
  fileType: string | null;
  sizeBytes: number | null;
};

type Tab = "library" | "materials";

function iconFor(fileType: string | null, hasLink: boolean) {
  if (hasLink) return LinkIcon;
  const t = fileType ?? "";
  if (t === "application/pdf") return FileText;
  if (t.startsWith("video/")) return Video;
  if (t.startsWith("image/")) return FileImage;
  if (t.includes("presentation") || t.includes("powerpoint")) return FileImage;
  return FileIcon;
}

export function KnowledgeBaseFilePicker({
  open,
  onClose,
  onSelect,
  groupIds,
  multiSelect = true,
  acceptedTypes,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: PickedKnowledgeBaseFile[]) => void;
  /** Group(s) whose "Материалы группы" should be shown — student/teacher's accessible groups. */
  groupIds: string[];
  multiSelect?: boolean;
  /** When set, both tabs only show items whose fileType matches (e.g.
   *  ["application/pdf"] for lesson-materials, which now accepts PDF only).
   *  Omit to show everything — the homework-attachment picker relies on
   *  this default to keep accepting all file types. */
  acceptedTypes?: string[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).knowledgeBase;
  const [tab, setTab] = useState<Tab>("library");
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState<MaterialWithGroup[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, PickedKnowledgeBaseFile>>(new Map());

  // groupIds приходит как новый массив-литерал на каждый рендер родителя
  // (см. TeacherLessonDetailView.tsx/CreateHomeworkForm.tsx) — использовать
  // сам массив как dependency сбрасывал бы query/selected и перезапускал
  // fetch при КАЖДОМ ре-рендере родителя, пока модалка открыта (например,
  // от таймеров/realtime в уроке), стирая то, что учитель уже начал искать.
  // groupIdsKey — стабильная строка, меняется только когда реально
  // меняется состав групп.
  const groupIdsKey = groupIds.join(",");

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuery("");
    let cancelled = false;
    setLoading(true);
    const sb = createClient();
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("course_materials").select("*, group:groups(name, subject)").in("group_id", groupIds.length ? groupIds : ["__none__"]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("books").select("*"),
    ]).then(([m, b]) => {
      if (cancelled) return;
      setMaterials((m.data ?? []) as MaterialWithGroup[]);
      setBooks((b.data ?? []) as Book[]);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      console.error("[KnowledgeBaseFilePicker] failed to load materials/books:", err);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupIdsKey]);

  const filteredMaterials = useMemo(
    () => materials.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())),
    [materials, query],
  );
  const filteredBooks = useMemo(
    () => books.filter((b) => b.title.toLowerCase().includes(query.toLowerCase())),
    [books, query],
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

  const allItems: { key: string; title: string; picked: PickedKnowledgeBaseFile; hasLink: boolean }[] =
    tab === "library"
      ? filteredBooks.map((b) => ({
          key: `book:${b.id}`,
          title: b.title,
          hasLink: false,
          picked: { source: "book", id: b.id, title: b.title, storagePath: b.file_storage_path, fileType: "application/pdf", sizeBytes: b.file_size_bytes },
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
  const items = acceptedTypes
    ? allItems.filter((it) => it.picked.fileType && acceptedTypes.includes(it.picked.fileType))
    : allItems;

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

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-100 px-6 pt-3">
          <button
            onClick={() => setTab("library")}
            className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${tab === "library" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            {d.tabLibrary}
          </button>
          <button
            onClick={() => setTab("materials")}
            className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${tab === "materials" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            {d.tabGroupMaterials}
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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">…</div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">{d.noResults}</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {items.map((it) => {
                const key = `${it.picked.source}:${it.picked.id}`;
                const isSelected = selected.has(key);
                const Icon = tab === "library" ? BookOpen : iconFor(it.picked.fileType, it.hasLink);
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => toggle(it.picked)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition ${
                      isSelected ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isSelected ? "bg-blue-100" : "bg-slate-100"}`}>
                      <Icon className={`h-6 w-6 ${isSelected ? "text-blue-600" : "text-slate-500"}`} />
                    </div>
                    <p className="line-clamp-2 w-full break-words text-[11px] font-semibold leading-tight text-slate-700">{it.title}</p>
                  </button>
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
    </div>
  );
}
