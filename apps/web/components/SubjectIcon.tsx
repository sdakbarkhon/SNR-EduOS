import {
  Atom,
  Bot,
  BookOpen,
  Calculator,
  CircuitBoard,
  Code2,
  FlaskConical,
  Globe,
  Languages,
  Leaf,
  Microscope,
  Monitor,
  Music,
  Palette,
  Scroll,
  TreePine,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getSubjectStyle } from "@snr/core";

const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  monitor: Monitor,
  calculator: Calculator,
  atom: Atom,
  languages: Languages,
  scroll: Scroll,
  leaf: Leaf,
  "flask-conical": FlaskConical,
  "book-open": BookOpen,
  "code-2": Code2,
  // 04.09.2026 — семь предметов, дописанных в словарь. Без строки здесь
  // значок молча падает на книгу: не поломка, но и не то, что имели в виду.
  microscope: Microscope,
  "circuit-board": CircuitBoard,
  "tree-pine": TreePine,
  palette: Palette,
  music: Music,
  globe: Globe,
  users: Users,
};

/** Resolves a subject to its lucide icon + color, no wrapper/background — for embedding inside an already-styled container (colored tile, gradient cover). */
export function resolveSubjectIcon(subject: string | null): { Icon: LucideIcon; color: string } {
  const s = getSubjectStyle(subject);
  return { Icon: ICONS[s.icon] ?? BookOpen, color: s.color };
}

export function SubjectIcon({
  subject,
  size = 40,
}: {
  subject: string | null;
  size?: number;
}) {
  const s = getSubjectStyle(subject);
  const Icon = ICONS[s.icon] ?? BookOpen;
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: `${s.color}1A`,
        color: s.color,
        borderRadius: 14,
      }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
