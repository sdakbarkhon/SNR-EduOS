import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Home,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@snr/core";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  label: (d: Dictionary) => string;
}

/** Пункты навигации Must-have (sidebar на desktop, нижний таб-бар на мобиле). */
export const navItems: NavItem[] = [
  { key: "home", href: "/dashboard", icon: Home, label: (d) => d.nav.home },
  { key: "lessons", href: "/schedule", icon: CalendarDays, label: (d) => d.nav.lessons },
  { key: "homework", href: "/homework", icon: ClipboardList, label: (d) => d.nav.homework },
  { key: "attendance", href: "/attendance", icon: CheckSquare, label: (d) => d.nav.attendance },
  { key: "payments", href: "/payments", icon: Wallet, label: (d) => d.nav.payments },
  { key: "profile", href: "/profile", icon: User, label: (d) => d.nav.profile },
];
