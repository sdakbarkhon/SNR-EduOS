import { GlassCard } from "@/components/parent/glass/GlassCard";

/** Скелетон «Оплат» на время загрузки серверного компонента — под форму
 *  реального экрана (RootHeader, кошелёк/долг-плитки, список счетов,
 *  строка автоплатежа). См. PaymentsView.tsx для точной композиции. */
export default function PaymentsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center gap-3">
        <div
          className="animate-pulse rounded-full"
          style={{ width: 30, height: 22, background: "var(--p-track, rgba(23,18,67,0.08))" }}
        />
        <div
          className="animate-pulse rounded-full"
          style={{ width: 30, height: 30, background: "var(--p-track, rgba(23,18,67,0.08))" }}
        />
      </div>
      <div className="flex gap-3">
        <GlassCard className="h-[110px] flex-1">{null}</GlassCard>
        <GlassCard className="h-[110px] flex-1">{null}</GlassCard>
      </div>
      <GlassCard className="h-[150px] w-full">{null}</GlassCard>
      <GlassCard className="h-[64px] w-full">{null}</GlassCard>
    </div>
  );
}
