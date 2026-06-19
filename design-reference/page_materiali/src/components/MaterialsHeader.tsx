import { Search } from 'lucide-react';

export function MaterialsHeader() {
  return (
    <header className="flex justify-between items-center mb-6 mt-2">
      <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Материалы</h1>
      
      <div className="relative w-80">
        <input
          type="text"
          placeholder="Поиск материалов..."
          className="w-full bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 shadow-sm transition-all text-slate-700 placeholder-slate-400"
        />
        <Search className="w-5 h-5 absolute left-4 top-3 text-slate-400 pointer-events-none" />
      </div>
    </header>
  );
}
