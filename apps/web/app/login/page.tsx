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
    // Без min-h-screen: раньше он и здесь ("на всякий случай", контент почти
    // всегда короче) незаметно доминировал над реальной высотой контента, и
    // именно ОН — а не что-либо внутри грида — раздувал высоту страницы до
    // 100vh пре-скейл (см. комментарий у грида ниже). При активном
    // ScaleWrapper (fitHeight=false) эта раздутая пре-скейл высота после
    // scale() уводила fixed-футер (BottomBar, containing block — сама
    // ScaleWrapper-обёртка) далеко за пределы видимой области. Теперь высота
    // страницы = высоте реального контента; минимальное покрытие фона на
    // случай короткого контента гарантирует min-h-screen ВНУТРИ BackgroundArt
    // (см. её комментарий), а не здесь.
    <div className={`${montserrat.className} relative w-full overflow-x-hidden`}>
      <BackgroundArt />

      {/* Переключатель языка — правый верхний угол страницы, НАД карточкой
          формы (та начинается с отступом pt-16/20/24 сверху, так что верх
          экрана свободен). fixed + свой z-40 (карточка формы — z-30),
          выпадающее меню раскрывается ВНИЗ (см. LanguageSelector.tsx) —
          уместно для триггера у верха экрана. */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-end px-4 sm:top-6 sm:px-6 lg:top-8 lg:px-16">
        <div className="pointer-events-auto">
          <LanguageSelector />
        </div>
      </div>

      {/* Раньше — grid min-h-screen 2 колонки, форма центрировалась ТОЛЬКО
          внутри своей (правой) половины через items-center на min-h-screen.
          На >1920 ScaleWrapper (fitHeight=false, transform от top-left)
          масштабирует ширину, но vh считается от РЕАЛЬНОГО вьюпорта — центр
          правой половины съезжал за нижнюю границу экрана на широких
          мониторах (3440 и т.п., см. resheniya_2.md, "форма оказалась внизу
          за экраном"). Теперь: без min-h-screen на этом блоке (высота по
          контенту, не по vh) — верхний отступ в rem/px растёт вместе со
          scale() пропорционально всему остальному вместо непропорционального
          съезда вниз. Логотип остаётся слева отдельной колонкой, форма — в
          истинном центре ВСЕЙ страницы (grid 1fr/auto/1fr), а не "центр
          своей половины". На планшете/мобильном (карточка логина иногда
          выше типичного экрана) высота по-прежнему свободная — обычный
          скролл при необходимости, без обрезки. */}
      <div className="relative z-10 grid grid-cols-1 justify-items-center gap-10 px-6 pb-32 pt-16 sm:pt-20 lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-8 lg:px-12 lg:pt-24 xl:px-16">
        <div className="hidden overflow-hidden lg:flex lg:justify-self-start lg:pt-2">
          <BrandingColumn locale={locale} />
        </div>

        <div className="flex w-full justify-center lg:col-start-2 lg:w-auto">
          <Suspense fallback={null}>
            <LoginForm locale={locale} />
          </Suspense>
        </div>

        {/* Пустая 3-я колонка — балансирует grid-cols-[1fr_auto_1fr], чтобы
            форма стояла ровно по центру страницы, а не "по центру места,
            оставшегося после логотипа". */}
        <div aria-hidden className="hidden lg:block" />
      </div>

      <BottomBar locale={locale} />
    </div>
  );
}
