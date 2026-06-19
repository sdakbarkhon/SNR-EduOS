import { Bell, Search } from 'lucide-react';

export function Topbar() {
  return (
    <header className="h-20 flex items-center justify-between px-10 border-b border-gray-100 bg-white/30 backdrop-blur-md">
      <div className="flex items-center flex-1">
        <div className="relative w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Поиск уроков, материалов..."
            className="block w-full pl-11 pr-4 py-2 bg-white/50 backdrop-blur-md border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-800 text-sm"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer">
          <Bell className="w-6 h-6 text-gray-500" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm font-semibold text-gray-700">Адилбек</span>
          <div className="w-10 h-10 rounded-full bg-[#E5E7EB] overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" 
              alt="Адилбек"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
