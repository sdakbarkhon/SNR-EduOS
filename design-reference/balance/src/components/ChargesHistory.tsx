import { GlassCard } from './GlassCard';
import { chargesHistory } from '../data';
import { ArrowUpRight } from 'lucide-react';

export function ChargesHistory() {
  return (
    <GlassCard className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">История списаний</h3>
        </div>
        <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">Все</button>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {chargesHistory.map((item) => (
          <div key={item.id} className="group flex items-center justify-between py-4 border-b border-slate-50 hover:bg-white/40 transition-colors -mx-3 px-3 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100/50 shadow-sm flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform">
                <item.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{item.service}</p>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mt-0.5">
                  <span>{item.date}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase tracking-wider">{item.category}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-900 whitespace-nowrap">- {item.amount.toLocaleString('ru-RU')} UZS</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
