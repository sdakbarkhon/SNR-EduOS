import {
  Atom,
  Bot,
  BookOpen,
  Calculator,
  FlaskConical,
  Languages,
  Leaf,
  Monitor,
  Scroll,
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
};

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
