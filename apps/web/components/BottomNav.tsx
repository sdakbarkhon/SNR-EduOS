"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { useLocale } from "./LocaleProvider";
import { navItems } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t px-2 py-1 backdrop-blur-xl md:hidden" style={{ background: "var(--bottomnav-bg)", borderColor: "var(--bottomnav-border)" }}>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]"
            style={{ color: active ? colors.primary : colors.textMuted }}
          >
            <Icon size={20} />
            <span>{item.label(d)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
