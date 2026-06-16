import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { Toggle } from "./Toggle";
import { ChevronDown, ShieldCheck, Lock, Save, Edit2 } from "lucide-react";

export function SettingsColumn({ activeTab, theme, setTheme, profileData }: any) {
  const [toggles, setToggles] = useState({
    homework: true,
    reminders: true,
    grades: true,
    system: false,
  });

  const handleToggle = (key: keyof typeof toggles) => (checked: boolean) => {
    setToggles(prev => ({ ...prev, [key]: checked }));
  };

  const renderProfileTab = () => (
    <div className="flex-grow space-y-8 animate-in fade-in duration-300 flex flex-col">
      <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Учебная информация</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Класс</p>
          <p className="text-slate-800 font-bold text-xl">7 "А" класс</p>
        </div>
        <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Куратор</p>
          <p className="text-slate-800 font-bold text-xl">В.И. Смирнова</p>
        </div>
      </div>

      <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm flex-grow">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Группы</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between bg-cyan-50/50 p-5 rounded-2xl border-l-4 border-cyan-400 transition-transform hover:-translate-y-0.5">
            <span className="text-slate-800 font-bold text-lg">Робототехника</span>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider bg-white/50 px-3 py-1.5 rounded-lg border border-white/60">Пн, Ср</span>
          </div>
          <div className="flex items-center justify-between bg-purple-50/50 p-5 rounded-2xl border-l-4 border-purple-400 transition-transform hover:-translate-y-0.5">
            <span className="text-slate-800 font-bold text-lg">Английский</span>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider bg-white/50 px-3 py-1.5 rounded-lg border border-white/60">Вт, Чт</span>
          </div>
        </div>
      </div>
    </div>
  );

  const [editingField, setEditingField] = useState<string | null>(null);
  const [securityData, setSecurityData] = useState({ phone: profileData?.phone || "", email: profileData?.email || "" });

  const renderSecurityTab = () => (
    <div className="flex-grow space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="text-blue-500" size={28} />
        <h3 className="text-2xl font-extrabold text-slate-800">Безопасность</h3>
      </div>
      
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Привязанный телефон</label>
            {editingField === 'phone' ? (
              <span className="text-green-600 text-xs font-bold flex items-center gap-1">Редактирование...</span>
            ) : (
              <button 
                onClick={() => setEditingField('phone')}
                className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:text-blue-700 transition-colors"
              >
                <Edit2 size={12} /> Редактировать
              </button>
            )}
          </div>
          <input 
            type="text" 
            value={securityData.phone}
            onChange={e => setSecurityData({...securityData, phone: e.target.value})}
            readOnly={editingField !== 'phone'}
            className={`w-full font-bold rounded-xl px-4 py-3.5 outline-none transition-colors ${
              editingField === 'phone' 
                ? "bg-white/60 border border-white/80 text-slate-800 focus:ring-2 focus:ring-blue-500/50 shadow-inner" 
                : "bg-slate-50/50 border border-slate-200/50 text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Привязанный E-mail</label>
            {editingField === 'email' ? (
              <span className="text-green-600 text-xs font-bold flex items-center gap-1">Редактирование...</span>
            ) : (
              <button 
                onClick={() => setEditingField('email')}
                className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:text-blue-700 transition-colors"
              >
                <Edit2 size={12} /> Редактировать
              </button>
            )}
          </div>
          <input 
            type="email" 
            value={securityData.email}
            onChange={e => setSecurityData({...securityData, email: e.target.value})}
            readOnly={editingField !== 'email'}
            className={`w-full font-bold rounded-xl px-4 py-3.5 outline-none transition-colors ${
              editingField === 'email' 
                ? "bg-white/60 border border-white/80 text-slate-800 focus:ring-2 focus:ring-blue-500/50 shadow-inner" 
                : "bg-slate-50/50 border border-slate-200/50 text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>
      </div>

      <div className="border-t border-slate-200/50 pt-8 mt-4">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Смена пароля</h3>
        <p className="text-sm text-slate-500 mb-6 font-medium">Вам на почту будет отправлена ссылка для сброса и создания нового пароля.</p>
        <button className="flex items-center gap-2 bg-white/80 hover:bg-white text-slate-800 font-bold py-3.5 px-6 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95">
          <Lock size={18} />
          Изменить пароль
        </button>
      </div>

      {editingField && (
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-slate-200/50">
          <button
            onClick={() => setEditingField(null)}
            className="flex items-center justify-center gap-2 bg-white text-slate-600 px-6 py-3.5 rounded-xl font-bold border border-slate-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Отмена
          </button>
          <button
            onClick={() => setEditingField(null)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Save size={20} />
            Сохранить изменения
          </button>
        </div>
      )}
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="flex-grow space-y-6 animate-in fade-in duration-300 flex flex-col">
      <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Уведомления</h3>
      <div className="bg-white/40 rounded-2xl border border-white/50 divide-y divide-slate-100/50 shadow-sm">
        
        <div className="flex items-center justify-between p-5 hover:bg-white/60 transition-colors rounded-t-2xl">
          <span className={`font-semibold ${toggles.homework ? 'text-slate-800' : 'text-slate-500'}`}>Новые домашние задания</span>
          <Toggle checked={toggles.homework} onChange={handleToggle('homework')} />
        </div>
        
        <div className="flex items-center justify-between p-5 hover:bg-white/60 transition-colors">
          <span className={`font-semibold ${toggles.reminders ? 'text-slate-800' : 'text-slate-500'}`}>Напоминания о начале урока</span>
          <Toggle checked={toggles.reminders} onChange={handleToggle('reminders')} />
        </div>

        <div className="flex items-center justify-between p-5 hover:bg-white/60 transition-colors">
          <span className={`font-semibold ${toggles.grades ? 'text-slate-800' : 'text-slate-500'}`}>Оценки и отзывы учителей</span>
          <Toggle checked={toggles.grades} onChange={handleToggle('grades')} />
        </div>

        <div className="flex items-center justify-between p-5 hover:bg-white/60 transition-colors rounded-b-2xl">
          <span className={`font-semibold ${toggles.system ? 'text-slate-800' : 'text-slate-500'}`}>Системные обновления</span>
          <Toggle checked={toggles.system} onChange={handleToggle('system')} />
        </div>
      </div>
    </div>
  );

  const [language, setLanguage] = useState("Русский");

  const renderInterfaceTab = () => (
    <div className="flex-grow space-y-10 animate-in fade-in duration-300 flex flex-col">
      <div>
        <h3 className="text-2xl font-extrabold text-slate-800 mb-5">Тема интерфейса</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {["Светлая", "Тёмная", "Системная"].map((t) => {
            const isActive = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all duration-200 border ${
                  isActive 
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]" 
                    : "bg-white/50 border-white/80 text-slate-600 hover:bg-white/80 hover:scale-[1.01]"
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-slate-200/50 pt-8 mt-2">
        <h3 className="text-xl font-bold text-slate-800 mb-5">Язык интерфейса</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {[
            { id: "Русский", flag: "🇷🇺", label: "Русский" },
            { id: "Английский", flag: "🇬🇧", label: "Английский" },
            { id: "Узбекский", flag: "🇺🇿", label: "Узбекский" }
          ].map((lang) => {
            const isActive = language === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all duration-200 border flex items-center justify-center gap-2 ${
                  isActive 
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]" 
                    : "bg-white/50 border-white/80 text-slate-600 hover:bg-white/80 hover:scale-[1.01]"
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );

  return (
    <GlassCard className="flex flex-col h-full p-6 md:p-10 basis-[65%] min-w-0 md:min-w-[400px]">
      {activeTab === "Профиль" && renderProfileTab()}
      {activeTab === "Безопасность" && renderSecurityTab()}
      {activeTab === "Уведомления" && renderNotificationsTab()}
      {activeTab === "Интерфейс" && renderInterfaceTab()}
    </GlassCard>
  );
}
