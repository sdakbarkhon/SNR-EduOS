"use client";

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

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="hidden flex-col justify-center px-16 py-12 lg:flex">
          <BrandingColumn locale={locale} />
        </div>

        <div className="flex items-center justify-center p-6 pb-40 lg:p-12">
          <LoginForm locale={locale} />
        </div>
      </div>

      <BottomBar locale={locale} />
    </div>
  );
}
