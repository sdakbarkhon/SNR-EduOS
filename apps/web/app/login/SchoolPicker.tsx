"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { SchoolMark } from "@/components/SchoolMark";

/**
 * Выбор школы перед входом — модальным окном поверх экрана.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА — вход не должен зависеть от нового шага.
 * Если список не загрузился, пришёл пустым или запрос упал, окно НЕ показывает
 * ошибку и не запирает человека: оно молча зовёт onSkip, и открывается обычная
 * форма логина. Вход — главный экран платформы, и добавленный поверх него шаг
 * не имеет права стать новой точкой отказа.
 *
 * ОДНА ШКОЛА — ОКНА НЕТ. Выбирать из одной плитки нечего, а окно поверх экрана
 * ради этого выглядит издевательством. Школа подставляется сама; учитель
 * увидит её логотип и название над формой и сможет передумать по «Сменить
 * школу» — вот тогда окно и откроется, потому что это уже осознанное действие.
 *
 * ПОИСК НА КЛИЕНТЕ. Список приходит целиком и один раз; фильтровать его
 * запросом к серверу на каждую букву незачем — школ в установке десятки, а не
 * десятки тысяч.
 *
 * ЧТО ЗАПОМИНАЕТСЯ. Выбранная школа кладётся в localStorage, чтобы не
 * переспрашивать каждый раз. Рядом с названием всегда стоит «Сменить школу» —
 * запомненный выбор не должен превращаться в ловушку для того, кто ошибся.
 */

const STORAGE_KEY = "login_school_id";

export type PublicSchool = { id: string; name: string; logoUrl: string | null };

export function readRememberedSchool(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // приватный режим — просто спросим заново
  }
}

export function rememberSchool(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* приватный режим — переживём */ }
}

export function SchoolPickerModal({
  locale,
  onPick,
  onSkip,
  /** Окно открыто повторно по «Сменить школу»: список уже был загружен, и
   *  подставлять запомненное или единственную школу больше нельзя — человек
   *  пришёл сюда именно затем, чтобы выбрать другую. */
  reopened = false,
  onClose,
}: {
  locale: Locale;
  onPick: (school: PublicSchool) => void;
  /** Школ нет либо список не открылся — шага не существует. */
  onSkip: () => void;
  reopened?: boolean;
  onClose?: () => void;
}) {
  const d = getDictionary(locale);
  const t = d.auth;

  const [schools, setSchools] = useState<PublicSchool[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/schools")
      .then((r) => (r.ok ? r.json() : { schools: [] }))
      .then((json: { schools?: PublicSchool[] }) => {
        if (cancelled) return;
        // Порядок по алфавиту. Сервер уже сортирует, но полагаться на это
        // нельзя: сортировка в базе зависит от collation, а тут нужен порядок,
        // понятный человеку в его языке.
        const list = (Array.isArray(json.schools) ? json.schools : [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "ru"));
        setSchools(list);

        if (reopened) return; // повторное открытие — только ручной выбор

        // Ни одной школы — шага не существует.
        if (list.length === 0) { onSkip(); return; }

        // Прошлый выбор подставляется сам, без второго запроса.
        const remembered = readRememberedSchool();
        const found = remembered ? list.find((s) => s.id === remembered) : undefined;
        if (found) { onPick(found); return; }

        // Единственная школа — выбирать не из чего.
        if (list.length === 1) { rememberSchool(list[0]!.id); onPick(list[0]!); }
      })
      .catch(() => {
        if (cancelled) return;
        setSchools([]);
        if (!reopened) onSkip();
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !schools) return schools ?? [];
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, query]);

  // Пока список грузится и шаг ещё может оказаться пропущенным, окна не
  // показываем вовсе: мигать модалкой на долю секунды хуже, чем подождать.
  if (schools === null && !reopened) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={() => reopened && onClose?.()}
    >
      {/* 80% высоты — и ни пикселем больше: на узком телефоне окно во весь
          экран прижимает поиск к системным элементам. Внутри всё сжимаемое
          скроллится, поэтому содержимое не режется ни на какой высоте. */}
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="flex h-[80vh] max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{t.chooseSchoolTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.chooseSchoolSubtitle}</p>
          </div>
          {reopened && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Поиск. При двадцати школах листать неудобно, а при трёх поиск не
            мешает: поле маленькое и не отнимает места у списка. */}
        <div className="shrink-0 px-5 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={t.chooseSchoolSearch}
              autoCapitalize="none"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#FFB020] focus:bg-white"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
          {schools === null ? (
            <p className="py-8 text-center text-sm text-slate-400">{t.chooseSchoolLoading}</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {schools.length === 0 ? t.chooseSchoolNone : t.chooseSchoolNotFound}
            </p>
          ) : (
            shown.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { rememberSchool(s.id); onPick(s); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#FFB020] hover:bg-amber-50/40"
              >
                {/* Логотипа может не быть — SchoolMark покажет буквы названия.
                    Правило одно на всё приложение, здесь не переписывается. */}
                <SchoolMark name={s.name} logoUrl={s.logoUrl} size="lg" />
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{s.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
