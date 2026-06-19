import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { User, Shield, Bell, LayoutTemplate, Camera, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function Profile() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'interface'>('profile');

  const tabs = [
    { id: 'profile' as const, label: 'Профиль', icon: User },
    { id: 'security' as const, label: 'Безопасность', icon: Shield },
    { id: 'notifications' as const, label: 'Уведомления', icon: Bell },
    { id: 'interface' as const, label: 'Интерфейс', icon: LayoutTemplate },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 pb-32 max-w-5xl w-full mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Настройки</h1>

      <div className="flex space-x-8">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-[12px] font-semibold transition-all relative",
                  isActive ? "text-blue-700 bg-blue-50/80" : "text-gray-600 hover:bg-white/50"
                )}
              >
                {isActive && (
                  <motion.div layoutId="profile-tab-indicator" className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-md" />
                )}
                <Icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-400")} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <GlassCard className="flex-1 p-8 min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Личные данные</h2>
                  
                  <div className="flex items-center space-x-6 mb-8">
                    <div className="relative">
                      <img 
                        src="https://i.pravatar.cc/150?u=ivan_petrovich" 
                        alt="Avatar" 
                        className="w-24 h-24 rounded-[20px] object-cover border-4 border-white shadow-sm"
                      />
                      <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-blue-700 transition-colors">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Иван Петрович Сидоров</h3>
                      <p className="text-sm text-gray-500 font-medium mb-2">Учитель высшей категории</p>
                      <Badge variant="blue">Математика</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Имя</label>
                      <input type="text" defaultValue="Иван" className="w-full bg-white/50 border border-gray-200 rounded-[12px] px-4 py-2.5 font-medium outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Фамилия</label>
                      <input type="text" defaultValue="Сидоров" className="w-full bg-white/50 border border-gray-200 rounded-[12px] px-4 py-2.5 font-medium outline-none focus:border-blue-400" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                      <input type="email" defaultValue="ivan.s@eduos.snr" className="w-full bg-white/50 border border-gray-200 rounded-[12px] px-4 py-2.5 font-medium outline-none focus:border-blue-400" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Закрепленные классы</label>
                      <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-gray-200 rounded-[12px]">
                        <Badge variant="gray" className="px-3 py-1 text-sm">7А</Badge>
                        <Badge variant="gray" className="px-3 py-1 text-sm">7Б</Badge>
                        <Badge variant="gray" className="px-3 py-1 text-sm">9В</Badge>
                        <Badge variant="gray" className="px-3 py-1 text-sm">10А</Badge>
                        <Badge variant="gray" className="px-3 py-1 text-sm">10Б</Badge>
                        <button className="px-3 py-1 rounded-[8px] border border-dashed border-gray-300 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors">+ Добавить</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-[12px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">Сохранить изменения</button>
                  </div>
                </div>
              </motion.div>
            )}
            
            {activeTab !== 'profile' && (
              <motion.div key="other" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Settings2 className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">В разработке</h3>
                <p className="text-gray-500 font-medium max-w-sm">Раздел "{tabs.find(t => t.id === activeTab)?.label}" будет доступен в следующих обновлениях.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </motion.div>
  );
}
