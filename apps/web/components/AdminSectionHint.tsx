"use client";

import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";

/**
 * Короткая подсказка внизу каждого раздела админки.
 *
 * ЗАЧЕМ. Администратор школы — директор или завуч, а не программист. Он
 * открывает раздел и не всегда понимает, что это и что здесь делают. Отдельная
 * инструкция (INSTRUKCIYA_ADMIN.md) это описывает, но в неё никто не
 * заглядывает: подсказка должна быть там, где человек уже стоит.
 *
 * ПОЧЕМУ ОДИН КОМПОНЕНТ В КАРКАСЕ, А НЕ СТРОКА В КАЖДОЙ СТРАНИЦЕ. Разделов
 * одиннадцать, и страниц у некоторых по нескольку (список, создание, карточка).
 * Разложенная по ним подсказка рано или поздно где-нибудь не появится, а на
 * новом разделе про неё просто забудут. Здесь она приклеена к каркасу и
 * выбирается по адресу — новый раздел получает её автоматически, а если текста
 * для него не завели, не показывается ничего (лучше пусто, чем чужая подсказка).
 *
 * Где в инструкции у раздела названа ловушка — она сказана одной фразой:
 * названия предметов пишутся полностью, пустой кабинет у нового учителя,
 * удаление группы уносит уроки и оценки, удаление ученика необратимо.
 */

/** Адрес раздела → ключ в словаре. Сначала длинные пути: /admin проверяется последним. */
const SECTIONS: ReadonlyArray<readonly [prefix: string, key: string]> = [
  ["/admin/students", "students"],
  ["/admin/teachers", "teachers"],
  ["/admin/groups", "groups"],
  ["/admin/subject-assignments", "assignments"],
  ["/admin/subjects", "subjects"],
  ["/admin/departments", "departments"],
  ["/admin/announcements", "announcements"],
  ["/admin/parents", "parents"],
  ["/admin/marks", "marks"],
  ["/admin/profile", "profile"],
  ["/admin/chats", "chats"],
  ["/admin/support", "support"],
];

function sectionKeyFor(pathname: string): string | null {
  for (const [prefix, key] of SECTIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return pathname === "/admin" ? "dashboard" : null;
}

export function AdminSectionHint() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const hints = getDictionary(locale as Locale).admin.hints;

  const key = sectionKeyFor(pathname ?? "");
  const text = key ? (hints as Record<string, string>)[key] : null;
  if (!text) return null;

  return (
    <p className="mx-auto mt-10 max-w-3xl border-t border-violet-100/70 pt-4 text-center text-[12px] leading-relaxed text-gray-400">
      {text}
    </p>
  );
}
