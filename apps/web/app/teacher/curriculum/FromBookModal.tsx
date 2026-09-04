"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, BookOpen, AlertTriangle } from "lucide-react";
import { getDictionary, getBooksForPlanSource } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { ModalPortal } from "@/components/ModalPortal";

/**
 * СОЗДАНИЕ УЧЕБНОГО ПЛАНА ИЗ УЧЕБНИКА — ЗАКАЗ НА ФАЙЛ. 06.09.2026.
 *
 * Окно больше НЕ СОЗДАЁТ ПЛАН. Оно заводит заказ: модель читает книгу и
 * складывает темы файлом, а план родится позже — когда учитель принесёт этот
 * файл кнопкой «Загрузить учебный план». Разбор минутный, поэтому окно
 * закрывается сразу, а ход виден в списке файлов на самом экране планов.
 *
 * ПОЭТОМУ ЗДЕСЬ НЕТ ВОПРОСА ПРО ЗАМЕНУ. Раньше окно спрашивало, заменять ли
 * существующий план на эту пару: план создавался немедленно и занимал её.
 * Заказ пары не занимает и ничего не затирает — спрашивать не о чем.
 *
 * Прежний разбор из учебника.
 *
 * ИСТОЧНИК — БИБЛИОТЕКА ШКОЛЫ, а не загрузка файла. Причин две. Учебники в
 * библиотеке уже лежат — в демо-школе это одиннадцать настоящих PDF, от 140 КБ
 * до 31 МБ, — и заставлять учителя грузить тридцать мегабайт второй раз просто
 * чтобы разобрать то, что уже загружено, незачем. Вторая причина важнее:
 * загрузка книг уже есть в разделе «Библиотека», и второй загрузчик рядом стал
 * бы ровно тем дублирующим способом, которого мы избегаем.
 *
 * ПОЧЕМУ КНИГИ ФИЛЬТРУЮТСЯ ПО ФАЙЛУ. У книги может быть внешняя ссылка вместо
 * файла — такую не скачать и текст из неё не извлечь. Показывать её в списке
 * значило бы предложить действие, которое гарантированно не сработает.
 */

type BookItem = { id: string; title: string; author: string | null; subject: string | null; file_size_bytes: number | null };

export function FromBookModal({
  groups,
  subjects,
  onClose,
  onStarted,
}: {
  groups: Array<{ id: string; name: string }>;
  /** Минимум, который нужен окну: чем полнее тип, тем сильнее оно привязано
   *  к форме родительского экрана без всякой на то причины. */
  subjects: Array<{ id: string; name: string; group_id: string }>;
  onClose: () => void;
  /** Заказ принят. true — он уже шёл, второй не завёлся. */
  onStarted?: (ужеШёл: boolean) => void;
}) {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale);
  const d = dict.curriculum;
  const router = useRouter();
  const db = createClient();

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const groupSubjects = useMemo(() => subjects.filter((s) => s.group_id === groupId), [subjects, groupId]);
  const [subjectId, setSubjectId] = useState("");
  useEffect(() => { setSubjectId(groupSubjects[0]?.id ?? ""); }, [groupSubjects]);

  const [books, setBooks] = useState<BookItem[] | null>(null);
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBooksForPlanSource(db)
      .then((rows) => { if (!cancelled) setBooks(rows as BookItem[]); })
      .catch(() => { if (!cancelled) setBooks([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!groupId || !subjectId || !bookId || busy) return;
    setBusy(true);
    setError("");
    try {
      const book = books?.find((b) => b.id === bookId);
      const group = groups.find((g) => g.id === groupId);
      const subject = subjects.find((s) => s.id === subjectId);

      const res = await fetch("/api/curriculum-plans/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId, subjectId, bookId,
          // НЕ ПЕРЕВОДИТСЯ НАМЕРЕННО: это значение уходит в тело запроса и
          // ложится в базу названием заказа и именем скачиваемого файла.
          // Переведи — и у соседа по школе тот же файл назовётся иначе.
          title: `${subject?.name ?? book?.title ?? "Предмет"} — ${group?.name ?? "Группа"}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || d.fromBookFailed); return; }
      // Окно закрывается сразу: ждать нечего, ход разбора виден в списке
      // файлов, и вкладку можно закрыть вовсе.
      onClose();
      onStarted?.(json.alreadyRunning === true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.fromBookNetworkError);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">{d.fromBookTitle}</h2>
                <p className="text-xs text-slate-400">{d.fromBookSubtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>{dict.teacher.bulkGroup}</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{dict.teacher.bulkSubject}</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                  {groupSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>{d.fromBookPick}</label>
              {books === null ? (
                <p className="py-4 text-center text-sm text-slate-400">{dict.common.loading}</p>
              ) : books.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  {d.fromBookNoBooks}
                </p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {books.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBookId(b.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        bookId === b.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"
                      }`}
                    >
                      <BookOpen className={`h-4 w-4 shrink-0 ${bookId === b.id ? "text-blue-600" : "text-slate-300"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{b.title}</span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {[b.author, b.subject, b.file_size_bytes ? `${Math.round(b.file_size_bytes / 1024 / 1024 * 10) / 10} ${d.fromBookSizeMb}` : null]
                            .filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-slate-100 px-5 py-4">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              {dict.common.cancel}
            </button>
            <button
              onClick={start}
              disabled={busy || !bookId || !groupId || !subjectId}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? d.fromBookStarting : d.fromBookStart}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
