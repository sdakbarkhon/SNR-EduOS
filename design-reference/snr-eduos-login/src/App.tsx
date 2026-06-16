/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#101b4c]">
      <BackgroundArt />

      {/* Main Content Plane */}
      <div className="relative z-10 flex h-full w-full max-w-[1440px] flex-col overflow-y-auto px-4 sm:px-8 py-6 selection:bg-[#007BFF]/30 xl:px-16">
        
        {/* Top Header Placeholder (Removed elements) */}
        <header className="flex w-full shrink-0 items-start justify-between pt-2">
        </header>

        {/* Middle Body Container (2 Columns) */}
        <main className="flex flex-1 flex-col md:flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 md:gap-12 lg:gap-0 py-8 lg:py-0 animate-in fade-in zoom-in-95 duration-1000 w-full lg:px-12 xl:px-24">
          
          {/* Left Column: Branding */}
          <div className="flex flex-col items-center lg:items-start gap-4 lg:pr-12 text-center lg:text-left z-10 w-full max-w-[380px] md:max-w-none">
            {/* Squircle Logo (Universal) */}
            <div className="relative flex h-[90px] w-[90px] md:h-[110px] md:w-[110px] lg:h-[120px] lg:w-[120px] items-center justify-center rounded-[24px] md:rounded-[28px] lg:rounded-[36px] bg-gradient-to-b from-[#417BFF] to-[#0B3EDB] shadow-xl lg:shadow-2xl shadow-[#417BFF]/30 ring-1 ring-white/20">
               <GraduationCap className="h-12 w-12 md:h-14 md:w-14 lg:h-16 lg:w-16 relative z-10 text-white drop-shadow-md" strokeWidth={2.5} />
            </div>

            {/* Typography */}
            <div className="mt-2 md:mt-4 lg:mt-4 flex flex-row items-baseline justify-center md:justify-center lg:justify-start gap-3 md:gap-4 leading-none">
              <h1 className="text-[52px] md:text-[68px] lg:text-[80px] font-bold tracking-tight text-white drop-shadow-lg">
                SNR
              </h1>
              <h1 className="text-[52px] md:text-[68px] lg:text-[80px] font-bold tracking-tight text-[#FFC107] drop-shadow-lg">
                EduOS
              </h1>
            </div>
            
            <p className="mt-1 text-[18px] md:text-[22px] lg:text-[24px] font-medium tracking-wide text-white/95 drop-shadow-md">
              Платформа твоего будущего
            </p>
          </div>

          {/* Right Column: Login Card */}
          <div className="relative w-full max-w-[380px] md:max-w-[440px] lg:max-w-[420px] shrink-0 z-10 mx-auto lg:mx-0">
            <div className="relative rounded-[24px] md:rounded-[28px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 p-7 sm:p-8 md:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.8)] ring-1 ring-white/50 backdrop-blur-[40px] overflow-hidden">
              {/* Subtle inner noise/texture */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

              <h2 className="mb-6 md:mb-8 text-[22px] md:text-[26px] font-bold tracking-tight text-[#1A1A24] text-center lg:text-left">
                Вход для ученика
              </h2>
              
              <div className="space-y-4 md:space-y-6 relative z-10">
                {/* Log In */}
                <div className="flex flex-col gap-1.5 md:gap-2">
                  <label className="text-[13px] md:text-[14px] font-medium tracking-wide text-[#4A5568]">
                    Логин
                  </label>
                  <div className="overflow-hidden rounded-[10px] md:rounded-xl bg-[#F0F4F8] focus-within:ring-2 focus-within:ring-[#007BFF]/40 border border-transparent focus-within:border-[#007BFF]/30 transition-all">
                    <input 
                      type="text" 
                      className="w-full bg-transparent px-3 py-3 md:px-4 md:py-3.5 text-[15px] md:text-[16px] font-medium text-[#1A1A24] outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5 md:gap-2">
                  <label className="text-[13px] md:text-[14px] font-medium tracking-wide text-[#4A5568]">
                    Пароль
                  </label>
                  <div className="relative overflow-hidden rounded-[10px] md:rounded-xl bg-[#F0F4F8] focus-within:ring-2 focus-within:ring-[#007BFF]/40 border border-transparent focus-within:border-[#007BFF]/30 transition-all flex items-center pr-3 md:pr-4">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-transparent px-3 py-3 md:px-4 md:py-3.5 text-[20px] md:text-[22px] font-bold tracking-[0.25em] text-[#1A1A24] outline-none placeholder:text-slate-400"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#A0ABC0] hover:text-[#4A5568] transition-colors focus:outline-none flex shrink-0"
                    >
                      {showPassword ? <EyeOff size={20} className="md:w-[22px] md:h-[22px]" /> : <Eye size={20} className="md:w-[22px] md:h-[22px]" />}
                    </button>
                  </div>
                </div>

                {/* Checkbox */}
                <div className="pt-1 md:pt-2">
                  <label className="inline-flex cursor-pointer items-center gap-3 md:gap-3.5 group">
                    <div className="relative flex h-[16px] w-[16px] md:h-[18px] md:w-[18px] items-center justify-center rounded-[4px] border-[1.5px] border-[#CBD5E1] bg-white group-hover:border-[#007BFF] has-[:checked]:border-transparent has-[:checked]:bg-[#007BFF] transition-colors shadow-sm">
                       <input type="checkbox" className="peer sr-only" />
                       <svg className="h-[9px] w-[9px] md:h-[10px] md:w-[10px] text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                       </svg>
                    </div>
                    <span className="text-[13px] md:text-[14px] font-medium text-[#4A5568] group-hover:text-[#1A1A24] transition-colors leading-none mt-[1px]">Запомнить меня</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button className="mt-1 md:mt-2 w-full rounded-[12px] md:rounded-[14px] bg-[#007BFF] py-[13px] md:py-[15px] text-[15px] md:text-[16px] font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(0,123,255,0.35)] transition-all hover:bg-[#0069D9] hover:-translate-y-[1px] hover:shadow-[0_12px_24px_rgba(0,123,255,0.45)] active:translate-y-0 active:scale-[0.98]">
                  Войти
                </button>

                {/* Forgot Password Link */}
                <div className="mt-3 md:mt-4 pb-1 md:pb-2 text-center">
                  <a href="#" className="text-[13px] md:text-[14px] font-medium text-[#007BFF] hover:text-[#0056b3] hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/50 rounded px-2 py-1">
                    Забыли пароль?
                  </a>
                </div>
              </div>
            </div>

            {/* Decorative Sparkle behind bottom right of card */}
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -bottom-5 -right-2 md:-right-5 text-white opacity-40 drop-shadow-md z-0">
              <path d="M20 0C20 11.0457 28.9543 20 40 20C28.9543 20 20 28.9543 11.0457 20 0 20C11.0457 20 20 11.0457 20 0Z" fill="currentColor"/>
            </svg>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="shrink-0 pb-3 pt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="text-[14px] font-medium tracking-wide text-white/50">
            © 2026 SNR EduOS. Все права защищены.
          </p>
        </footer>
      </div>
    </div>
  );
}

function BackgroundArt() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#13206a]">
      {/* Dynamic gradients for deep space / glowing vibe */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_#7D2BCE_0%,_transparent_55%)] opacity-90 mix-blend-screen" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#264CFF_0%,_transparent_65%)] opacity-90 mix-blend-screen" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#132c86]/40 via-[#101b4a]/50 to-[#421d7b]/40 mix-blend-multiply" />
      
      {/* Bright center glows behind content */}
      <div className="absolute top-[20%] left-[20%] h-[600px] w-[600px] rounded-full bg-[#3b82f6] opacity-35 blur-[120px]" />
      <div className="absolute bottom-10 right-[15%] h-[500px] w-[500px] rounded-full bg-[#9c51f0] opacity-40 blur-[130px]" />

      {/* Floating 3D Elements */}
      
      {/* Giant Wireframe Cube (Bottom Left) */}
      <div className="absolute -bottom-16 left-5 opacity-90 animate-float-slow">
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
          
          {/* Inner Light Core */}
          <circle cx="100" cy="100" r="40" fill="url(#cube-grad)" stroke="url(#cube-lines)" strokeWidth="0.5" className="opacity-60" />
          <circle cx="100" cy="100" r="20" fill="white" className="opacity-10 blur-xl" />
          
          <polygon points="100,20 170,60 170,140 100,180 30,140 30,60" fill="url(#cube-grad)" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinejoin="round" />
          <polyline points="30,60 100,100 170,60" fill="none" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="100" y1="100" x2="100" y2="180" stroke="url(#cube-lines)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Floating Diamond (Center Left) */}
      <div className="absolute top-[45%] left-[28%] -translate-y-1/2 opacity-95 animate-float-medium">
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

      {/* Floating Bubbles */}
      <div className="absolute right-[22%] top-[12%] h-[100px] w-[100px] rounded-full border-[1.5px] border-white/30 bg-[radial-gradient(circle_at_35%_25%,_rgba(255,255,255,0.4),_rgba(80,140,255,0.2)_50%,_transparent_100%)] shadow-[inset_0_0_30px_rgba(255,255,255,0.3),_0_0_25px_rgba(0,180,255,0.3)] animate-float-slow backdrop-blur-[4px]" />
      
      <div className="absolute right-[43%] bottom-[20%] h-14 w-14 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.4),_transparent_70%)] shadow-[inset_0_0_15px_rgba(255,255,255,0.2),_0_0_15px_rgba(200,80,255,0.5)] animate-float-medium backdrop-blur-[3px]" />
      
      <div className="absolute left-[12%] top-[56%] h-11 w-11 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.5),_transparent_70%)] shadow-[inset_0_0_10px_rgba(255,255,255,0.4),_0_0_12px_rgba(100,180,255,0.4)] animate-float-fast backdrop-blur-[2px]" />
      
      <div className="absolute left-[47%] top-[15%] h-[52px] w-[52px] rounded-full border border-white/25 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.4),_transparent_70%)] shadow-[inset_0_0_15px_rgba(255,255,255,0.3),_0_0_25px_rgba(230,120,255,0.4)] animate-float-slow backdrop-blur-[3px]" />

      {/* Wavy bottom energy lines */}
      <svg className="absolute bottom-0 left-0 w-full opacity-70 mix-blend-screen pointer-events-none" viewBox="0 0 1440 320" preserveAspectRatio="none">
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
         <path fill="none" stroke="url(#wave-grad)" strokeWidth="1.5" strokeLinecap="round" d="M0,220 C350,320 650,120 1440,280" className="translate-y-2" />
         <path fill="none" stroke="url(#wave-grad-2)" strokeWidth="2.5" strokeLinecap="round" d="M0,260 C450,140 750,320 1440,220" className="translate-y-6" />
      </svg>
    </div>
  );
}
