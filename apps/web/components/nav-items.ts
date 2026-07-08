import {
  Award,
  BookOpen,
  Briefcase,
  CheckSquare,
  ClipboardList,
  GraduationCap,
  Home,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@snr/core";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  label: (d: Dictionary) => string;
}

/** Пункты навигации (sidebar на desktop, нижний таб-бар на мобиле). */
export const navItems: NavItem[] = [
  { key: "home", href: "/dashboard", icon: Home, label: (d) => d.nav.home },
  { key: "lessons", href: "/lessons", icon: BookOpen, label: (d) => d.nav.lessons },
  { key: "homework", href: "/homework", icon: ClipboardList, label: (d) => d.nav.homework },
  { key: "grades", href: "/grades", icon: Award, label: (d) => d.nav.grades },
  { key: "attendance", href: "/attendance", icon: CheckSquare, label: (d) => d.nav.attendance },
  { key: "knowledgeBase", href: "/knowledge-base", icon: GraduationCap, label: (d) => d.nav.knowledgeBase },
  { key: "projects", href: "/projects", icon: Briefcase, label: (d) => d.nav.projects },
  { key: "ai", href: "/ai-assistant", icon: Sparkles, label: (d) => d.nav.aiAssistant },
  { key: "profile", href: "/profile", icon: Settings, label: (d) => d.nav.profile },
];
