import {
  Atom,
  BookOpen,
  Bot,
  Calculator,
  Code,
  FlaskConical,
  Languages,
  Leaf,
  Monitor,
  Scroll,
  type LucideIcon,
} from "lucide-react";

/** subjects.icon (lucide name из БД) → компонент. Общий для Dashboard и Уроков. */
export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Bot, BookOpen, Code, Calculator, Languages, Monitor, Atom, Leaf, FlaskConical, Scroll,
};
