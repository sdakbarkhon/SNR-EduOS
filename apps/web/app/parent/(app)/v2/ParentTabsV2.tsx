"use client";

/**
 * Блок 7.1 — привязка FloatingTabBar к маршрутам Next.js.
 *
 * Порядок, иконки и бейдж — 1:1 с apps/mobile-parent/src/navigation/TabNavigator.tsx
 * (ветка feat/mobile-parent-redesign):
 *   p5   Home         → /parent/home      (nav.home)
 *   p10  TrendingUp   → /parent/progress  (nav.grades)
 *   p17  CreditCard   → /parent/payments  (nav.payments)
 *   d24  MessageCircle→ /parent/messages  (nav.messages) + бейдж непрочитанных
 *   dhub User         → /parent/profile   (nav.profile)
 *
 * Иконки в RN — те же самые lucide (lucide-react-native), так что здесь
 * замены нет: 20px, strokeWidth 1.9 — дословно как в RN.
 * Бейдж считается тем же аксессором getUnreadMessageThreadsCount() из
 * скопированного data-слоя, поэтому число совпадает с мобилкой.
 */

import { usePathname, useRouter } from "next/navigation";
import { CreditCard, Home, MessageCircle, TrendingUp, User } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { getUnreadMessageThreadsCount } from "./data";
import { FloatingTabBar, type FloatingTabItem } from "./FloatingTabBar";

const TABS = [
  { key: "/parent/home", Icon: Home, navKey: "home" as const },
  { key: "/parent/progress", Icon: TrendingUp, navKey: "grades" as const },
  { key: "/parent/payments", Icon: CreditCard, navKey: "payments" as const },
  { key: "/parent/messages", Icon: MessageCircle, navKey: "messages" as const },
  { key: "/parent/profile", Icon: User, navKey: "profile" as const },
];

export function ParentTabsV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const nav = getDictionary(locale as Locale).parentApp.nav;

  const unread = getUnreadMessageThreadsCount();

  const items: FloatingTabItem[] = TABS.map(({ key, Icon, navKey }) => ({
    key,
    label: nav[navKey],
    icon: (color: string) => <Icon size={20} strokeWidth={1.9} color={color} />,
    badge: key === "/parent/messages" ? unread : undefined,
  }));

  const active = TABS.find((t) => pathname.startsWith(t.key))?.key ?? TABS[0]!.key;

  return <FloatingTabBar items={items} activeKey={active} onSelect={(k) => router.push(k)} />;
}
