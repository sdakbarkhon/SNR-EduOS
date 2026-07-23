"use client";

import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { useLocale } from "@/components/LocaleProvider";
import { BackgroundArt } from "./BackgroundArt";
import { BrandingColumn } from "./BrandingColumn";
import { LoginForm } from "./LoginForm";
import { BottomBar } from "./BottomBar";
import { MobileAppsSection } from "./MobileAppsSection";

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

      {/* min-h-screen (не h-screen) + без overflow-hidden — на планшете 768
          карточка логина иногда выше 100vh; overflow-hidden на предке ещё и
          обрезал fixed-позиционированный BottomBar (переключатель языка). */}
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

      {/* Отдельный блок «Установить приложение», в обычном потоке документа
          (не задевает центрирование формы логина в гриде выше). pb-32/lg:pb-40
          на самом блоке — запас, чтобы контент не оказался под fixed
          BottomBar (bottom-4), когда пользователь докручивает страницу до конца. */}
      <MobileAppsSection locale={locale} />

      <BottomBar locale={locale} />
    </div>
  );
}
