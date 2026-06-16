import { GlassCard } from './GlassCard';
import { Calendar } from 'lucide-react';

export function AnalyticsChart() {
  return (
    <GlassCard className="p-6 h-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Статус оплаты</h3>
      
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        <div className="flex justify-between text-sm font-bold">
          <span className="text-slate-600">Оплачено за этот месяц</span>
          <span className="text-slate-900">2 000 000 UZS</span>
        </div>
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: '66%' }}></div>
        </div>
        <p className="text-xs text-slate-400">Оплачено 2 из 3 курсов в этом месяце</p>
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100/50">
        <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Предстоящий платеж</h4>
        <div className="flex items-start gap-4 bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">15 июня</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5 mb-1.5">Оплата курса: Английский</p>
            <p className="text-sm font-black text-slate-900">800 000 UZS</p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
