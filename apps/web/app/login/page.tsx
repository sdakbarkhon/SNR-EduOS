"use client";

import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { useLocale } from "@/components/LocaleProvider";
import { BackgroundArt } from "./BackgroundArt";
import { BrandingColumn } from "./BrandingColumn";
import { LoginForm } from "./LoginForm";
import { BottomBar } from "./BottomBar";

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

        <div className="flex items-center justify-center p-6 pb-28 lg:p-12">
          <Suspense fallback={null}>
            <LoginForm locale={locale} />
          </Suspense>
        </div>
      </div>

      <BottomBar locale={locale} />
    </div>
  );
}
