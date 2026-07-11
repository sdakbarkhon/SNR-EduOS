import { Bot, Backpack } from "lucide-react";

export function HomeworkHero({ label }: { label: string }) {
  return (
    <div
      className="relative h-[176px] rounded-[20px] overflow-hidden flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg, #EFE9FE 0%, #FDEFE0 100%)" }}
    >
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/40 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
      <Bot className="h-16 w-16 text-violet-500 drop-shadow-sm" role="img" aria-label={label} />
      <Backpack className="absolute bottom-4 right-6 h-8 w-8 text-amber-500" aria-hidden="true" />
    </div>
  );
}
