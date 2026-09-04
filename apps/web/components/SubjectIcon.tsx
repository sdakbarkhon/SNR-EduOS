import { resolveSubject } from "@snr/core";
import { subjectIconByName } from "@/lib/subject-icons";
import type { LucideIcon } from "lucide-react";

// 04.09.2026 — СВОЕГО РЕЕСТРА ЗНАЧКОВ ЗДЕСЬ БОЛЬШЕ НЕТ.
//
// Он был третьим по счёту и единственным в написании kebab-case, тогда как в
// базе значки лежат PascalCase. Разбор — в шапке lib/subject-icons.ts; сюда
// реестр не вернётся, ему место одно.

/** Resolves a subject to its lucide icon + color, no wrapper/background — for embedding inside an already-styled container (colored tile, gradient cover). */
export function resolveSubjectIcon(subject: string | null): { Icon: LucideIcon; color: string } {
  const s = resolveSubject({ slug: subject });
  return { Icon: subjectIconByName(s.icon), color: s.color };
}

export function SubjectIcon({
  subject,
  size = 40,
}: {
  subject: string | null;
  size?: number;
}) {
  const s = resolveSubject({ slug: subject });
  const Icon = subjectIconByName(s.icon);
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
