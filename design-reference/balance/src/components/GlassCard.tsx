import React from 'react';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <div 
      className={`bg-white/70 backdrop-blur-2xl border border-white/60 shadow-xl shadow-blue-900/5 rounded-[24px] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
