"use client";

import { Montserrat } from "next/font/google";
import { useLocale } from "@/components/LocaleProvider";
import { BackgroundArt } from "./BackgroundArt";
import { BrandingColumn } from "./BrandingColumn";
import { LoginForm } from "./LoginForm";
import { BottomBar } from "./BottomBar";
import { LanguageSelector } from "./LanguageSelector";
import type { PublicSchool } from "./school-step";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/**
 * Вся видимая часть экрана входа. Отделена от page.tsx 19.08.2026, когда
 * страница стала серверной: раскладка держится на useLocale(), а это
 * браузерный хук — в серверном компоненте ему не жить. Разделение чисто
 * механическое, ничего кроме места жительства не изменилось.
 *
 * `initialSchools` приходит из page.tsx уже готовым. Зачем — см. там же.
 */
export function LoginScreen({ initialSchools }: { initialSchools: PublicSchool[] | null }) {
  const { locale } = useLocale();

  // 07.08.2026 — зонированный layout: верх / центр / низ, все три зоны В
  // ПОТОКЕ одной flex-колонки высотой ровно во вьюпорт.
  //
  // Было: сетка `min-h-screen` в потоке, а переключатель языка и BottomBar —
  // `fixed`, то есть вне потока. Фиксированные блоки не резервируют под себя
  // места, поэтому места им никто и не оставлял: на экранах меньшей высоты
  // карточка входа доезжала до нижней кромки и кнопки сторов наезжали на блок
  // «Или войдите через», а переключатель языка садился на верх карточки.
  // Внутри самого BottomBar копирайт был `absolute left-1/2 top-1/2` — он
  // пересекался с карточкой «Безопасно» и кнопками по той же причине.
  //
  // Теперь верх и низ — обычные `shrink-0` строки, центр — `flex-1 min-h-0`.
  // Наложение стало структурно невозможным: каждая зона занимает своё место,
  // а сжимается только центральная. `h-screen overflow-hidden` на корне
  // гарантирует отсутствие скролла страницы, о чём просили отдельно.
  return (
    <div className={`${montserrat.className} relative flex h-screen w-full flex-col overflow-hidden`}>
      <BackgroundArt />

      {/* ВЕРХ — переключатель языка. z-40 выше карточки формы (z-30), меню
          раскрывается вниз (см. LanguageSelector.tsx). */}
      <div className="relative z-40 flex shrink-0 justify-end px-4 pt-4 [@media(max-height:760px)]:pt-2 sm:px-6 sm:pt-5 lg:px-16">
        <LanguageSelector />
      </div>

      {/* ЦЕНТР — единственная сжимаемая зона. min-h-0 обязателен: без него
          flex-элемент не может стать меньше своего содержимого и низ уехал бы
          за кромку ровно как раньше. */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="hidden min-h-0 flex-col justify-center overflow-hidden px-16 lg:flex">
          <BrandingColumn locale={locale} />
        </div>

        <div className="flex min-h-0 items-center justify-center overflow-y-auto px-6 py-2 [@media(max-height:760px)]:py-0 lg:px-12">
          {/* 18.08.2026 — ЗДЕСЬ БЫЛ <Suspense fallback={null}>, И ОН СТОИЛ
              КАРТОЧКЕ ВСЕЙ ЗАДЕРЖКИ.

              Граница Suspense появилась не по нужде, а по требованию Next.js:
              внутри формы стоял useSearchParams(), а его без такой границы
              собрать нельзя. Побочное действие оказалось дороже пользы —
              компонент, читающий адресную строку, при статической сборке из
              пререндера исключается, и в готовый HTML вместо карточки
              укладывается fallback. Fallback был null, то есть пустота.
              Проверено на проде: в теле страницы не было ни одного поля формы.

              Границы больше нет, потому что нет и причины для неё: форма
              адресную строку теперь читает после монтирования (см. подробный
              разбор в LoginForm.tsx). Карточка приезжает готовой вместе со
              страницей.

              ЕСЛИ БУДЕШЬ ВОЗВРАЩАТЬ SUSPENSE — fallback={null} не ставь
              никогда. Пустой fallback здесь означает «правая половина экрана
              пустая, пока не выполнится весь JS», и выглядит это ровно как
              зависшая страница. */}
          <LoginForm locale={locale} initialSchools={initialSchools} />
        </div>
      </div>

      {/* НИЗ */}
      <BottomBar locale={locale} />
    </div>
  );
}
