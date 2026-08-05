import { GlassCard } from "@/components/parent/glass/GlassCard";

function Bar({ width = "100%", height = 12 }: { width?: string; height?: number }) {
  return (
    <div
      className="animate-pulse rounded-full"
      style={{ width, height, background: "var(--p-track, rgba(23,18,67,0.08))" }}
    />
  );
}

/** Скелетон «Профиля» — карточка родителя, карточка ребёнка, два списка
 *  меню (Настройки/Поддержка), кнопка «Выйти». См. ProfileView.tsx. */
export default function ProfileLoading() {
  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      <Bar width="35%" height={18} />
      <GlassCard className="h-[78px] w-full">{null}</GlassCard>
      <GlassCard className="h-[62px] w-full">{null}</GlassCard>
      <Bar width="25%" height={11} />
      <GlassCard className="h-[190px] w-full">{null}</GlassCard>
      <Bar width="25%" height={11} />
      <GlassCard className="h-[96px] w-full">{null}</GlassCard>
      <GlassCard className="h-[48px] w-full">{null}</GlassCard>
    </div>
  );
}
