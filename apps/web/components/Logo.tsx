import Image from "next/image";
import { cn } from "@/lib/cn";

// Intrinsic size of /public/logos/snr-eduos.png — used as-is for the aspect
// ratio; actual rendered size is controlled per-caller via `className`
// (e.g. `h-7`), with `w-auto` here keeping the ratio locked.
const LOGO_WIDTH = 849;
const LOGO_HEIGHT = 285;

/**
 * "SNR EduOS" brand lockup (real logo asset, replacing the earlier CSS/SVG
 * approximation). Callers set the rendered height via `className` (e.g.
 * `h-7`, `h-[106px] lg:h-[142px]`) — width follows automatically.
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logos/snr-eduos.png"
      alt="SNR EduOS"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cn("w-auto select-none", className)}
    />
  );
}
