import { Montserrat } from "next/font/google";
import { GraduationCap } from "lucide-react";
import { defaultLocale, getDictionary } from "@snr/core";
import { BackgroundArt } from "./BackgroundArt";
import { LoginForm } from "./LoginForm";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function LoginPage() {
  const d = getDictionary(defaultLocale);

  return (
    <div
      className={`${montserrat.className} relative flex h-screen w-full items-center justify-center overflow-hidden bg-brand-navy selection:bg-brand-blue/30`}
    >
      <BackgroundArt />

      <div className="relative z-10 flex h-full w-full max-w-[1440px] flex-col overflow-y-auto px-4 py-6 sm:px-8 xl:px-16">
        <main className="animate-entrance flex w-full flex-1 flex-col items-center justify-center gap-10 py-8 lg:flex-row lg:justify-between lg:gap-0 lg:px-12 lg:py-0 xl:px-24">
          {/* Брендинг */}
          <div className="z-10 flex w-full max-w-[380px] flex-col items-center gap-4 text-center md:max-w-none lg:items-start lg:pr-12 lg:text-left">
            <div
              className="relative flex h-[90px] w-[90px] items-center justify-center rounded-[24px] bg-gradient-to-b from-brand-logo-from to-brand-logo-to ring-1 ring-white/20 md:h-[110px] md:w-[110px] md:rounded-[28px] lg:h-[120px] lg:w-[120px] lg:rounded-[36px]"
              style={{ boxShadow: "0 20px 50px rgba(65,123,255,0.3)" }}
            >
              <GraduationCap
                className="relative z-10 h-12 w-12 text-white drop-shadow-md md:h-14 md:w-14 lg:h-16 lg:w-16"
                strokeWidth={2.5}
              />
            </div>

            <div className="mt-2 flex flex-row items-baseline justify-center gap-3 leading-none md:mt-4 md:gap-4 lg:justify-start">
              <h1 className="text-[52px] font-bold tracking-tight text-white drop-shadow-lg md:text-[68px] lg:text-[80px]">
                SNR
              </h1>
              <h1 className="text-[52px] font-bold tracking-tight text-brand-logo-accent drop-shadow-lg md:text-[68px] lg:text-[80px]">
                EduOS
              </h1>
            </div>

            <p className="mt-1 text-[18px] font-medium tracking-wide text-white/95 drop-shadow-md md:text-[22px] lg:text-[24px]">
              {d.auth.tagline}
            </p>
          </div>

          {/* Карточка входа */}
          <LoginForm />
        </main>

        <footer className="animate-entrance shrink-0 pb-3 pt-6 text-center">
          <p className="text-[14px] font-medium tracking-wide text-white/50">
            © 2026 SNR EduOS. Все права защищены.
          </p>
        </footer>
      </div>
    </div>
  );
}
