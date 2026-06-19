import { Bell, Search, Menu } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="h-20 flex items-center justify-between px-4 sm:px-10 flex-shrink-0 sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4 lg:hidden">
        <button className="p-2 glass-card rounded-xl text-slate-700">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="hidden lg:flex w-full max-w-md relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Поиск книг и учебников..." 
          className="w-full pl-11 pr-4 py-2.5 glass-card rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-shadow placeholder:text-slate-400 text-slate-700"
        />
      </div>

      <div className="flex items-center gap-6 ml-auto">
        <div className="relative p-2 rounded-full glass-card cursor-pointer border-[1px] border-white/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:bg-white/40 transition-colors">
          <Bell className="w-6 h-6 text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-slate-800">Иван Т.</div>
            <div className="text-xs text-slate-500">Ученик 7 "Б"</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-400 border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-xs">
            ИТ
          </div>
        </div>
      </div>
    </header>
  );
}
