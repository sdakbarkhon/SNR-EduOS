import { GlassCard } from './GlassCard';
import { paymentsHistory } from '../data';
import { ArrowDownLeft } from 'lucide-react';

export function PaymentsHistory() {
  return (
    <GlassCard className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">История пополнений</h3>
        </div>
        <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">Все</button>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {paymentsHistory.map((item) => (
          <div key={item.id} className="group flex items-center justify-between py-4 border-b border-slate-50 hover:bg-white/40 transition-colors -mx-3 px-3 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100/50 shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                <item.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.method}</p>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mt-0.5">
                  <span>{item.date}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="font-mono">{item.id}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-green-600 whitespace-nowrap">+ {item.amount.toLocaleString('ru-RU')} UZS</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
