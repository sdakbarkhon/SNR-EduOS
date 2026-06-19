import { BookOpen } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="w-[240px] fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#3B82F6] to-[#1E40AF] p-6 shadow-2xl">
      <div className="mb-10 px-2 flex items-center">
        <span className="text-white font-bold text-2xl tracking-tight">SNR EduOS</span>
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem icon={<BookOpen className="w-5 h-5" />} label="Материалы" isActive />
      </nav>
    </aside>
  );
}

function NavItem({ icon, label, isActive }: { icon: React.ReactNode; label: string; isActive?: boolean }) {
  return (
    <button
      className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
        isActive 
          ? 'bg-white/15 text-white rounded-xl shadow-inner cursor-default' 
          : 'text-white/70 hover:text-white cursor-pointer rounded-xl'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
