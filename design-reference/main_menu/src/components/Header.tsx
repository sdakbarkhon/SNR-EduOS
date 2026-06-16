import { Bell } from 'lucide-react';
import { GlassCard } from './GlassCard';

export default function Header() {
  return (
    <header className="flex items-center justify-between w-full pt-2 pb-4">
      <div className="flex flex-col">
        <h1 className="text-3xl md:text-[34px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
          Привет, Адилбек! <span className="text-3xl">👋</span>
        </h1>
        <p className="text-gray-500 font-medium mt-1 text-[15px]">Среда, 14 мая 2025</p>
      </div>
      
      <div className="flex items-center gap-4">
        <GlassCard className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer relative shadow-sm">
          <Bell className="w-5 h-5 text-blue-600" />
          <div className="absolute top-[14px] right-[14px] w-2 h-2 bg-blue-500 rounded-full border border-white"></div>
        </GlassCard>
        
        <GlassCard className="p-1 rounded-full shadow-sm">
          <img 
            src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&q=80&w=256&h=256" 
            alt="Адилбек Profile" 
            className="w-10 h-10 rounded-full object-cover"
          />
        </GlassCard>
      </div>
    </header>
  );
}
