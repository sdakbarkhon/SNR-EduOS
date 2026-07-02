import { cn } from "@/lib/cn";

/**
 * "SNR EduOS" brand lockup — SNR kicker line + EduOS wordmark with the
 * 3-blade pinwheel mark standing in for the "O". Everything scales off the
 * wrapper's font-size (set via `className`, e.g. `text-[28px]`), so callers
 * control the rendered size with a single number.
 */
export function Logo({ className, textColor = "#1A1A2E" }: { className?: string; textColor?: string }) {
  return (
    <div className={cn("inline-flex select-none flex-col leading-none", className)}>
      <span
        className="mb-[0.12em] text-[0.31em] font-extrabold"
        style={{ letterSpacing: "0.2em", color: textColor }}
      >
        SNR
      </span>
      <div className="flex items-center" style={{ gap: "0.03em" }}>
        <span
          className="font-black tracking-tight"
          style={{
            backgroundImage: "linear-gradient(135deg,#FFD24A 0%,#FF9F2E 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Edu
        </span>
        <svg viewBox="0 0 40 40" style={{ width: "0.86em", height: "0.86em" }} className="mx-[0.02em] shrink-0">
          <defs>
            <linearGradient id="snr-logo-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFB020" />
              <stop offset="1" stopColor="#FF7A3D" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="17" fill="#fff" stroke="url(#snr-logo-ring)" strokeWidth="4" />
          <path d="M20,17 L13,7.9 L27,7.9 Z" fill="#F0C63B" />
          <path d="M20,17 L13,7.9 L27,7.9 Z" fill="#3FC7C0" transform="rotate(120 20 20)" />
          <path d="M20,17 L13,7.9 L27,7.9 Z" fill="#EF4F9B" transform="rotate(240 20 20)" />
        </svg>
        <span className="font-black tracking-tight" style={{ color: "#FF7A3D" }}>
          S
        </span>
      </div>
    </div>
  );
}
