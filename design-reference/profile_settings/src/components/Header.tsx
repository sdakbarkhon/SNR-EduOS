import { Bell, User, LogOut, Hexagon } from "lucide-react";
import { motion } from "motion/react";

export function Header({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = ["Профиль", "Безопасность", "Уведомления", "Интерфейс"];

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 md:gap-0">
      <div className="space-y-4">
        {/* Branding: Use the blue squircle logo badge at the top */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Hexagon size={24} className="fill-white/20" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Настройки</h1>
        </div>
        
        {/* Tabs */}
        <nav className="flex flex-wrap gap-1 bg-white/40 backdrop-blur-md p-1 rounded-2xl md:rounded-full border border-white/60">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 md:px-6 py-2 rounded-full text-sm transition-colors duration-200 ${
                  isActive ? "text-blue-600 font-semibold" : "text-slate-600 hover:bg-white/30"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="headerActiveTab"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Header Icons */}
      <div className="flex items-center gap-4 self-end md:self-auto">
        <button className="w-10 h-10 flex items-center justify-center bg-white/70 backdrop-blur-md rounded-full border border-white text-slate-700 hover:bg-white transition-colors shadow-sm">
          <Bell size={20} />
        </button>
        <button className="w-10 h-10 flex items-center justify-center bg-white/70 backdrop-blur-md rounded-full border border-white text-rose-500 hover:bg-rose-50 transition-colors shadow-sm">
          <LogOut size={18} />
        </button>
        <button className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-400 border-2 border-white shadow-md overflow-hidden">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Adilbek" alt="Avatar" className="w-full h-full object-cover" />
        </button>
      </div>
    </header>
  );
}
