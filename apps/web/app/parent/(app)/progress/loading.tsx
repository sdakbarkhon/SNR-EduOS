import { GlassCard } from "@/components/parent/glass/GlassCard";

/** Скелетон «Успехов» на время загрузки серверного компонента. */
export default function ProgressLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <GlassCard className="h-[170px] w-full">{null}</GlassCard>
      <GlassCard className="h-[44px] w-full">{null}</GlassCard>
      <div className="flex gap-2">
        <GlassCard className="h-[90px] flex-1">{null}</GlassCard>
        <GlassCard className="h-[90px] flex-1">{null}</GlassCard>
        <GlassCard className="h-[90px] flex-1">{null}</GlassCard>
      </div>
      <GlassCard className="h-[130px] w-full">{null}</GlassCard>
      <GlassCard className="h-[90px] w-full">{null}</GlassCard>
    </div>
  );
}
