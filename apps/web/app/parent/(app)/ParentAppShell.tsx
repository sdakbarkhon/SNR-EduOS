"use client";

/**
 * Блок 7.1 — каркас табов родителя, пересобран под макет v2.
 *
 * Было (Этап 1, liquid-glass): своя шапка с именем родителя + строка чипов
 * выбора ребёнка + прижатый снизу ParentTabBar. В мобилке v2 этого каркаса
 * нет: там RootHeader (лого + колокольчик + аватар) внутри КАЖДОГО экрана
 * и плавающий FloatingTabBar поверх контента, а выбор ребёнка живёт на
 * «Профиле»/через ChildSwitcherCard, а не отдельной строкой в шапке.
 *
 * Поэтому здесь остаётся только то, что действительно общее: фон страницы
 * (AppBackground) + скролл-контейнер шириной телефона + плавающий таб-бар.
 * Шапку рисует сам экран — так же, как в Expo Go.
 *
 * Ширина: макет — кадр 390px. На телефоне контент занимает всю ширину, на
 * десктопе центрируется колонкой 430px (как «телефон по центру»). Заметка:
 * на ≥640px весь /parent всё равно подменяется QR-гейтом (ViewportGate,
 * см. app/parent/layout.tsx) — это решение «Части A», здесь не трогается.
 */

import type { ReactNode } from "react";
import { AppBackground } from "./v2/AppBackground";
import { ParentTabsV2 } from "./v2/ParentTabsV2";

export function ParentAppShell({ children }: { children: ReactNode }) {
  return (
    <AppBackground>
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {/* pb — высота плавающего таб-бара (≈68) + его отступ снизу (14) + воздух. */}
        <div className="flex-1 pb-[104px]">{children}</div>
      </div>
      <ParentTabsV2 />
    </AppBackground>
  );
}
