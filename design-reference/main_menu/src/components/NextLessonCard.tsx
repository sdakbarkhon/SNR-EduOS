import { GlassCard } from './GlassCard';

export function NextLessonCard() {
  return (
    <GlassCard className="flex flex-col flex-1 p-6 min-w-[280px]">
      <h3 className="text-[15px] font-semibold text-gray-800 mb-5">Следующий урок</h3>
      <div className="flex items-center gap-4">
        {/* Placeholder for the Robot graphic */}
        <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[#E6F3FF] to-[#C9E4FF] flex items-center justify-center shrink-0 shadow-inner overflow-hidden border border-blue-100">
           <img 
            src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200&h=200" 
            alt="Робототехника" 
            className="w-full h-full object-cover opacity-90"
          />
        </div>
        <div className="flex flex-col justify-center">
          <h4 className="text-[19px] font-bold text-gray-900 mb-1 leading-tight">Робототехника</h4>
          <p className="text-[15px] text-gray-500 font-medium mb-0.5">09:00 — 09:45</p>
          <p className="text-[14px] text-gray-400 font-medium tracking-wide">Каб. 306</p>
        </div>
      </div>
    </GlassCard>
  );
}
