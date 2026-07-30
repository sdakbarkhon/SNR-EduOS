"use client";

import { useMemo, useRef, useState, type UIEvent } from "react";
import Image from "next/image";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { FeaturesSheet } from "./FeaturesSheet";
import { LangButton } from "./LangButton";
import { ink1, ink2, ink3 } from "@/lib/parent/glass-tokens";
import { status } from "@/app/parent/(app)/v2/tokens";

const SLIDE_COUNT = 3;
/** Активная точка пагинации — оранжевый из градиента кнопки «Начать».
 *  Сигнальный цвет, одинаково читается на светлой и тёмной странице. */
const DOT_ACTIVE = "#f97316";

/**
 * Онбординг — карусель из 3 слайдов, 1:1 с apps/mobile-parent
 * OnboardingScreen: лого+тэглайн и hero-иллюстрация общие для всех слайдов
 * (не свайпаются), свайпается только заголовок+subtitle. Свайп — нативный
 * CSS scroll-snap (реальный touch-скролл на телефоне, не JS drag). Кнопка
 * «Начать» доступна на любом слайде (как в приложении — не «Далее»).
 */
export function OnboardingCarousel({ onStart }: { onStart: () => void }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).parentApp.auth;

  const [activeIndex, setActiveIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const slides = useMemo(
    () => [
      { title: t.heroTitle, sub: t.heroSub },
      { title: t.heroTitle2, sub: t.heroSub2 },
      { title: t.heroTitle3, sub: t.heroSub3 },
    ],
    [t.heroTitle, t.heroSub, t.heroTitle2, t.heroSub2, t.heroTitle3, t.heroSub3],
  );

  function goToSlide(index: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  }

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(SLIDE_COUNT - 1, Math.max(0, index));
    setActiveIndex((prev) => (prev === clamped ? prev : clamped));
  }

  return (
    <div className="relative flex flex-1 flex-col px-6 pb-8 pt-12">
      {/* Язык/Тема — правый верхний угол, поверх центрированного лого-блока. */}
      <div className="absolute right-5 top-5 z-10">
        <LangButton />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <Image src="/parent/logo-mark.png" alt="" width={38} height={38} priority />
          <span className="text-[19px] font-bold" style={{ color: ink1 }}>
            SNR EduOS
          </span>
        </div>
        <span
          className="text-[9.5px] font-extrabold uppercase tracking-[0.11em]"
          style={{ color: ink3, opacity: 0.9 }}
        >
          {t.tagline}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <div className="relative h-[240px] w-[240px] max-w-[82%]">
          <Image src="/parent/onboarding-hero.png" alt="" fill className="object-contain" priority />
        </div>

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-2 flex w-full snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full shrink-0 snap-center px-1.5">
              <h1
                className="text-center text-[19px] font-bold leading-[1.35]"
                style={{ color: ink1 }}
              >
                {slide.title}
              </h1>
              <p
                className="mt-1.5 text-center text-[11.5px] font-semibold leading-[1.45]"
                style={{ color: ink2 }}
              >
                {slide.sub}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3.5 flex items-center justify-center gap-1.5">
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Слайд ${i + 1}`}
              onClick={() => goToSlide(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIndex ? 22 : 6,
                background: i === activeIndex ? DOT_ACTIVE : ink3,
                opacity: i === activeIndex ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="relative flex w-full items-center justify-center overflow-hidden px-5 py-4 text-[14.5px] font-extrabold text-white active:opacity-90"
        style={{
          borderRadius: 18,
          background: "linear-gradient(120deg, #f97316, #ec4899)",
          boxShadow: "0 14px 34px rgba(236,72,153,0.4)",
        }}
      >
        {t.start}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
        />
      </button>
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        className="pb-0.5 pt-1.5 text-center text-[12px] font-extrabold"
        style={{ color: status.violet.text }}
      >
        {t.learnMore}
      </button>

      <FeaturesSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
