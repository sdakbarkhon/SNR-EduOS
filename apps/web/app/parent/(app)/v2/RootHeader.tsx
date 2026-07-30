"use client";

/**
 * Блок 7.1 — шапка корневых экранов (табов), веб-версия.
 *
 * Перенос 1:1 из apps/mobile-parent/src/ui/RootHeader.tsx (ветка
 * feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»:
 *   П5 (строки 220–224): row gap 10, padding 46/18/8; знак логотипа 32×32
 *     (три треугольника, прозрачный фон) + «SNR EduOS» ОТДЕЛЬНЫМ текстом
 *     Unbounded 14/600 цветом ink1 (намеренно не вшито в картинку);
 *     справа — круглая стеклянная кнопка колокольчика 38 (160° W72→W46,
 *     blur 18, border W80; глиф 17 stroke 1.8) с бейджем 17 (top -3 right -3)
 *     и аватар 38 (градиент 135°, кольцо 0 0 0 2px #fff, инициалы 12/800);
 *   П10/П17 (строки 274–278, 377–380): та же шапка, заголовок Unbounded 17/600,
 *     на П17 без лого.
 *
 * Платформенные отличия: paddingTop в RN был max(safe-area, 46) — здесь
 * max(env(safe-area-inset-top), 46px); колокольчик — lucide-react Bell
 * вместо inline-SVG макета (та же геометрия 17px / stroke 1.8).
 *
 * ТЁМНАЯ ТЕМА. Стекло кнопки-колокольчика берётся из общих токенов
 * (glass-1 + glass-border), иначе в тёмной теме белый глиф ink1 оказался бы
 * на белом круге. Цвет самого глифа задан style-свойством `stroke`, а не
 * prop-ом `color`: lucide кладёт color в ПРЕЗЕНТАЦИОННЫЙ атрибут <svg stroke>,
 * а var() в атрибутах SVG браузеры не разрешают — глиф стал бы бесцветным
 * в обеих темах. CSS-свойство stroke атрибут перекрывает.
 */

import Image from "next/image";
import { Bell } from "lucide-react";
import { fontDisplay, glass1, glassBorder, ink1, accentGrad } from "./tokens";

export function RootHeader({
  title = "SNR EduOS",
  showLogo = true,
  titleSize = 14,
  bellBadge,
  initials,
  onBell,
  onAvatar,
}: {
  title?: string;
  showLogo?: boolean;
  /** 14 для П5 (с лого), 17 для П10/П17 (экранный заголовок). */
  titleSize?: number;
  bellBadge?: number;
  initials?: string;
  onBell?: () => void;
  onAvatar?: () => void;
}) {
  return (
    <header
      className="flex items-center"
      style={{
        gap: 10,
        paddingTop: "max(env(safe-area-inset-top), 46px)",
        paddingInline: 18,
        paddingBottom: 8,
      }}
    >
      {showLogo && (
        <Image
          src="/parent/logo-mark.png"
          alt=""
          width={32}
          height={32}
          className="shrink-0 object-contain"
        />
      )}
      <span style={{ fontFamily: fontDisplay, fontSize: titleSize, fontWeight: 600, color: ink1 }}>
        {title}
      </span>

      <div className="ml-auto flex items-center" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={onBell}
          aria-label="Уведомления"
          className="relative flex items-center justify-center transition-transform active:scale-95"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: glass1.background,
            border: `1px solid ${glassBorder}`,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <Bell size={17} strokeWidth={1.8} style={{ stroke: ink1 }} />
          {bellBadge ? (
            <span
              className="absolute flex items-center justify-center font-extrabold text-white"
              style={{
                top: -3,
                right: -3,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                background: "#EF4444",
                fontSize: 10,
                paddingInline: 4,
              }}
            >
              {bellBadge}
            </span>
          ) : null}
        </button>

        {initials !== undefined && (
          <button
            type="button"
            onClick={onAvatar}
            aria-label="Профиль"
            className="flex items-center justify-center text-white transition-transform active:scale-95"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: accentGrad,
              boxShadow: "0 0 0 2px #fff",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {initials}
          </button>
        )}
      </div>
    </header>
  );
}
