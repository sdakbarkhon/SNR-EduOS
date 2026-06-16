import { 
  Home, BookOpen, CheckSquare, Folder, Book, 
  Users, Rocket, TrendingUp, Sparkles, UserCircle, 
  FileQuestion, Settings, GraduationCap
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'home', label: 'Главная', icon: Home, active: true },
  { id: 'lessons', label: 'Уроки', icon: BookOpen },
  { id: 'tasks', label: 'Задания', icon: CheckSquare },
  { id: 'materials', label: 'Материалы', icon: Folder },
  { id: 'books', label: 'Книги', icon: Book },
  { id: 'clubs', label: 'Кружки', icon: Users },
  { id: 'projects', label: 'Проекты', icon: Rocket },
  { id: 'progress', label: 'Прогресс', icon: TrendingUp },
  { id: 'ai', label: 'AI-помощник', icon: Sparkles },
  { id: 'portfolio', label: 'Портфолио', icon: UserCircle },
  { id: 'tests', label: 'Тесты', icon: FileQuestion },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-[240px] md:w-[260px] h-full flex flex-col bg-gradient-to-b from-[#2A75FF] to-[#0A3CB4] text-white py-6 px-4 shrink-0 rounded-r-[32px] md:rounded-r-[40px] shadow-2xl relative z-20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mx-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-tight tracking-wide">SNR EduOS</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar pb-8 space-y-1 px-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 ${
                item.active 
                  ? 'bg-white/25 shadow-sm backdrop-blur-sm font-medium' 
                  : 'hover:bg-white/10 text-white/85 hover:text-white font-medium'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={item.active ? 2.5 : 2} />
              <span className="text-[15px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
