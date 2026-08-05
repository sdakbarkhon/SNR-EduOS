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

import { useEffect } from "react";
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

/**
 * Внутренние (не-корневые) сегменты /parent, сгруппированные по «родительскому»
 * табу. РАНЬШЕ активный таб определялся одним `pathname.startsWith(t.key)` по
 * TABS — это верно только для самих 5 корневых экранов и их прямых подпутей
 * (/parent/payments/top-up и т.п.), но /parent/documents, /parent/child,
 * /parent/chat/[id], /parent/attendance и т.д. — ОТДЕЛЬНЫЕ сегменты, ни с
 * одним ключом TABS не совпадающие, поэтому startsWith проваливался на всех
 * них и код тихо падал в `?? TABS[0]!.key` — «Главная» подсвечивалась
 * независимо от того, где реально находится родитель.
 */
const SECTION_TABS: readonly { prefix: string; tab: string }[] = [
  // Профиль и всё, что открывается ИЗ профиля.
  { prefix: "/parent/documents", tab: "/parent/profile" },
  { prefix: "/parent/notif-settings", tab: "/parent/profile" },
  { prefix: "/parent/lang-security", tab: "/parent/profile" },
  { prefix: "/parent/about", tab: "/parent/profile" },
  { prefix: "/parent/child", tab: "/parent/profile" },
  // Сообщения: сама вкладка, переписка и уведомления (открываются из шапки
  // «Главной», но по смыслу — тот же почтовый ящик, что и «Сообщения»).
  { prefix: "/parent/chat", tab: "/parent/messages" },
  { prefix: "/parent/notifications", tab: "/parent/messages" },
  // Успехи: оценки/предметы/посещаемость/отзывы.
  { prefix: "/parent/subjects", tab: "/parent/progress" },
  { prefix: "/parent/subject", tab: "/parent/progress" },
  { prefix: "/parent/attendance", tab: "/parent/progress" },
  { prefix: "/parent/reviews", tab: "/parent/progress" },
];

/** Активный таб по текущему пути. Порядок: сами TABS → SECTION_TABS →
 *  «Главная» — прямые совпадения (/parent/payments/top-up и т.п.) не должны
 *  зависеть от порядка проверки внутренних сегментов. */
function activeTabKey(pathname: string): string {
  const direct = TABS.find((t) => pathname.startsWith(t.key));
  if (direct) return direct.key;
  const section = SECTION_TABS.find((s) => pathname.startsWith(s.prefix));
  if (section) return section.tab;
  return TABS[0]!.key;
}

export function ParentTabsV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const nav = getDictionary(locale as Locale).parentApp.nav;

  const unread = getUnreadMessageThreadsCount();

  // ПЕРФ (задача «убрать 2-3 сек задержку между экранами»): таб-бар — это
  // <button onClick={router.push}>, НЕ <Link>, значит у него нет вообще
  // никакого автопрефетча Next.js (ни на hover, ни на появление во
  // вьюпорте) — а это самая частая навигация во всём /parent, видна на
  // каждом экране. RootHeader рядом уже прогревает так же руками
  // (HomeView.tsx: router.prefetch(R.notifications/profile)) — тот же приём,
  // применённый ко всем пяти вкладкам сразу при монтировании бара.
  useEffect(() => {
    for (const t of TABS) router.prefetch(t.key);
  }, [router]);

  const items: FloatingTabItem[] = TABS.map(({ key, Icon, navKey }) => ({
    key,
    label: nav[navKey],
    // Цвет — через style, а НЕ через проп `color`: lucide кладёт color прямо в
    // presentation-атрибут <svg stroke>, а браузеры не разрешают там var().
    // После темизации сюда приезжает var(--p-tab-inactive, …), и с атрибутом
    // четыре из пяти иконок таб-бара стали бы бесцветными — в ОБЕИХ темах и на
    // каждом экране. Тот же приём уже стоит у колокольчика в RootHeader.
    icon: (color: string) => <Icon size={20} strokeWidth={1.9} style={{ stroke: color }} />,
    badge: key === "/parent/messages" ? unread : undefined,
  }));

  const active = activeTabKey(pathname);

  return <FloatingTabBar items={items} activeKey={active} onSelect={(k) => router.push(k)} />;
}
