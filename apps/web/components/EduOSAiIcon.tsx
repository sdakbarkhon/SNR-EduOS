import { Sparkles } from "lucide-react";

// Reusable "EduOS AI" glyph — a circular orange/yellow gradient badge with a
// white Sparkles icon, matching AiFloatingButton.tsx's visual spec exactly.
// Size is controlled entirely by the caller via `className` (e.g. "h-9 w-9"
// or "h-14 w-14") so the same glyph can be reused at any scale; the Sparkles
// icon is sized relative to the container so it scales along with it.
export function EduOSAiIcon({ className }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 shadow-lg ${className ?? "h-9 w-9"}`}
    >
      <Sparkles className="h-1/2 w-1/2 text-white" strokeWidth={2} />
    </div>
  );
}
