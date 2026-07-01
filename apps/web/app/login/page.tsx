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
    <div className={`${montserrat.className} relative h-screen w-full overflow-hidden`}>
      <BackgroundArt />

      <div className="relative z-10 grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-2">
        <div className="hidden h-full flex-col overflow-hidden px-16 py-12 lg:flex">
          <BrandingColumn locale={locale} />
        </div>

        <div className="flex items-center justify-center overflow-hidden p-6 lg:p-12">
          <LoginForm locale={locale} />
        </div>
      </div>

      <BottomBar locale={locale} />
    </div>
  );
}
