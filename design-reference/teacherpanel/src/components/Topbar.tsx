import { Bell, Search } from 'lucide-react';

export function Topbar() {
  return (
    <header className="h-24 w-full px-8 flex items-center justify-between z-10 relative shrink-0">
      <div className="flex-1 max-w-sm relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Поиск по ученикам, заданиям..." 
          className="w-full bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm rounded-[16px] py-3 pl-12 pr-4 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-medium placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center space-x-5">
        <button className="relative w-11 h-11 rounded-[12px] bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors group hover:bg-white/80">
          <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="absolute top-3 right-3 w-2 h-2 bg-blue-600 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.03)] rounded-[16px] pl-2 pr-4 py-2 cursor-pointer hover:bg-white/80 transition-colors">
          <img 
            src="https://i.pravatar.cc/150?u=ivan_petrovich" 
            alt="Иван Петрович" 
            className="w-9 h-9 rounded-[10px] border border-white/50 object-cover"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800 leading-tight">Иван Петрович</span>
            <span className="text-[10px] font-medium text-gray-500 leading-tight mt-0.5">Математика • 7-9 кл</span>
          </div>
        </div>
      </div>
    </header>
  );
}
