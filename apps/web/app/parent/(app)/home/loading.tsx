import { GlassCard } from "@/components/parent/glass/GlassCard";

function Bar({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      className="animate-pulse rounded-full bg-black/10"
      style={{ width, height }}
    />
  );
}

/** Скелетон «Главной» на время загрузки серверного компонента. */
export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Bar width="70%" height={22} />
        <Bar width="55%" height={14} />
      </div>
      <GlassCard className="h-[150px] w-full">{null}</GlassCard>
      <GlassCard className="h-[76px] w-full">{null}</GlassCard>
      <div className="flex gap-3">
        <GlassCard className="h-[90px] flex-1">{null}</GlassCard>
        <GlassCard className="h-[90px] flex-1">{null}</GlassCard>
      </div>
      <GlassCard className="h-[140px] w-full">{null}</GlassCard>
    </div>
  );
}
