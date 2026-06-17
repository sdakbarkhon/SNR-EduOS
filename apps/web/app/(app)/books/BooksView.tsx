"use client";

import { useState, useEffect, useOptimistic, useCallback } from "react";
import { Star, BookOpen, Library } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSubjectStyle, addBookFavorite, removeBookFavorite } from "@snr/core";
import type { Book } from "@snr/core";
import { getBookFileUrl } from "@/app/actions/books";
import { useRouter } from "next/navigation";

// Subject-derived gradient colors for auto-covers
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

function getBookGradient(subject: string): string {
  const [from, to] = SUBJECT_GRADIENTS[subject] ?? ["#64748B", "#334155"];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

function BookCard({
  book,
  coverUrl,
  isFavorite,
  onToggleFavorite,
  onDownload,
  downloading,
}: {
  book: Book;
  coverUrl?: string | null;
  isFavorite: boolean;
  onToggleFavorite: (bookId: string, current: boolean) => void;
  onDownload: (bookId: string) => void;
  downloading: boolean;
}) {
  const style = getSubjectStyle(book.subject);

  return (
    <div
      className="group cursor-pointer"
      onClick={() => !downloading && onDownload(book.id)}
    >
      <div
        className="relative mb-3 flex h-44 items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: getBookGradient(book.subject) }}
      >
        {/* Cover image */}
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
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)" }}
        />

        {/* Star button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(book.id, isFavorite); }}
          className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-white/70 p-1.5 backdrop-blur-xl transition-colors hover:bg-white/90"
          title={isFavorite ? "Убрать из избранного" : "В избранное"}
        >
          <Star
            className={`h-4 w-4 transition-colors ${isFavorite ? "fill-yellow-400 text-yellow-400" : "text-slate-400/80"}`}
          />
        </button>

        {/* Download spinner overlay */}
        {downloading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Emoji fallback (no cover) */}
        {!coverUrl && (
          <span className="relative z-[2] text-5xl transition-transform duration-300 group-hover:scale-110">
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setBooks(initialBooks); }, [initialBooks]);
  useEffect(() => { setFavoriteIds(new Set(initialFavoriteIds)); }, [initialFavoriteIds]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleFavorite = useCallback(async (bookId: string, isFavorite: boolean) => {
    if (!studentId) return;
    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.delete(bookId); else next.add(bookId);
      return next;
    });
    try {
      const sb = createClient();
      if (isFavorite) {
        await removeBookFavorite(sb, bookId, studentId);
      } else {
        await addBookFavorite(sb, bookId, studentId);
      }
      router.refresh();
    } catch {
      // Revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(bookId); else next.delete(bookId);
        return next;
      });
      setToast("Не удалось обновить избранное");
    }
  }, [studentId, router]);

  const handleDownload = useCallback(async (bookId: string) => {
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
  }, [books]);

  const displayed = activeTab === "library"
    ? books
    : books.filter((b) => favoriteIds.has(b.id));

  return (
    <section className="mx-auto max-w-7xl text-slate-800">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}

      <h1 className="mb-6 text-3xl font-bold text-slate-800">Книги и учебники</h1>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab("library")}
          className={activeTab === "library"
            ? "flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200"
            : "flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-6 py-2.5 font-medium text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/90"
          }
        >
          <Library className="h-4 w-4" />
          Библиотека школы
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={activeTab === "favorites"
            ? "flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200"
            : "flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-6 py-2.5 font-medium text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/90"
          }
        >
          <Star className="h-4 w-4" />
          Избранное
          {favoriteIds.size > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === "favorites" ? "bg-white/20" : "bg-blue-600 text-white"}`}>
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
              Нажмите ★ на книге, чтобы добавить её в избранное
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayed.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              coverUrl={coverUrls[book.id]}
              isFavorite={favoriteIds.has(book.id)}
              onToggleFavorite={toggleFavorite}
              onDownload={handleDownload}
              downloading={downloadingId === book.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
