"use client";

import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { useLocale } from "@/components/LocaleProvider";
import { BackgroundArt } from "./BackgroundArt";
import { BrandingColumn } from "./BrandingColumn";
import { LoginForm } from "./LoginForm";
import { BottomBar } from "./BottomBar";
import { LanguageSelector } from "./LanguageSelector";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function LoginPage() {
  const { locale } = useLocale();

  return (
    <div className={`${montserrat.className} relative min-h-screen w-full overflow-x-hidden`}>
      <BackgroundArt />

      {/* Переключатель языка — правый верхний угол страницы, НАД карточкой
          формы (которая вертикально центрирована в своей колонке, так что
          верх экрана обычно свободен). fixed + свой z-40 (карточка формы —
          z-30), выпадающее меню теперь раскрывается ВНИЗ (см.
          LanguageSelector.tsx) — уместно для триггера у верха экрана. */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-end px-4 sm:top-6 sm:px-6 lg:top-8 lg:px-16">
        <div className="pointer-events-auto">
          <LanguageSelector />
        </div>
      </div>

      {/* min-h-screen (не h-screen) + без overflow-hidden — на планшете 768
          карточка логина иногда выше 100vh; фиксированной высотой её обрезало
          бы. Блок установки приложения (раньше отдельная секция В ПОТОКЕ
          документа ниже этого грида, добавлявшая высоту сверх 100vh и
          вызывавшая скролл) переехал в BottomBar — MobileAppsButtons внутри
          неё, BottomBar как и раньше fixed и не участвует в потоке, так что
          сам по себе грид снова ровно 100vh на обычных десктопных
          разрешениях, без лишнего скролла. */}
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="hidden flex-col justify-center overflow-hidden px-16 py-12 lg:flex">
          <BrandingColumn locale={locale} />
        </div>

        {/* Промт 6.2.3: pt-10 (40px) вместо p-6's 24px — минимальный "воздух"
            над вынесенным логотипом даже в худшем случае (короткий
            viewport, где items-center-центрирование почти не даёт запаса
            сверху сверх самого padding). */}
        <div className="flex items-center justify-center px-6 pt-10 pb-28 lg:p-12">
          <Suspense fallback={null}>
            <LoginForm locale={locale} />
          </Suspense>
        </div>
      </div>

      <BottomBar locale={locale} />
    </div>
  );
}
