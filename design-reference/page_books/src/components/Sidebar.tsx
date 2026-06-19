import { LayoutDashboard, Book, Calendar, FileText } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Главная', active: false },
  { icon: Book, label: 'Книги', active: true },
  { icon: Calendar, label: 'Расписание', active: false },
  { icon: FileText, label: 'Задания', active: false },
];

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-[#326CF9] to-[#1E4DCB] flex-col hidden lg:flex py-8 h-screen sticky top-0 shadow-2xl">
      <div className="px-8 mb-12 flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Book className="w-6 h-6 text-blue-600" />
        </div>
        <span className="text-white font-bold text-xl tracking-tight">SNR EduOS</span>
      </div>

      <nav className="flex-grow space-y-2">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center px-8 py-3 cursor-pointer transition-colors ${
              item.active
                ? 'active-nav text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </div>
        ))}
      </nav>

      <div className="px-8 mt-auto">
        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
          <div className="text-white font-medium text-sm">Тариф «Премиум»</div>
          <div className="text-white/60 text-xs mt-1">Доступно до 12.12</div>
        </div>
      </div>
    </aside>
  );
}
