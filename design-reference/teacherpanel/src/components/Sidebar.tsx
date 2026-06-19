import { motion } from 'motion/react';
import { Home, BookOpen, Users, Settings, LogOut, CheckCircle } from 'lucide-react';
import { ViewState } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export function Sidebar({ currentView, onChangeView }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Главная', icon: Home },
    { id: 'assignments', label: 'Задания', icon: BookOpen },
    { id: 'groups', label: 'Мои классы', icon: Users },
    { id: 'profile', label: 'Профиль', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 h-full bg-gradient-to-b from-blue-600 to-blue-900 flex flex-col p-6 text-white relative z-10 shrink-0">
      {/* Branding */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
          <CheckCircle className="w-6 h-6 text-blue-600 stroke-[2.5]" />
        </div>
        <span className="font-bold text-xl tracking-tight">SNR EduOS</span>
      </div>
      
      <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl w-fit text-xs font-medium mb-10 relative z-10">
        Учитель
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 relative z-10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-opacity relative outline-none",
                isActive ? "bg-white/20" : "opacity-70 hover:opacity-100"
              )}
            >
              <Icon className="w-5 h-5 relative z-10 stroke-[2]" />
              <span className="font-medium relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="pt-6 border-t border-white/20 relative z-10">
        <button className="w-full flex items-center gap-3 p-3 opacity-70 hover:opacity-100 transition-opacity">
          <LogOut className="w-5 h-5 stroke-[2]" />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
