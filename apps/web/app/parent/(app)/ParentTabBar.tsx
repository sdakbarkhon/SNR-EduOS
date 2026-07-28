"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Wallet, MessageCircle, User } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { glass1Css, glassBorder, accent, ink3 } from "@/lib/parent/glass-tokens";

const TABS = [
  { href: "/parent/home", icon: Home, key: "home" as const },
  { href: "/parent/progress", icon: TrendingUp, key: "grades" as const },
  { href: "/parent/payments", icon: Wallet, key: "payments" as const },
  { href: "/parent/messages", icon: MessageCircle, key: "messages" as const },
  { href: "/parent/profile", icon: User, key: "profile" as const },
];

export function ParentTabBar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const nav = getDictionary(locale as Locale).parentApp.nav;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[430px] items-center justify-around px-4 py-3"
      style={{ ...glass1Css, borderTop: `1px solid ${glassBorder}` }}
    >
      {TABS.map(({ href, icon: Icon, key }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 px-2 text-[11px] font-medium"
            style={{ color: active ? accent : ink3 }}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            {nav[key]}
          </Link>
        );
      })}
    </nav>
  );
}
