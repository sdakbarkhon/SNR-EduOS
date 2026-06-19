"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, BookOpen, Library, X, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSubjectStyle, addBookFavorite, removeBookFavorite } from "@snr/core";
import type { Book } from "@snr/core";
import { getBookFileUrl } from "@/app/actions/books";
import { useRouter } from "next/navigation";

// ── Config ──────────────────────────────────────────────────────────────

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

function getDownloadText(bookType: string): string {
  switch (bookType) {
    case "Учебник":    return "Скачать учебник";
    case "Конспект":   return "Скачать конспект";
    case "Сборник":    return "Скачать сборник";
    case "Справочник": return "Скачать справочник";
    default:           return "Скачать";
  }
}

// ── BookDetailModal ─────────────────────────────────────────────────────

function BookDetailModal({
  book,
  coverUrl,
  isFavorite,
  isStudent,
  onClose,
  onToggleFavorite,
  onDownload,
  downloading,
}: {
  book: Book;
  coverUrl?: string | null;
  isFavorite: boolean;
  isStudent: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [optimisticFav, setOptimisticFav] = useState(isFavorite);
  const style = getSubjectStyle(book.subject);

  useEffect(() => { setOptimisticFav(isFavorite); }, [isFavorite]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleToggleFav() {
    setOptimisticFav((prev) => !prev);
    onToggleFavorite();
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* Close */}
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

            {/* Badges */}
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

            {/* Description */}
            {book.description && (
              <p className="mb-3 line-clamp-5 text-sm leading-relaxed text-slate-600">
                {book.description}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-4">
              {/* Favorite toggle — students only */}
              {isStudent && (
                <button
                  onClick={handleToggleFav}
                  className={`flex items-center gap-2 self-start rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    optimisticFav
                      ? "border-yellow-300 bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${
                      optimisticFav ? "fill-yellow-400 text-yellow-400" : "text-slate-400"
                    }`}
                  />
                  {optimisticFav ? "Убрать из избранного" : "В избранное"}
                </button>
              )}

              {/* Download button */}
              <button
                onClick={onDownload}
                disabled={downloading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#185AF7] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
              >
                {downloading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloading ? "Скачиваем…" : getDownloadText(book.book_type)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BookCard ────────────────────────────────────────────────────────────

function BookCard({
  book,
  coverUrl,
  isFavorite,
  onSelect,
}: {
  book: Book;
  coverUrl?: string | null;
  isFavorite: boolean;
  onSelect: (bookId: string) => void;
}) {
  const style = getSubjectStyle(book.subject);

  return (
    <div className="group cursor-pointer" onClick={() => onSelect(book.id)}>
      <div
        className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-2xl"
        style={{ background: getBookGradient(book.subject) }}
      >
        {/* Uploaded cover */}
        {coverUrl && (
          <img
            src={coverUrl}
            alt={book.title}
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        )}

        {/* Shine overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)",
          }}
        />

        {/* Favorite indicator (non-interactive — toggle is in modal) */}
        {isFavorite && (
          <div className="absolute right-2.5 top-2.5 z-10 rounded-lg border border-white/20 bg-white/70 p-1 backdrop-blur-xl">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
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
    </div>
  );
}

// ── BooksView ───────────────────────────────────────────────────────────

export function BooksView({
  initialBooks,
  initialFavoriteIds,
  studentId,
  coverUrls,
}: {
  initialBooks: Book[];
  initialFavoriteIds: string[];
  studentId: string;
  coverUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [books, setBooks] = useState(initialBooks);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set(initialFavoriteIds));
  const [activeTab, setActiveTab] = useState<"library" | "favorites">("library");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setBooks(initialBooks); }, [initialBooks]);
  useEffect(() => { setFavoriteIds(new Set(initialFavoriteIds)); }, [initialFavoriteIds]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleFavorite = useCallback(
    async (bookId: string) => {
      if (!studentId) return;
      const isFav = favoriteIds.has(bookId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(bookId); else next.add(bookId);
        return next;
      });
      try {
        const sb = createClient();
        if (isFav) {
          await removeBookFavorite(sb, bookId, studentId);
        } else {
          await addBookFavorite(sb, bookId, studentId);
        }
        router.refresh();
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(bookId); else next.delete(bookId);
          return next;
        });
        setToast("Не удалось обновить избранное");
      }
    },
    [studentId, favoriteIds, router],
  );

  const handleDownload = useCallback(
    async (bookId: string) => {
      setDownloadingId(bookId);
      try {
        const url = await getBookFileUrl(bookId);
        if (!url) { setToast("Не удалось получить ссылку на файл"); return; }
        const book = books.find((b) => b.id === bookId);
        const filename = book?.file_storage_path.split("/").pop() || "book.pdf";
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        setToast("Не удалось скачать файл");
      } finally {
        setDownloadingId(null);
      }
    },
    [books],
  );

  const selectedBook = selectedBookId
    ? (books.find((b) => b.id === selectedBookId) ?? null)
    : null;

  const displayed =
    activeTab === "library" ? books : books.filter((b) => favoriteIds.has(b.id));

  return (
    <section className="mx-auto max-w-7xl text-slate-800">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}

      {/* Detail modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          coverUrl={coverUrls[selectedBook.id]}
          isFavorite={favoriteIds.has(selectedBook.id)}
          isStudent={!!studentId}
          onClose={() => setSelectedBookId(null)}
          onToggleFavorite={() => toggleFavorite(selectedBook.id)}
          onDownload={() => handleDownload(selectedBook.id)}
          downloading={downloadingId === selectedBook.id}
        />
      )}

      <h1 className="mb-6 text-3xl font-bold text-slate-800">Книги и учебники</h1>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab("library")}
          className={
            activeTab === "library"
              ? "flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200"
              : "flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-6 py-2.5 font-medium text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/90"
          }
        >
          <Library className="h-4 w-4" />
          Библиотека школы
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={
            activeTab === "favorites"
              ? "flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200"
              : "flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-6 py-2.5 font-medium text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/90"
          }
        >
          <Star className="h-4 w-4" />
          Избранное
          {favoriteIds.size > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                activeTab === "favorites" ? "bg-white/20" : "bg-blue-600 text-white"
              }`}
            >
              {favoriteIds.size}
            </span>
          )}
        </button>
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <BookOpen className="h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-500">
            {activeTab === "library" ? "Книг пока нет" : "Нет избранных книг"}
          </p>
          {activeTab === "favorites" && books.length > 0 && (
            <p className="text-sm text-slate-400">
              Нажмите на книгу, чтобы добавить её в избранное
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayed.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              coverUrl={coverUrls[book.id]}
              isFavorite={favoriteIds.has(book.id)}
              onSelect={setSelectedBookId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
