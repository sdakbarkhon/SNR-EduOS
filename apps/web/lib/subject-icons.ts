import {
  Atom,
  BookOpen,
  BookText,
  Bot,
  Calculator,
  Code,
  Dumbbell,
  FlaskConical,
  Globe,
  Hammer,
  Languages,
  Leaf,
  Map,
  Monitor,
  Music,
  Palette,
  Scroll,
  TreePine,
  Users,
  type LucideIcon,
} from "lucide-react";

/** subjects.icon (lucide name из БД) → компонент. Общий для Dashboard и Уроков. */
export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Bot, BookOpen, Code, Calculator, Languages, Monitor, Atom, Leaf, FlaskConical, Scroll,
  BookText, Globe, Map, Dumbbell, Music, Palette, Hammer, TreePine, Users,
};
