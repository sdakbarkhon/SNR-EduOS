import { GlassCard } from "@/components/parent/glass/GlassCard";

function Row() {
  return (
    <div className="flex items-center gap-3 px-1 py-2.5">
      <div
        className="animate-pulse shrink-0 rounded-full"
        style={{ width: 44, height: 44, background: "var(--p-track, rgba(23,18,67,0.08))" }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div
          className="animate-pulse rounded-full"
          style={{ width: "60%", height: 12, background: "var(--p-track, rgba(23,18,67,0.08))" }}
        />
        <div
          className="animate-pulse rounded-full"
          style={{ width: "85%", height: 10, background: "var(--p-track, rgba(23,18,67,0.08))" }}
        />
      </div>
    </div>
  );
}

/** Скелетон «Сообщений» — список тредов, форма строки как в MessagesView.tsx. */
export default function MessagesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      <div
        className="animate-pulse rounded-full"
        style={{ width: "40%", height: 20, background: "var(--p-track, rgba(23,18,67,0.08))" }}
      />
      <GlassCard className="px-3 py-1">
        <Row />
        <Row />
        <Row />
        <Row />
      </GlassCard>
    </div>
  );
}
