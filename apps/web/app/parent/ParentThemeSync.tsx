"use client";

import { useEffect } from "react";
import { THEME_CHANGE_EVENT } from "@/components/ThemeProvider";

/**
 * Тема на /parent: две кнопки, «Светлая» и «Тёмная», без «Системной».
 *
 * ХРАНЕНИЕ. Один ключ на всё приложение — localStorage["snr-theme"], тот же,
 * что читает глобальный ThemeProvider. Второго ключа не заводим: иначе у
 * одного <html> появилось бы два независимых источника класса `dark`, и они
 * гарантированно разъехались бы.
 *
 * ПОЛИТИКА /parent (отличается от ученика/учителя — это осознанно):
 *   'dark'            → тёмная;
 *   'light'           → светлая;
 *   'system' / пусто  → СВЕТЛАЯ, prefers-color-scheme не спрашиваем вовсе.
 * То есть первый вход родителя всегда светлый, даже на телефоне с тёмной ОС,
 * а «Системная», выбранная когда-то в ученическом профиле на этом же
 * устройстве, на /parent молча читается как светлая.
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

const STORAGE_KEY = "snr-theme";

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
  // Мы пишем общий ключ напрямую, поэтому сами и сообщаем об этом
  // ThemeProvider'у: иначе его состояние осталось бы прежним, и при
  // сохранённой ранее «Системной» слушатель темы ОС перебил бы явный выбор
  // родителя после ухода с /parent.
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
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
      // правила ученика/учителя, где 'system' снова означает системную тему.
      // Значение перечитываем: родитель мог только что сменить тему.
      const saved = readStored() ?? "light";
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
