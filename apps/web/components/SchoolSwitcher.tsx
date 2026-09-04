"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

/**
 * ПЕРЕКЛЮЧАТЕЛЬ ШКОЛЫ В ШАПКЕ УЧИТЕЛЯ. 06.09.2026.
 *
 * ═══ КОМУ ВИДЕН ═══════════════════════════════════════════════════════════
 *
 * Только тому, у кого школ БОЛЬШЕ ОДНОЙ. У остальных не появляется ничего:
 * ни кнопки, ни пустого места, ни подписи «моя школа» — сегодня это все
 * двенадцать учителей, и шапка у них обязана остаться прежней.
 *
 * ═══ ПРОВЕРКУ «ГДЕ Я РАБОТАЮ» ДЕЛАЕТ БАЗА ═════════════════════════════════
 *
 * Правило записи выбора (`staff_active_school_set` / `_change`, миграция 259)
 * требует `user_id = auth.uid() AND is_school_teacher_of(school_id)`. Второй
 * такой проверки здесь НЕТ намеренно: две проверки одного и того же неизбежно
 * разъезжаются, а решает всё равно база. Наше дело — показать внятный отказ,
 * если она сработает, а не гадать заранее.
 *
 * ═══ ПОЧЕМУ ПОЛНАЯ ПЕРЕЗАГРУЗКА, А НЕ ОБНОВЛЕНИЕ ══════════════════════════
 *
 * После переключения меняется ВСЁ: расписание, журнал, ученики, материалы,
 * чаты, заказы. `router.refresh()` перерисовал бы серверные части, но оставил
 * бы нетронутым состояние клиента — открытые окна, списки в памяти, живые
 * подписки, заведённые на старую школу. Полэкрана осталось бы от прежней школы,
 * и это худший исход из возможных: человек не поймёт, что перед ним.
 *
 * Поэтому документ грузится заново. И не на текущий адрес, а на главную
 * учителя: страница урока, журнала или плана открыта по идентификатору из
 * ПРЕЖНЕЙ школы, и после переключения та запись просто перестаёт быть видимой.
 * Перезагрузка на месте оставила бы человека перед «не найдено». Главная есть
 * в любой школе.
 */

export type ПунктШколы = { id: string; name: string };

export function SchoolSwitcher({
  schools,
  activeId,
}: {
  schools: ПунктШколы[];
  activeId: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).common;
  const db = createClient();

  const [открыт, setОткрыт] = useState(false);
  const [занят, setЗанят] = useState<string | null>(null);
  const [отказ, setОтказ] = useState("");
  const корень = useRef<HTMLDivElement>(null);

  // Клик мимо — закрываем. Иначе список висит поверх страницы и мешает.
  useEffect(() => {
    if (!открыт) return;
    const мимо = (e: MouseEvent) => {
      if (корень.current && !корень.current.contains(e.target as Node)) setОткрыт(false);
    };
    document.addEventListener("mousedown", мимо);
    return () => document.removeEventListener("mousedown", мимо);
  }, [открыт]);

  // Одна школа или ни одной — переключателя нет вовсе.
  if (schools.length < 2) return null;

  const текущая = schools.find((s) => s.id === activeId) ?? schools[0]!;

  async function выбрать(school: ПунктШколы) {
    if (school.id === activeId || занят) return;
    setЗанят(school.id);
    setОтказ("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await (db as any).auth.getUser();
      if (!user) throw new Error("нет сессии");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any)
        .from("staff_active_school")
        .upsert({ user_id: user.id, school_id: school.id }, { onConflict: "user_id" });
      if (error) throw error;
      // Документ заново — см. пояснение в шапке файла.
      window.location.assign("/teacher");
    } catch (e) {
      console.error("[SchoolSwitcher] переключение не вышло:", (e as Error)?.message);
      setОтказ(d.schoolSwitchDenied);
      setЗанят(null);
    }
  }

  return (
    <div ref={корень} className="relative">
      <button
        type="button"
        onClick={() => setОткрыт((v) => !v)}
        title={d.schoolSwitchTitle}
        className="flex items-center gap-2 rounded-[16px] border border-white/40 bg-white/60 py-2 pl-3 pr-2.5 text-sm font-semibold text-gray-700 shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-xl hover:bg-white/80 active:scale-95"
      >
        <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="hidden max-w-[160px] truncate md:block">{текущая.name}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${открыт ? "rotate-180" : ""}`} />
      </button>

      {открыт && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {d.schoolSwitchTitle}
          </p>
          <ul>
            {schools.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void выбрать(s)}
                  disabled={занят !== null}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50 ${
                    s.id === activeId ? "font-bold text-blue-700" : "text-slate-700"
                  }`}
                >
                  {занят === s.id
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                    : s.id === activeId
                      ? <Check className="h-4 w-4 shrink-0 text-blue-600" />
                      : <span className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {отказ && (
            <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-[11px] leading-relaxed text-red-700">{отказ}</p>
          )}
        </div>
      )}
    </div>
  );
}
