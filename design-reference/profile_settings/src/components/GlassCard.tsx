import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`bg-white/70 backdrop-blur-md border border-white/50 rounded-[20px] shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}
