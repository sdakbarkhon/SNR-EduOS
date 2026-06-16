import type { StatusVariant } from "@snr/ui-tokens";
import { StatusChip } from "./StatusChip";
import { SubjectIcon } from "./SubjectIcon";

export function HomeworkCard({
  subject,
  title,
  due,
  status,
}: {
  subject: string | null;
  title: string;
  due?: string | null;
  status?: { variant: StatusVariant; label: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-bg-card p-3 shadow-card">
      <SubjectIcon subject={subject} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-primary">{title}</div>
        {due && <div className="text-xs text-text-muted">{due}</div>}
      </div>
      {status && <StatusChip variant={status.variant}>{status.label}</StatusChip>}
    </div>
  );
}
