"use client";

/**
 * Блок 7.2 — шапка ВНУТРЕННИХ экранов веб-родителя (со стрелкой «назад»).
 *
 * Эталон 1:1 — apps/mobile-parent/src/ui/InnerHeader.tsx (ветка
 * feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»
 * (шапки внутренних экранов, напр. строки 687–690):
 *   row gap 12, padding 46/18/8; круглая стеклянная back-кнопка 38
 *   (160° W72→W46, blur 18, border W80; глиф-стрелка 18 stroke 2);
 *   заголовок Unbounded 15/600 flex 1 (на части экранов 16 — через prop);
 *   опциональный правый слот.
 *
 * Отличия от RN (платформа): paddingTop = max(env(safe-area-inset-top), 46px)
 * вместо useSafeAreaInsets(); «назад» — <Link> на явный родительский маршрут,
 * если он задан (детерминированно и работает при заходе по прямой ссылке),
 * иначе router.back().
 *
 * RootHeader из ../v2 не переиспользуется намеренно: там ДРУГАЯ шапка —
 * корневых табов (лого + колокольчик + аватар), без кнопки «назад».
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fontDisplay, ink1 } from "../v2/tokens";

/** Круглая стеклянная кнопка 38 — та же геометрия, что у колокольчика
 *  RootHeader (макет: 160° W72→W46, blur 18, border W80). */
export const GLASS_CIRCLE_STYLE = {
  width: 38,
  height: 38,
  borderRadius: 19,
  background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46))",
  border: "1px solid rgba(255,255,255,0.80)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
} as const;

export function GlassCircle({
  children,
  onClick,
  href,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  label: string;
}) {
  const cls =
    "flex shrink-0 items-center justify-center transition-transform active:scale-95";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls} style={GLASS_CIRCLE_STYLE}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls} style={GLASS_CIRCLE_STYLE}>
      {children}
    </button>
  );
}

/** Стрелка «назад» 18 stroke 2 (макет строка 688). */
function BackArrow() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink1}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function InnerHeader({
  title,
  titleSize = 15,
  backHref,
  right,
}: {
  title: string;
  /** 15 (по умолчанию) или 16 — как в макете. */
  titleSize?: 15 | 16;
  /** Явный родительский маршрут. Без него — history.back(). */
  backHref?: string;
  right?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header
      className="flex items-center"
      style={{
        gap: 12,
        paddingTop: "max(env(safe-area-inset-top), 46px)",
        paddingInline: 18,
        paddingBottom: 8,
      }}
    >
      <GlassCircle label="Назад" href={backHref} onClick={backHref ? undefined : () => router.back()}>
        <BackArrow />
      </GlassCircle>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ fontFamily: fontDisplay, fontSize: titleSize, fontWeight: 600, color: ink1 }}
      >
        {title}
      </span>
      {right}
    </header>
  );
}
