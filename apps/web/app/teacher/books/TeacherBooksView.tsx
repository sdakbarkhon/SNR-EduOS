"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen, Plus, MoreHorizontal, Trash2, X, Upload, Check, Library, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { insertBook, getSubjectStyle } from "@snr/core";
import type { Book } from "@snr/core";
import { getBookFileUrl, deleteBook as deleteBookAction } from "@/app/actions/books";
import { useRouter } from "next/navigation";
import { FileViewerModal } from "@/components/FileViewerModal";

// ── Helpers ───────────────────────────────────────────────────────────

const SUBJECT_GRADIENTS: Record<string, [string, string]> = {
  math:        ["#F5A623", "#E07C00"],
  physics:     ["#39B6F5", "#1485C6"],
  programming: ["#0EA5E9", "#0369A1"],
  robotics:    ["#2D5BFF", "#1E3A8A"],
  english:     ["#F0556B", "#B91C4A"],
  informatics: ["#7A4DFF", "#5B21B6"],
  chemistry:   ["#9B5DE5", "#6D28D9"],
  biology:     ["#2DBE7E", "#15803D"],
  history:     ["#B5793A", "#78350F"],
};

const SUBJECT_LABELS: Record<string, string> = {
  math:        "Математика",
  physics:     "Физика",
  programming: "Программирование",
  robotics:    "Робототехника",
  english:     "Английский",
  informatics: "Информатика",
  chemistry:   "Химия",
  biology:     "Биология",
  history:     "История",
};

function getBookGradient(subject: string): string {
  const [from, to] = SUBJECT_GRADIENTS[subject] ?? ["#64748B", "#334155"];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

function getOpenText(bookType: string): string {
  switch (bookType) {
    case "Учебник":    return "Читать учебник";
    case "Конспект":   return "Читать конспект";
    case "Сборник":    return "Читать сборник";
    case "Справочник": return "Читать справочник";
    default:           return "Читать";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const BOOK_TYPES = ["Учебник", "Конспект", "Сборник", "Справочник"] as const;
const SUBJECTS = [
  { value: "math",        label: "Математика" },
  { value: "physics",     label: "Физика" },
  { value: "programming", label: "Программирование" },
  { value: "robotics",    label: "Робототехника" },
  { value: "english",     label: "Английский" },
  { value: "informatics", label: "Информатика" },
  { value: "chemistry",   label: "Химия" },
  { value: "biology",     label: "Биология" },
  { value: "history",     label: "История" },
] as const;

// ── TeacherBookDetailModal ────────────────────────────────────────────

function TeacherBookDetailModal({
  book,
  coverUrl,
  onClose,
  onOpen,
  opening,
}: {
  book: Book;
  coverUrl?: string | null;
  onClose: () => void;
  onOpen: () => void;
  opening: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const style = getSubjectStyle(book.subject);

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
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex gap-8 p-8">
          {/* Left: cover (portrait 3:4) */}
          <div className="w-[38%] shrink-0">
            <div
              className="relative aspect-[3/4] w-full overflow-hidden rounded-xl shadow-md"
              style={{ background: getBookGradient(book.subject) }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl">{style.emoji}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: info */}
          <div className="flex flex-1 flex-col">
            <h2 className="mb-1 text-2xl font-bold leading-tight text-slate-900">{book.title}</h2>
            {book.author && (
              <p className="mb-3 text-sm text-slate-500">{book.author}</p>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: style.color + "22", color: style.color }}
              >
                {style.emoji} {SUBJECT_LABELS[book.subject] ?? book.subject}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {book.book_type}
              </span>
            </div>

            {book.description && (
              <p className="mb-3 line-clamp-5 text-sm leading-relaxed text-slate-600">
                {book.description}
              </p>
            )}

            <div className="mt-auto pt-4">
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
                {opening ? "Открываем…" : getOpenText(book.book_type)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

// ── Success Modal ─────────────────────────────────────────────────────

function SuccessModal({
  title,
  onClose,
  onUploadMore,
}: {
  title: string;
  onClose: () => void;
  onUploadMore: () => void;
}) {
  const [visible, setVisible] = useState(false);

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
        className={`w-full max-w-[400px] rounded-2xl border border-white/40 bg-white p-8 shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <div className="mb-5 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <Check className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">Книга добавлена!</h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          <span className="font-medium text-slate-700">{title}</span> уже видна ученикам в библиотеке.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onUploadMore}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Добавить ещё
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────

function UploadModal({
  teacherId,
  onClose,
  onSuccess,
}: {
  teacherId: string;
  onClose: () => void;
  onSuccess: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0].value);
  const [bookType, setBookType] = useState<typeof BOOK_TYPES[number]>("Учебник");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Введите название"); return; }
    if (!pdfFile) { setError("Прикрепите PDF-файл"); return; }
    if (pdfFile.size > 52428800) { setError("Файл слишком большой (макс 50 МБ)"); return; }
    if (!teacherId) { setError("Не удалось определить учителя — обновите страницу"); return; }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const sb = createClient();
      const bookId = crypto.randomUUID();
      const safePdfName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pdfPath = `${teacherId}/${bookId}/${safePdfName}`;

      const ramp = setInterval(() => setProgress((p) => Math.min(p + 4, 80)), 300);

      // Upload PDF
      const { error: pdfErr } = await sb.storage
        .from("books")
        .upload(pdfPath, pdfFile, { contentType: "application/pdf", upsert: false });
      if (pdfErr) throw pdfErr;

      setProgress(82);

      // Upload cover (optional)
      let coverPath: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() ?? "jpg";
        coverPath = `${teacherId}/${bookId}/cover.${ext}`;
        const { error: covErr } = await sb.storage
          .from("books")
          .upload(coverPath, coverFile, { contentType: coverFile.type, upsert: false });
        if (covErr) console.error("[books] cover upload failed:", covErr);
      }

      setProgress(90);

      clearInterval(ramp);

      await insertBook(sb, {
        title: title.trim(),
        author: author.trim() || null,
        subject,
        book_type: bookType,
        description: description.trim() || null,
        cover_storage_path: coverPath,
        file_storage_path: pdfPath,
        file_size_bytes: pdfFile.size,
        uploaded_by: teacherId,
      });

      setProgress(100);
      onSuccess(title.trim());
    } catch (err) {
      console.error("[books] upload error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white/90 p-8 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-900">Добавить книгу</h2>

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
              placeholder="Например: Алгебра 7 класс"
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Author */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Автор</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="И.Ф. Фамилия"
              disabled={uploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {/* Subject + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Предмет</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                {SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Тип</label>
              <select
                value={bookType}
                onChange={(e) => setBookType(e.target.value as typeof BOOK_TYPES[number])}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                {BOOK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
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

          {/* PDF file */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              PDF-файл <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => !uploading && pdfRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                pdfFile ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <Upload className="h-5 w-5 text-slate-400" />
              {pdfFile ? (
                <p className="text-sm font-semibold text-blue-700">
                  {pdfFile.name} ({formatSize(pdfFile.size)})
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Перетащите PDF или <span className="text-blue-600 underline">выберите</span>
                  </p>
                  <p className="text-xs text-slate-400">Только PDF — макс. 50 МБ</p>
                </>
              )}
            </div>
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Cover (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Обложка{" "}
              <span className="font-normal text-slate-400">— необязательно, создаётся автоматически</span>
            </label>
            <div
              onClick={() => !uploading && coverRef.current?.click()}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              {coverFile ? (
                <span className="text-blue-700 font-medium">{coverFile.name}</span>
              ) : (
                <span className="text-slate-500">Выбрать изображение (JPG, PNG, WebP)</span>
              )}
            </div>
            <input
              ref={coverRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
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
              disabled={uploading || !title.trim() || !pdfFile}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Загружаем…" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────

export function TeacherBooksView({
  initialBooks,
  initialTeacherId,
  coverUrls,
  hideHeading,
}: {
  initialBooks: Book[];
  initialTeacherId: string;
  coverUrls: Record<string, string>;
  hideHeading?: boolean;
}) {
  const router = useRouter();
  const [books, setBooks] = useState(initialBooks);
  const [showUpload, setShowUpload] = useState(false);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [viewerBook, setViewerBook] = useState<{ url: string; title: string; fileName: string } | null>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");

  useEffect(() => { setBooks(initialBooks); }, [initialBooks]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Outside-click handler for ••• dropdowns (same pattern as TeacherMaterialsView)
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

  function handleUploadSuccess(title: string) {
    setShowUpload(false);
    setSuccessTitle(title);
    router.refresh();
  }

  async function handleOpen(bookId: string) {
    setOpeningId(bookId);
    try {
      const book = books.find((b) => b.id === bookId);
      if (!book) return;
      const url = await getBookFileUrl(bookId);
      if (!url) { setToast("Не удалось получить ссылку"); return; }
      const fileName = book.file_storage_path.split("/").pop() || "book.pdf";
      setSelectedBookId(null);
      setViewerBook({ url, title: book.title, fileName });
    } catch {
      setToast("Не удалось открыть файл");
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(book: Book) {
    setMenuOpenId(null);
    setDeleting(book.id);
    try {
      const result = await deleteBookAction(book.id);
      if (result.error) { setToast("Не удалось удалить книгу"); return; }
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      setToast("Книга удалена");
      router.refresh();
    } catch {
      setToast("Не удалось удалить книгу");
    } finally {
      setDeleting(null);
    }
  }

  const subjects = useMemo(() => {
    const set = new Set(books.map((b) => b.subject).filter(Boolean));
    return Array.from(set) as string[];
  }, [books]);

  const displayed = useMemo(() => {
    const q = query.toLowerCase();
    return books.filter((b) => {
      const matchSubject = filterSubject === "all" || b.subject === filterSubject;
      const matchQuery =
        !q ||
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q);
      return matchSubject && matchQuery;
    });
  }, [books, query, filterSubject]);

  const selectedBook = selectedBookId
    ? (books.find((b) => b.id === selectedBookId) ?? null)
    : null;

  return (
    <>
      {selectedBook && (
        <TeacherBookDetailModal
          book={selectedBook}
          coverUrl={coverUrls[selectedBook.id]}
          onClose={() => setSelectedBookId(null)}
          onOpen={() => handleOpen(selectedBook.id)}
          opening={openingId === selectedBook.id}
        />
      )}

      {viewerBook && (
        <FileViewerModal
          url={viewerBook.url}
          title={viewerBook.title}
          fileName={viewerBook.fileName}
          onClose={() => setViewerBook(null)}
        />
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {successTitle && (
        <SuccessModal
          title={successTitle}
          onClose={() => setSuccessTitle(null)}
          onUploadMore={() => { setSuccessTitle(null); setShowUpload(true); }}
        />
      )}

      {showUpload && (
        <UploadModal
          teacherId={initialTeacherId}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      <div className="text-slate-800">
        {/* Header — omitted when hosted under the Knowledge Base tab
            switcher (БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.2). */}
        <div className="mb-6 flex items-center justify-between">
          {!hideHeading && <h1 className="text-[22px] font-bold text-gray-900 md:text-[26px]">Библиотека</h1>}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#185AF7] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Добавить книгу
          </button>
        </div>

        {/* Search + filter */}
        {books.length > 0 && (
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
          </div>
        )}

        {/* Grid */}
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
            <Library className="h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">Книг пока нет</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
            >
              + Добавить первую книгу
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
            <BookOpen className="h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">Ничего не найдено</p>
            <p className="text-sm text-slate-400">Попробуйте изменить запрос или фильтр</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayed.map((book) => {
              const style = getSubjectStyle(book.subject);
              const isOwn = book.uploaded_by === initialTeacherId;
              const isDeleting = deleting === book.id;
              const coverUrl = coverUrls[book.id];

              return (
                <div
                  key={book.id}
                  className="group relative cursor-pointer"
                  onClick={() => setSelectedBookId(book.id)}
                >
                  {/* Cover */}
                  <div
                    className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${(SUBJECT_GRADIENTS[book.subject] ?? ["#64748B","#334155"])[0]}, ${(SUBJECT_GRADIENTS[book.subject] ?? ["#64748B","#334155"])[1]})` }}
                  >
                    {/* Cover image */}
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt={book.title}
                        className="absolute inset-0 z-0 h-full w-full object-cover"
                      />
                    )}

                    <div
                      className="pointer-events-none absolute inset-0 z-[1]"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)" }}
                    />

                    {/* ••• menu — own books only (stopPropagation prevents modal open) */}
                    {isOwn && (
                      <div className="absolute right-2 top-2 z-20" data-menu-id={book.id}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === book.id ? null : book.id); }}
                          className="rounded-lg border border-white/20 bg-white/70 p-1.5 backdrop-blur-xl transition-colors hover:bg-white/90"
                        >
                          <MoreHorizontal className="h-4 w-4 text-slate-600" />
                        </button>
                        {menuOpenId === book.id && (
                          <div className="absolute right-0 top-9 min-w-[140px] overflow-hidden rounded-xl border border-white/60 bg-white shadow-xl">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(book); }}
                              disabled={isDeleting}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              {isDeleting ? "Удаляем…" : "Удалить"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Emoji auto-cover */}
                    {!coverUrl && (
                      <span className="absolute inset-0 z-[2] flex items-center justify-center text-5xl transition-transform duration-300 group-hover:scale-110">
                        {style.emoji}
                      </span>
                    )}
                  </div>

                  <p className="mb-0.5 text-xs uppercase tracking-wide text-slate-400">{book.book_type}</p>
                  <h3 className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">{book.title}</h3>
                  {book.author && <p className="mt-0.5 text-xs text-slate-400">{book.author}</p>}
                  {!isOwn && (
                    <p className="mt-0.5 text-[10px] text-slate-300">Другой учитель</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
