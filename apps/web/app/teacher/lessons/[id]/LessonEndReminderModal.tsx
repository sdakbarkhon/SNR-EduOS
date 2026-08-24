"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Clock } from "lucide-react";
import { getDictionary, AUTO_END_GRACE_MINUTES } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Окно со списком неотмеченных за пять минут до конца урока.
 *
 * Было заведено 21.06.2026 и удалено 25.06.2026 тем же коммитом, что завёл
 * баннер (0033fd5). Строки словаря с тех пор лежали неиспользованными.
 * Восстановлено 23.08.2026 из истории репозитория без переписывания: окно не
 * ошибалось — оно молчало ровно тогда, когда неотмеченных не осталось.
 */

export function LessonEndReminderModal({
  lessonId,
  endsAt,
  unmarkedNames,
  status,
  onScrollToRollCall,
}: {
  lessonId: string;
  endsAt: string | null;
  unmarkedNames: string[];
  status: string;
  onScrollToRollCall: () => void;
}) {
  const { locale } = useLocale();
  const dl = getDictionary(locale as Locale).lesson;

  const [show, setShow] = useState(false);
  const namesRef = useRef(unmarkedNames);
  useEffect(() => { namesRef.current = unmarkedNames; });

  useEffect(() => {
    if (status !== "in_progress" || !endsAt) return;

    const check = () => {
      const minsLeft = (new Date(endsAt).getTime() - Date.now()) / 60_000;
      // 23.08.2026. Нижняя граница была 0 — по звонку. Теперь урок закрывается
      // через AUTO_END_GRACE_MINUTES минут после него, и всё это время окно
      // ещё имеет смысл: перекличку можно дописать.
      if (minsLeft > 5 || minsLeft < -AUTO_END_GRACE_MINUTES) return;
      if (namesRef.current.length === 0) return;
      try {
        if (sessionStorage.getItem(`reminder_shown_${lessonId}`)) return;
      } catch { /* blocked */ }
      setShow(true);
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [lessonId, endsAt, status]);

  function dismiss() {
    try { sessionStorage.setItem(`reminder_shown_${lessonId}`, "1"); } catch { /* blocked */ }
    setShow(false);
  }

  function handleGoToRollCall() {
    dismiss();
    onScrollToRollCall();
  }

  if (!show || typeof document === "undefined") return null;

  const displayNames = unmarkedNames.slice(0, 5);
  const extra = unmarkedNames.length - 5;

  return createPortal(
    <div
      className="fixed inset-0 z-[9997] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="relative w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
          <Clock className="h-6 w-6 text-orange-500" />
        </div>

        <h3 className="mb-2 text-lg font-bold text-slate-900">{dl.reminderTitle}</h3>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">{dl.reminderBody}</p>

        {unmarkedNames.length > 0 && (
          <div className="mb-5 rounded-xl bg-slate-50 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {dl.reminderUnmarked}
            </p>
            <ul className="space-y-1">
              {displayNames.map((name) => (
                <li key={name} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  {name}
                </li>
              ))}
              {extra > 0 && (
                <li className="text-sm text-slate-400">
                  {dl.reminderAndMore.replace("{count}", String(extra))}
                </li>
              )}
            </ul>
          </div>
        )}

        <button
          onClick={handleGoToRollCall}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-colors hover:bg-blue-700"
        >
          {dl.reminderGoToRollCall}
        </button>
      </div>
    </div>,
    document.body,
  );
}
