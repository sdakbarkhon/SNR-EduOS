import React from 'react';
import { Bell, Search } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="h-16 w-full flex items-center justify-between px-12 pt-4 bg-transparent relative z-20">
      <div className="flex-1">
        <div className="max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Поиск по платформе..." 
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-white/50 bg-white/70 backdrop-blur-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm placeholder:text-slate-400 text-slate-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
          <Bell size={24} strokeWidth={1.5} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50"></span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-700 leading-tight">Анна Смирнова</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase">Студент</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-blue-600 font-bold overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100&h=100" 
              alt="Студент" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
