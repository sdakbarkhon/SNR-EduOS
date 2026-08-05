import { GlassCard } from "@/components/parent/glass/GlassCard";

/**
 * Скелетон-заглушка на весь сегмент /parent/(app) — общий предохранитель для
 * маршрутов БЕЗ своего loading.tsx (home/progress/payments/messages/profile
 * держат отдельные, под свою разметку — см. соседние файлы).
 *
 * ПЕРФ (задача «убрать 2-3 сек задержку между экранами»): дело не только в
 * визуальном «не пусто». /parent/** — полностью динамические страницы
 * (used cookies() везде), а у Next.js App Router для ДИНАМИЧЕСКИХ маршрутов
 * дефолтный prefetch у <Link> прогревает СТАТИЧЕСКУЮ ОБОЛОЧКУ только ДО
 * ближайшей границы loading.js — без loading.tsx этой границы нет вообще, и
 * прогревать нечего. До этой правки её имели только 2 маршрута из ~20 —
 * значит на остальных дефолтный prefetch <Link> был фактически no-op.
 * Наличие этого файла — не косметика, а условие, при котором Next.js вообще
 * начинает что-то прогревать заранее для всех остальных сегментов.
 */
function Bar({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      className="animate-pulse rounded-full"
      style={{ width, height, background: "var(--p-track, rgba(23,18,67,0.08))" }}
    />
  );
}

export default function ParentSegmentLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center gap-3">
        <div
          className="animate-pulse shrink-0 rounded-full"
          style={{ width: 38, height: 38, background: "var(--p-track, rgba(23,18,67,0.08))" }}
        />
        <Bar width="45%" height={18} />
      </div>
      <GlassCard className="h-[120px] w-full">{null}</GlassCard>
      <div className="flex flex-col gap-2">
        <Bar width="30%" height={11} />
        <GlassCard className="h-[220px] w-full">{null}</GlassCard>
      </div>
    </div>
  );
}
