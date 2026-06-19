import React from 'react';
import { LayoutDashboard, FolderKanban, Users, CalendarDays, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 h-full bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col shrink-0 z-20 shadow-xl fixed left-0 top-0">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
          <div className="w-6 h-6 bg-white rounded-md" />
        </div>
        <span className="font-bold text-xl tracking-tight text-white uppercase">SNR EduOS</span>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-2">
        <NavItem icon={<LayoutDashboard size={20} />} label="Дашборд" />
        <NavItem icon={<FolderKanban size={20} />} label="Проекты" isActive />
        <NavItem icon={<Users size={20} />} label="Команды" />
        <NavItem icon={<CalendarDays size={20} />} label="Календарь" />
      </nav>
    </aside>
  );
}

function NavItem({ icon, label, isActive = false }: { icon: React.ReactNode; label: string; isActive?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-colors cursor-pointer ${
        isActive 
          ? 'bg-white/10 text-white shadow-inner border border-white/10 cursor-default font-semibold' 
          : 'text-white/60 hover:text-white font-medium'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
