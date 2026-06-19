import { BookOpen, Calendar, LayoutDashboard, MessageCircle, Settings, LogOut } from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборд', active: false },
  { icon: BookOpen, label: 'Уроки', active: true },
  { icon: Calendar, label: 'Расписание', active: false },
  { icon: MessageCircle, label: 'Чат', active: false },
];

export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 w-[240px] h-full bg-gradient-to-b from-[#2563EB] to-[#4F46E5] flex flex-col items-start px-6 py-10 z-10 shadow-xl">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <span className="font-bold text-lg text-white">S</span>
        </div>
        <span className="text-white font-bold text-xl tracking-tight">SNR EduOS</span>
      </div>
      
      <nav className="flex flex-col gap-4 w-full text-white/70 flex-1">
        {menuItems.map((item, idx) => (
          <button
            key={idx}
            className={`flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
              item.active 
                ? 'bg-white/20 text-white shadow-lg' 
                : 'hover:bg-white/10 text-white/70'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-4 w-full mt-auto">
        <button className="flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer hover:bg-white/10 text-white/70 w-full text-left transition-all">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Настройки</span>
        </button>
        <button className="flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer hover:bg-white/10 text-white/70 w-full text-left transition-all">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
