"use client";

import { useEffect } from "react";

/**
 * Жёстко фиксирует СВЕТЛУЮ тему на всём /parent.
 *
 * ЗАЧЕМ (две причины, обе неочевидные):
 *
 *  1. Тема хранится в localStorage["snr-theme"] и применяется глобальным
 *     ThemeProvider'ом как class="dark" на <html>. Переключатель темы из
 *     /parent убран (коммит 25cd4f3) — но СОХРАНЁННОЕ значение осталось.
 *     Если родитель (или кто-то на этом устройстве из ученического
 *     приложения) когда-то выбрал «Тёмная» или «Системная» на тёмной ОС,
 *     /parent грузится тёмным НАВСЕГДА: класс проставляется при каждой
 *     загрузке, а кнопки, чтобы его снять, больше нет.
 *
 *  2. В globals.css `.dark` переопределяет НЕ только `dark:`-варианты
 *     Tailwind, а обычные утилиты и CSS-переменные:
 *         .dark .text-slate-900 { color: #e6ecfb }   ← светлый текст
 *         .dark .text-gray-*, .dark .text-brand-*
 *         .dark { --shell-gradient: <тёмный градиент>; --surface-*; --text-* }
 *     Поэтому «в app/parent ноль dark:-классов» НЕ означает, что /parent
 *     не темнеет: экраны используют обычные text-slate-* / text-gray-* и
 *     переменные, и глобальные .dark-правила их перекрашивают.
 *
 * РЕШЕНИЕ: пока смонтирован любой экран /parent — класс `dark` с <html>
 * снят, а color-scheme прибит к light. При уходе с /parent прежнее
 * состояние возвращается, чтобы ученик/учитель сохранили свою тему.
 */
export function ParentLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prevColorScheme = root.style.colorScheme;

    // Намерение читаем из localStorage, а НЕ из класса на <html>: inline-скрипт
    // в app/layout.tsx на путях /parent снимает `dark` ещё до гидратации,
    // поэтому проверка classList здесь всегда дала бы false — и, уходя с
    // /parent клиентской навигацией, ученик/учитель остались бы в светлой теме
    // до перезагрузки.
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("snr-theme");
    } catch {
      // приватный режим / заблокированное хранилище — считаем, что тема светлая
    }
    const had =
      saved === "dark" ||
      (saved === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    root.classList.remove("dark");
    root.style.colorScheme = "light";

    // ThemeProvider переставляет класс в своём эффекте и по событию
    // prefers-color-scheme (вариант «Системная»). Наблюдатель гарантирует,
    // что на /parent тёмный класс не вернётся ни при каком порядке эффектов.
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark")) root.classList.remove("dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      if (had) root.classList.add("dark");
      root.style.colorScheme = prevColorScheme;
    };
  }, []);

  return null;
}
