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
  Library,
  Lightbulb,
  Map,
  Monitor,
  Music,
  Palette,
  Rocket,
  Scroll,
  Target,
  TreePine,
  Users,
  type LucideIcon,
} from "lucide-react";

/** subjects.icon (lucide name из БД) → компонент. Общий для Dashboard и Уроков.
 *  Lightbulb/Target/Rocket добавлены для обогащённых слайдов (Большой фикс,
 *  Блок 6, Задача 2, SlideBody.tsx) — тот же реестр, не заводим отдельный.
 *
 *  Z.2.2: добавлена Library. Пикер иконок в админке предлагал её с самого
 *  начала, но её не было НИ В ОДНОМ из двух реестров рендера (здесь и
 *  ICON_MAP в components/LessonCard.tsx), поэтому выбранная Library молча
 *  подменялась на BookOpen везде. Оба реестра теперь синхронизированы —
 *  держать их одинаковыми обязательно, иначе следующая иконка снова тихо
 *  пропадёт. */
export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Bot, BookOpen, Code, Calculator, Languages, Monitor, Atom, Leaf, FlaskConical, Scroll,
  BookText, Globe, Map, Dumbbell, Music, Palette, Hammer, TreePine, Users,
  Lightbulb, Target, Rocket, Library,
};
