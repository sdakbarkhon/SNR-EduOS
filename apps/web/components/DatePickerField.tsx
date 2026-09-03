"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { useSchoolNowSnapshot } from "@/components/SchoolTimeProvider";

/**
 * ПОЛЕ ДАТЫ И ОБЩИЙ ВИД ПОЛЕЙ ФОРМЫ УРОКА.
 *
 * 04.09.2026. Оба вынесены сюда из `TeacherLessonsView`, потому что окно
 * создания урока показывает два режима — один урок и несколько, — и режимы
 * разъехались: у одного была рамка в четыре пикселя отступа и календарь, у
 * другого узкая лента и системное поле даты. В одном окне это читалось как два
 * разных окна.
 *
 * Классы полей лежат ЗДЕСЬ, а не по строке в каждом файле: пока их было две
 * копии, они уже успели разойтись отступом и цветом рамки.
 */

/** Поле ввода: одно на оба режима окна урока. */
export const FIELD_INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/** Подпись над полем. */
export const FIELD_LABEL = "mb-1 block text-xs font-semibold text-gray-600";

export function DatePickerField({
  value, onChange, inputCls = FIELD_INPUT, minToday = false, placeholder = "Выберите дату",
}: {
  value: string;
  onChange: (v: string) => void;
  inputCls?: string;
  minToday?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Z.3, заход 3 — «сегодня» школы для нижней границы календаря. Свой вызов
  // хука: это отдельный компонент, до значения из вызывающего ему не
  // дотянуться, а провайдер один на всё дерево.
  const schoolNowMs = useSchoolNowSnapshot();

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedDate = value ? new Date(`${value}T12:00:00`) : undefined;
  const display = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent",
      })
    : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${!value ? "text-gray-400" : ""}`}
      >
        <span>{display || placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-[200] mt-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{
            // Override rdp accent colour to match design blue
            ["--rdp-accent-color" as string]: "#2563eb",
            ["--rdp-accent-background-color" as string]: "#eff6ff",
            ["--rdp-day-height" as string]: "36px",
            ["--rdp-day-width" as string]: "36px",
            ["--rdp-day_button-height" as string]: "34px",
            ["--rdp-day_button-width" as string]: "34px",
          }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (!d) return;
              // DayPicker отдаёт локальную полночь выбранной клетки — это
              // календарная дата, а не момент. Читаем её теми же локальными
              // полями, какими она и создана: подмешивать сюда пояс нельзя,
              // иначе выбор съедет на день.
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${day}`);
              setOpen(false);
            }}
            disabled={minToday ? { before: new Date(new Date(schoolNowMs()).setHours(0, 0, 0, 0)) } : undefined}
          />
        </div>
      )}
    </div>
  );
}
