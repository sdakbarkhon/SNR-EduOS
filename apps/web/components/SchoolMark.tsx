"use client";

import { useState } from "react";

/**
 * Знак школы: логотип, а если его нет — буквы названия.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ. Знак нужен в трёх местах (шапка админки, профиль
 * админа, дальше — выбор школы при входе), и правило «нет логотипа — показываем
 * название, а не пустое место» должно быть записано ОДИН раз. Иначе на третьем
 * экране появится серый квадрат.
 *
 * ПОЧЕМУ БУКВЫ, А НЕ ПОЛНОЕ НАЗВАНИЕ ВНУТРИ КВАДРАТА. Рядом со знаком название
 * уже написано словами. Внутри маленького квадрата оно превратилось бы в
 * нечитаемую кашу — поэтому там первые буквы, до двух: «SNR International
 * School» → «SI».
 *
 * КАРТИНКА НЕ ЗАГРУЗИЛАСЬ — ТОЖЕ БУКВЫ. Ссылка на логотип подписана на час
 * (lib/school-card.ts), а с 19.08.2026 она попадает прямо в HTML страницы
 * входа, который лежит в кэше края. Ночь без единого захода — и страница
 * отдаётся со ссылкой старше часа. Дальше браузер показал бы битую картинку,
 * то есть худшее из возможного: не логотип и не название. Правило «нет
 * логотипа — показываем буквы» одно, и неудачная загрузка попадает под него
 * же, а не заводит третий случай.
 */

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

const SIZES = {
  sm: { box: "h-8 w-8 rounded-lg", text: "text-[11px]" },
  lg: { box: "h-14 w-14 rounded-2xl", text: "text-base" },
  // Шапка формы входа: логотип школы должен быть заметен, а не угадываться.
  xl: { box: "h-20 w-20 rounded-3xl", text: "text-2xl" },
  // Плитка в окне выбора школы. Логотип здесь — главное: его узнают раньше,
  // чем читают название, поэтому он крупнее, чем где-либо ещё.
  tile: { box: "h-24 w-24 rounded-3xl", text: "text-3xl" },
} as const;

export function SchoolMark({
  name,
  logoUrl,
  size = "sm",
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      <div className={`flex ${s.box} shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-violet-100`}>
        {/* object-contain, а не cover: логотип нельзя обрезать по краям. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${s.box} shrink-0 items-center justify-center bg-violet-100 font-bold text-violet-700 ${s.text}`}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
