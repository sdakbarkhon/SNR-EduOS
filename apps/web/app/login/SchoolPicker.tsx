"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { SchoolMark } from "@/components/SchoolMark";

/**
 * Первый экран входа: выбор школы.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА — вход не должен зависеть от нового шага.
 * Если список не загрузился, пришёл пустым или запрос упал, экран НЕ показывает
 * ошибку и не запирает человека: он молча пропускает шаг и отдаёт обычную форму
 * логина. Вход — главный экран платформы, и добавленный поверх него шаг не
 * имеет права стать новой точкой отказа.
 *
 * ЧТО ЗАПОМИНАЕТСЯ. Выбранная школа кладётся в localStorage, чтобы не
 * переспрашивать каждый раз. Рядом с названием всегда стоит «Сменить школу» —
 * запомненный выбор не должен превращаться в ловушку для того, кто ошибся.
 */

const STORAGE_KEY = "login_school_id";

export type PublicSchool = { id: string; name: string; logoUrl: string | null };

/** Что помнит браузер о прошлом выборе. Вынесено, чтобы форма логина читала
 *  то же самое место, а не заводила своё представление о нём. */
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

export function SchoolPicker({
  locale,
  onPick,
  onSkip,
}: {
  locale: Locale;
  onPick: (school: PublicSchool) => void;
  /** Школ нет, список не открылся, или человек сам решил войти без выбора. */
  onSkip: () => void;
}) {
  const d = getDictionary(locale);
  const t = d.auth;

  const [schools, setSchools] = useState<PublicSchool[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/schools")
      .then((r) => (r.ok ? r.json() : { schools: [] }))
      .then((json: { schools?: PublicSchool[] }) => {
        if (cancelled) return;
        const list = Array.isArray(json.schools) ? json.schools : [];
        setSchools(list);
        // Ни одной школы — шага не существует. Показывать пустой экран с
        // надписью «школ нет» и оставлять человека без формы нельзя.
        if (list.length === 0) { onSkip(); return; }
        // Прошлый выбор подставляется сам — и название с логотипом берутся из
        // этого же ответа, без второго запроса. Если школа с тех пор исчезла
        // или ушла в архив, её тут просто нет, и шаг покажется как обычно.
        const remembered = readRememberedSchool();
        const found = remembered ? list.find((s) => s.id === remembered) : undefined;
        if (found) onPick(found);
      })
      .catch(() => {
        if (cancelled) return;
        setSchools([]);
        onSkip();
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{t.chooseSchoolTitle}</p>
        <p className="mt-0.5 text-xs text-slate-500">{t.chooseSchoolSubtitle}</p>
      </div>

      {schools === null ? (
        <p className="py-6 text-center text-sm text-slate-400">{t.chooseSchoolLoading}</p>
      ) : schools.length === 0 ? (
        // Досюда доходит только в тот кадр, пока onSkip ещё не перерисовал
        // родителя. Надпись на всякий случай, а не рабочее состояние.
        <p className="py-6 text-center text-sm text-slate-400">{t.chooseSchoolNone}</p>
      ) : (
        <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
          {schools.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { rememberSchool(s.id); onPick(s); }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#FFB020] hover:bg-white"
            >
              {/* Логотипа может не быть — SchoolMark покажет буквы названия.
                  Правило одно на всё приложение, здесь оно не переписывается. */}
              <SchoolMark name={s.name} logoUrl={s.logoUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Суперадминистратор школы не имеет: заставить его выбрать чужую было бы
          неправдой, а не дать войти — поломкой. Ссылка неприметная и подписана,
          для кого она. Выбор школы не разграничивает доступ (это делают правила
          доступа по школе самого пользователя), поэтому такой проход ничего не
          ослабляет. */}
      <button
        type="button"
        onClick={() => { rememberSchool(null); onSkip(); }}
        className="mt-1 self-center text-center"
      >
        <span className="block text-xs font-medium text-slate-500 underline hover:text-slate-700">
          {t.chooseSchoolSkip}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-400">{t.chooseSchoolSkipHint}</span>
      </button>
    </div>
  );
}
