import {
  Atom,
  BookOpen,
  BookText,
  Bot,
  Calculator,
  CircuitBoard,
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
  Microscope,
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

/**
 * ЕДИНЫЙ РЕЕСТР ЗНАЧКОВ ПРЕДМЕТА. 04.09.2026.
 *
 * ═══ БЫЛО ТРИ, СТАЛО ОДИН ═════════════════════════════════════════════════
 *
 * Реестров было три, и написание в них не совпадало:
 *
 *   components/SubjectIcon.tsx   ключи kebab-case: bot, code-2, flask-conical
 *   lib/subject-icons.ts         ключи PascalCase: Bot, Code, FlaskConical
 *   components/LessonCard.tsx    ключи PascalCase, свой список из 23 штук
 *
 * А в БАЗЕ (`school_subjects.icon`, `subjects.icon`) написание PascalCase —
 * его выбирает админ из своего списка. Экран, спрашивавший kebab-реестр
 * значением из базы, не находил ничего и рисовал книгу; экран, спрашивавший
 * PascalCase-реестр значением из словаря кода, — тоже.
 *
 * Один из трёх уже подводил: `Library` предлагалась админу, но её не было ни
 * в одном реестре, и выбранная библиотека молча превращалась в книгу.
 *
 * ═══ ЧТО ТЕПЕРЬ ═══════════════════════════════════════════════════════════
 *
 * Реестр один, ключи — те же, что в базе (PascalCase). Написание словаря кода
 * (kebab-case) принимается через таблицу соответствий: словарь уходит в конце
 * этой цепочки заходов, и пока он жив, его значения обязаны рисоваться.
 *
 * СПИСОК, КОТОРЫЙ ВИДИТ АДМИН, БЕРЁТСЯ ОТСЮДА ЖЕ (см. ICON_NAMES) — выбрать
 * значок, которого приложение не умеет рисовать, теперь физически нельзя.
 */
export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Atom, BookOpen, BookText, Bot, Calculator, CircuitBoard, Code, Dumbbell,
  FlaskConical, Globe, Hammer, Languages, Leaf, Library, Lightbulb, Map,
  Microscope, Monitor, Music, Palette, Rocket, Scroll, Target, TreePine, Users,
};

/**
 * Написание словаря кода → написание базы.
 *
 * Нужна, пока жив `packages/core/src/config/subjects.ts`: он держит значки
 * в kebab-case. Уйдёт словарь — уйдёт и таблица; до тех пор без неё значки
 * предметов из словаря падали бы на книгу.
 */
const KEBAB_TO_PASCAL: Record<string, string> = {
  atom: "Atom",
  "book-open": "BookOpen",
  "book-text": "BookText",
  bot: "Bot",
  calculator: "Calculator",
  "circuit-board": "CircuitBoard",
  code: "Code",
  "code-2": "Code",
  dumbbell: "Dumbbell",
  "flask-conical": "FlaskConical",
  globe: "Globe",
  hammer: "Hammer",
  languages: "Languages",
  leaf: "Leaf",
  library: "Library",
  lightbulb: "Lightbulb",
  map: "Map",
  microscope: "Microscope",
  monitor: "Monitor",
  music: "Music",
  palette: "Palette",
  rocket: "Rocket",
  scroll: "Scroll",
  target: "Target",
  "tree-pine": "TreePine",
  users: "Users",
};

/** Имена значков для выбора админом. Список ровно тот, что реестр умеет
 *  нарисовать: третьего списка, который с ним разойдётся, больше нет. */
export const ICON_NAMES: string[] = Object.keys(LUCIDE_ICONS).sort();

/**
 * Значок по имени, в любом из двух написаний. Неизвестное имя — книжка.
 * Запасной вариант записан ОДИН раз, а не по «?? BookOpen» на каждом экране.
 */
export function subjectIconByName(name: string | null | undefined): LucideIcon {
  const ключ = (name ?? "").trim();
  if (!ключ) return BookOpen;
  return LUCIDE_ICONS[ключ] ?? LUCIDE_ICONS[KEBAB_TO_PASCAL[ключ.toLowerCase()] ?? ""] ?? BookOpen;
}
