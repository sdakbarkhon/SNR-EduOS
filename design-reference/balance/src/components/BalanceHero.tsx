import { Plus } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { activeCourses } from '../data';

export function BalanceHero() {
  return (
    <GlassCard className="p-8 h-full flex flex-col relative overflow-hidden group">
      {/* Decorative gradient orb inside the card */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-300 opacity-20 rounded-full blur-[80px] group-hover:bg-blue-300/30 transition-colors duration-500"></div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">Текущий баланс</h2>
            <span className="px-4 py-1.5 bg-green-100 text-green-700 text-sm font-bold rounded-full border border-green-200">
              Активен
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-5xl font-black text-slate-900 tracking-tight">1 250 000</span>
            <span className="text-3xl font-black text-slate-900">UZS</span>
          </div>
          <p className="mt-4 text-sm text-slate-600">Достаточно средств для следующего платежа (18 июн)</p>
        </div>

        <button className="flex-shrink-0 inline-flex items-center justify-center gap-3 bg-[#007AFF] hover:bg-[#0063CC] text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/30 hover:-translate-y-0.5">
          <Plus className="w-6 h-6" strokeWidth={3} />
          <span>Пополнить</span>
        </button>
      </div>

      <div className="relative z-10 pt-6 border-t border-slate-200/60 mt-auto">
        <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Мои активные курсы</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeCourses.map((course) => (
            <div key={course.id} className="flex items-start gap-4 bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm hover:bg-white/50 transition-all hover:-translate-y-0.5 cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${course.color.replace(/border-[a-z0-9-]+/g, '')}`}>
                <course.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col h-full justify-between min-h-[64px]">
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-snug">{course.name}</p>
                  <p className="text-xs font-medium text-slate-500 mt-0.5 mb-1.5">
                    {course.schedule || '\u00A0'}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900">{course.price.toLocaleString('ru-RU')} UZS</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
