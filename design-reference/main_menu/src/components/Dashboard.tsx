import { GlassCard } from './GlassCard';
import { NextLessonCard } from './NextLessonCard';
import { 
  Bot, Binary, Monitor, Palette, Globe, 
  FileText, Copy, Lock, Coins, Sparkles, Star
} from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex flex-col space-y-6 pb-20">
      
      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NextLessonCard />
        
        {/* My Tasks Card */}
        <GlassCard className="flex flex-col p-6 min-w-[240px]">
          <h3 className="text-[15px] font-semibold text-gray-800 mb-5">Мои задания</h3>
          <div className="flex flex-col h-full justify-center">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border-[3px] border-white shadow-sm">
                 <Copy className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[28px] font-bold text-gray-900 leading-none">3 <span className="text-[16px] text-gray-900 ml-1">активных</span></span>
              </div>
            </div>
            {/* Small pills below */}
            <div className="flex items-center gap-2 mt-auto">
              <div className="px-3 py-1 bg-green-100 rounded-full text-green-700 text-[12px] font-bold tracking-wide flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> 1 на сегодня
              </div>
              <div className="px-3 py-1 bg-gray-100 rounded-full text-gray-500 text-[12px] font-medium">
                2 на завтра
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Progress Card */}
        <GlassCard className="flex flex-col p-6 min-w-[240px]">
          <h3 className="text-[15px] font-semibold text-gray-800 mb-4">Прогресс недели</h3>
          <div className="flex items-center gap-6 h-full">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#f3f4f6" strokeWidth="12" fill="transparent" />
                <circle cx="50" cy="50" r="40" stroke="#3b82f6" strokeWidth="12" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 0.68)} strokeLinecap="round" className="text-blue-500 drop-shadow-md" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[13px] font-bold text-gray-900">44</span>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-[32px] font-bold text-gray-900 leading-none flex items-center gap-2">
                68% <span className="text-orange-400 text-2xl">⚡</span>
              </h4>
              <p className="text-[14px] text-gray-400 font-medium mt-1">44 / 65 заданий</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Hero Banner (Fact of the Day) */}
      <div className="w-full h-[180px] rounded-[32px] overflow-hidden relative shadow-lg bg-gradient-to-r from-[#179BFF] via-[#336ff8] to-[#6d4aff] text-white p-8 flex items-center border border-white/20">
        <div className="flex flex-col z-10 max-w-[60%]">
          <span className="text-[14px] font-bold text-blue-200 uppercase tracking-widest mb-2">Факт дня</span>
          <h2 className="text-[26px] font-bold mb-3 leading-tight text-white drop-shadow-sm">Первый программист в мире была женщина!</h2>
          <p className="text-[15px] text-blue-100/90 leading-relaxed max-w-[90%] font-medium">Ада Лавлейс написала первую программу для аналитической машины Чарльза Бэббиджа. Она поняла, что машины могут не только считать!</p>
        </div>
        {/* Placeholder for Robot illustration */}
        <div className="absolute right-[-20%] md:right-0 bottom-[-10%] w-[320px] h-[320px] mix-blend-luminosity filter contrast-125 opacity-40">
           <img 
            src="https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&q=80" 
            alt="Robot Graphic" 
            className="w-full h-full object-cover rounded-full"
            style={{ maskImage: 'radial-gradient(black, transparent)'}}
          />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* My Subjects */}
        <GlassCard className="lg:col-span-2 p-6 flex flex-col">
          <h3 className="text-[16px] font-bold text-gray-800 mb-6">Мои предметы</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
            {[
              { title: 'Робототехника', icon: Bot, color: 'bg-green-100 text-green-600', score: 4.5 },
              { title: 'Математика', icon: Binary, color: 'bg-orange-100 text-orange-500', score: 5.0 },
              { title: 'Информатика', icon: Monitor, color: 'bg-purple-100 text-purple-600', score: 4.0 },
              { title: 'ИЗО', icon: Palette, color: 'bg-blue-100 text-blue-500', score: 5.0 },
              { title: 'Английский', icon: Globe, color: 'bg-pink-100 text-pink-500', score: 4.5 },
            ].map((subject, idx) => {
              const Icon = subject.icon;
              return (
                <div key={idx} className="flex flex-col items-center justify-center p-4 rounded-2xl hover:bg-white/40 transition-colors">
                  <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center mb-4 ${subject.color} shadow-sm border border-white`}>
                    <Icon className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  <span className="text-[13px] font-bold text-gray-800 mb-2 truncate w-full text-center">{subject.title}</span>
                  <div className="flex items-center gap-[2px]">
                    {[1,2,3,4,5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-3 h-3 ${star <= Math.floor(subject.score) ? 'fill-orange-400 text-orange-400' : (star - subject.score === 0.5 ? 'fill-orange-400/50 text-orange-400/50' : 'fill-gray-200 text-gray-200')}`} 
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Recent Materials */}
        <GlassCard className="p-6 flex flex-col">
          <h3 className="text-[16px] font-bold text-gray-800 mb-6">Недавние материалы</h3>
          <div className="flex flex-col space-y-4 flex-1">
            {[
              { title: 'Презентация_урок_8.pptx', icon: FileText, color: 'text-green-600 bg-green-100', extcolor: 'text-green-500' },
              { title: 'Схема_робота.pdf', icon: Lock, color: 'text-purple-600 bg-purple-100', extcolor: 'text-purple-500' },
              { title: 'Код_примера.py', icon: FileText, color: 'text-blue-600 bg-blue-100', extcolor: 'text-blue-500' },
            ].map((file, idx) => {
              const Icon = file.icon;
              return (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/50 transition-colors cursor-pointer border border-transparent hover:border-white/60">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${file.color}`}>
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  <span className="text-[14px] font-bold text-gray-700 truncate">{file.title}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Bottom Status Row */}
      <div className="flex items-center justify-between w-full mt-4 pt-2">
        <GlassCard className="flex items-center gap-3 px-5 py-3 rounded-[20px]">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
            <Coins className="w-5 h-5 text-orange-500" />
          </div>
          <span className="text-[15px] font-bold text-gray-800">12583 <span className="text-gray-500 font-medium">монеты</span></span>
        </GlassCard>

        <div className="flex items-center gap-4">
          <GlassCard className="flex items-center gap-4 px-6 py-3 rounded-[20px]">
             <Sparkles className="w-5 h-5 text-purple-600" />
             <span className="text-[15px] font-bold text-gray-800">Ваш уровень: 5</span>
             <div className="flex flex-col w-[120px] ml-2">
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full w-[70%]"></div>
                </div>
             </div>
          </GlassCard>
        </div>
      </div>

    </div>
  );
}
