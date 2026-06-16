import {
  File,
  FileCode,
  FileText,
  Link2,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import { colors } from "@snr/ui-tokens";

const TYPE_ICON: Record<string, LucideIcon> = {
  pdf: FileText,
  video: Video,
  link: Link2,
  presentation: Presentation,
  code: FileCode,
};

export function MaterialTile({
  title,
  type,
  meta,
  layout = "card",
}: {
  title: string;
  type?: string | null;
  meta?: string;
  layout?: "card" | "row";
}) {
  const Icon = (type && TYPE_ICON[type]) || File;
  const iconEl = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: 40,
        height: 40,
        backgroundColor: colors.bgAppAlt,
        color: colors.primary,
      }}
    >
      <Icon size={20} />
    </span>
  );

  if (layout === "row") {
    return (
      <div className="flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white/50">
        {iconEl}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-gray-700">
            {title}
          </div>
          {meta && <div className="text-xs text-gray-400">{meta}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-bg-card p-4 shadow-card">
      {iconEl}
      <div className="line-clamp-2 text-sm font-medium text-text-primary">
        {title}
      </div>
      {meta && <div className="text-xs text-text-muted">{meta}</div>}
    </div>
  );
}
