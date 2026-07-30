"use client";

import { useEffect } from "react";

/**
 * Тема на /parent: две кнопки, «Светлая» и «Тёмная», без «Системной».
 *
 * ХРАНЕНИЕ. У /parent СВОЙ ключ — localStorage["snr-parent-theme"], отдельно
 * от ученического "snr-theme".
 *
 * Раньше ключ был общий, и это оказалось ошибкой: тема, выбранная в
 * приложении УЧЕНИКА на том же устройстве (или «Системная» на телефоне с
 * тёмной ОС), молча применялась к родителю. Родитель открывал приложение,
 * видел тёмный экран и был прав, говоря «я светлую не выбирал». Ключи
 * разведены, поэтому /parent теперь реагирует ТОЛЬКО на свой переключатель,
 * а конфликта двух источников класса `dark` нет: вне /parent этот ключ никто
 * не читает, внутри /parent никто не читает ученический.
 *
 * ПОЛИТИКА /parent (отличается от ученика/учителя — это осознанно):
 *   'dark'   → тёмная;
 *   всё иное → СВЕТЛАЯ. prefers-color-scheme не спрашиваем вовсе.
 * Первый вход родителя всегда светлый, даже на телефоне с тёмной ОС.
 *
 * ЗАЧЕМ КОМПОНЕНТ, если класс уже проставил блокирующий скрипт в
 * app/layout.tsx. Две причины, обе про то, что происходит ПОСЛЕ гидратации:
 *
 *  1. ThemeProvider в корневом layout при сохранённом 'system' вызывает
 *     applyTheme('system') в своём эффекте и вдобавок вешает слушатель
 *     matchMedia('(prefers-color-scheme: dark)'). На тёмной ОС это повесило
 *     бы `dark` на /parent сразу после гидратации, а смена темы ОС — в любой
 *     момент. MutationObserver ниже возвращает класс к тому, что /parent
 *     считает верным. Он именно НОРМАЛИЗУЕТ, а не гасит тёмную: если выбор
 *     явный ('dark'), наблюдатель этот выбор охраняет, а не снимает.
 *
 *  2. Клиентская навигация. При уходе с /parent размонтирование возвращает
 *     <html> в состояние, которое положено ученику/учителю (там 'system'
 *     снова означает системную тему).
 *
 * Сохранённое значение НЕ переписывается при монтировании: если в хранилище
 * лежит 'system', родитель видит светлую, но у ученика на этом же устройстве
 * «Системная» остаётся выбранной. Перезапись происходит только по явному
 * тапу пользователя.
 */

export type ParentTheme = "light" | "dark";

/** Собственный ключ родителя. Ученический "snr-theme" здесь не трогаем. */
const STORAGE_KEY = "snr-parent-theme";

/**
 * Какое состояние класса `dark` считается верным на /parent прямо сейчас.
 * Модульная переменная, а не React-state: её читает MutationObserver, который
 * живёт вне рендера и обязан видеть свежее значение немедленно, ещё до
 * перерисовки экрана настроек.
 */
let desiredDark = false;

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // приватный режим / заблокированное хранилище — считаем, что ничего нет
    return null;
  }
}

/** Тема /parent из хранилища. Всё, что не ровно 'dark', — светлая. */
export function readParentTheme(): ParentTheme {
  return readStored() === "dark" ? "dark" : "light";
}

function applyToRoot(theme: ParentTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/** Сохранить выбор родителя и применить его немедленно. */
export function setParentTheme(theme: ParentTheme) {
  desiredDark = theme === "dark";
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // не сохранилось — тема всё равно применится на эту сессию
  }
  applyToRoot(theme);
}

export function ParentThemeSync() {
  useEffect(() => {
    const root = document.documentElement;

    const initial = readParentTheme();
    desiredDark = initial === "dark";
    applyToRoot(initial);

    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark") !== desiredDark) {
        root.classList.toggle("dark", desiredDark);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();

      // Уходим с /parent клиентской навигацией — отдаём <html> обратно под
      // правила ученика/учителя. Читаем ИХ ключ: родительский за пределами
      // /parent не значит ничего.
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("snr-theme");
      } catch {
        // хранилище недоступно — считаем, что у ученика светлая
      }
      const dark =
        saved === "dark" ||
        (saved === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      // Сбрасываем в пустоту, а не в «снимок при монтировании»: к моменту
      // монтирования colorScheme уже проставил блокирующий скрипт для /parent,
      // так что снимок содержал бы родительское значение и уезжал бы вместе с
      // нами на экраны ученика. Вне /parent это свойство инлайном не задаётся
      // вовсе — пустая строка и есть исходное состояние.
      root.style.colorScheme = "";
    };
  }, []);

  return null;
}
