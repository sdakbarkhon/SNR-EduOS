// Декоративный «космический» фон Login (порт из design-reference, visual-only).
export function BackgroundArt() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#13206a]">
      {/* Глубокие градиенты */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_#7D2BCE_0%,_transparent_55%)] opacity-90 mix-blend-screen" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#264CFF_0%,_transparent_65%)] opacity-90 mix-blend-screen" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#132c86]/40 via-[#101b4a]/50 to-[#421d7b]/40 mix-blend-multiply" />

      {/* Свечения за контентом */}
      <div className="absolute left-[20%] top-[20%] h-[600px] w-[600px] rounded-full bg-[#3b82f6] opacity-35 blur-[120px]" />
      <div className="absolute bottom-10 right-[15%] h-[500px] w-[500px] rounded-full bg-[#9c51f0] opacity-40 blur-[130px]" />

      {/* Каркасный куб (слева снизу) */}
      <div className="animate-float-slow absolute -bottom-16 left-5 opacity-90">
        <svg width="380" height="380" viewBox="0 0 200 200" className="drop-shadow-[0_0_40px_rgba(60,160,255,0.7)]">
          <defs>
            <linearGradient id="cube-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0a4bd4" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="cube-lines" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="1" />
              <stop offset="100%" stopColor="#BE40FF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <polygon points="100,20 170,60 100,100 30,60" fill="none" stroke="url(#cube-lines)" strokeWidth="0.5" className="opacity-40" />
          <polygon points="30,60 100,100 100,180 30,140" fill="none" stroke="url(#cube-lines)" strokeWidth="0.5" className="opacity-40" />
          <polygon points="170,60 100,100 100,180 170,140" fill="none" stroke="url(#cube-lines)" strokeWidth="0.5" className="opacity-40" />
          <circle cx="100" cy="100" r="40" fill="url(#cube-grad)" stroke="url(#cube-lines)" strokeWidth="0.5" className="opacity-60" />
          <circle cx="100" cy="100" r="20" fill="white" className="opacity-10 blur-xl" />
          <polygon points="100,20 170,60 170,140 100,180 30,140 30,60" fill="url(#cube-grad)" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinejoin="round" />
          <polyline points="30,60 100,100 170,60" fill="none" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="100" y1="100" x2="100" y2="180" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Ромб (слева по центру) */}
      <div className="animate-float-medium absolute left-[28%] top-[45%] -translate-y-1/2 opacity-95">
        <svg width="70" height="90" viewBox="0 0 100 120" className="drop-shadow-[0_0_25px_rgba(200,80,255,0.6)]">
          <defs>
            <linearGradient id="diamond-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8AC4FF" />
              <stop offset="100%" stopColor="#1C55FF" />
            </linearGradient>
            <linearGradient id="diamond-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D980FF" />
              <stop offset="100%" stopColor="#5B16B5" />
            </linearGradient>
          </defs>
          <polygon points="50,10 90,60 50,110 10,60" fill="url(#diamond-bottom)" />
          <polygon points="50,10 90,60 50,60" fill="url(#diamond-top)" opacity="0.9" />
          <polygon points="50,10 10,60 50,60" fill="white" opacity="0.35" />
          <polygon points="10,60 50,110 50,60" fill="#0A0D36" opacity="0.4" />
          <polyline points="10,60 90,60" fill="none" stroke="white" strokeWidth="1" opacity="0.6" />
          <line x1="50" y1="10" x2="50" y2="110" stroke="white" strokeWidth="1" opacity="0.4" />
        </svg>
      </div>

      {/* Стеклянные пузыри */}
      <div className="animate-float-slow absolute right-[22%] top-[12%] h-[100px] w-[100px] rounded-full border-[1.5px] border-white/30 bg-[radial-gradient(circle_at_35%_25%,_rgba(255,255,255,0.4),_rgba(80,140,255,0.2)_50%,_transparent_100%)] shadow-[inset_0_0_30px_rgba(255,255,255,0.3),_0_0_25px_rgba(0,180,255,0.3)] backdrop-blur-[4px]" />
      <div className="animate-float-medium absolute bottom-[20%] right-[43%] h-14 w-14 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.4),_transparent_70%)] shadow-[inset_0_0_15px_rgba(255,255,255,0.2),_0_0_15px_rgba(200,80,255,0.5)] backdrop-blur-[3px]" />
      <div className="animate-float-fast absolute left-[12%] top-[56%] h-11 w-11 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.5),_transparent_70%)] shadow-[inset_0_0_10px_rgba(255,255,255,0.4),_0_0_12px_rgba(100,180,255,0.4)] backdrop-blur-[2px]" />
      <div className="animate-float-slow absolute left-[47%] top-[15%] h-[52px] w-[52px] rounded-full border border-white/25 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.4),_transparent_70%)] shadow-[inset_0_0_15px_rgba(255,255,255,0.3),_0_0_25px_rgba(230,120,255,0.4)] backdrop-blur-[3px]" />

      {/* Волнистые энергетические линии снизу */}
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-70 mix-blend-screen" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00A3FF" stopOpacity="0" />
            <stop offset="50%" stopColor="#D940FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#007BFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wave-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF40A0" stopOpacity="0" />
            <stop offset="35%" stopColor="#00B2FF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="none" stroke="url(#wave-grad)" strokeWidth="1.5" strokeLinecap="round" d="M0,220 C350,320 650,120 1440,280" />
        <path fill="none" stroke="url(#wave-grad-2)" strokeWidth="2.5" strokeLinecap="round" d="M0,260 C450,140 750,320 1440,220" />
      </svg>
    </div>
  );
}
