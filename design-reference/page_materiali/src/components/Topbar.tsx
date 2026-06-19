import { Bell } from 'lucide-react';

export function Topbar() {
  return (
    <header className="flex items-center justify-end mb-6">
      <div className="flex items-center gap-6">
        <button className="relative w-10 h-10 rounded-full bg-white/50 backdrop-blur border border-white/40 shadow-sm flex items-center justify-center hover:bg-white/70 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full shadow-sm"></span>
        </button>
        
        <button className="flex items-center gap-3 bg-white/50 backdrop-blur border border-white/40 shadow-sm rounded-full p-1.5 pr-4 hover:bg-white/70 transition-colors">
          <img 
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=b6e3f4" 
            alt="Студент" 
            className="w-8 h-8 rounded-full bg-white"
          />
          <span className="text-sm font-medium text-slate-700">Иван Иванов</span>
        </button>
      </div>
    </header>
  );
}
