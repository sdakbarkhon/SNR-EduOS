import { motion } from 'motion/react';
import { BookOpen, Users, Clock, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

export function Dashboard() {
  const kpis = [
    { title: "Всего учеников", value: "142", icon: Users, variant: "gray" as const },
    { title: "На проверке", value: "28", icon: FileText, variant: "blue" as const, highlight: true },
    { title: "Проверено (за неделю)", value: "156", icon: CheckCircle2, variant: "green" as const },
    { title: "Средний балл", value: "4.6", icon: BookOpen, variant: "yellow" as const },
  ];

  const todayLessons = [
    { time: "08:30 - 09:15", group: "7А", type: "Алгебра", room: "Каб. 42" },
    { time: "09:25 - 10:10", group: "7Б", type: "Алгебра", room: "Каб. 42" },
    { time: "10:30 - 11:15", group: "9В", type: "Геометрия", room: "Каб. 42" },
    { time: "11:35 - 12:20", group: "10А", type: "Алгебра", room: "Каб. 42" },
  ];

  const recentActivities = [
    { name: "Анна Смирнова", action: "сдала задание", task: "Уравнения с дробями", time: "10 мин назад", group: "7А", avatar: "A" },
    { name: "Максим Иванов", action: "оставил комментарий к", task: "Теорема Пифагора", time: "45 мин назад", group: "9В", avatar: "M" },
    { name: "Елизавета Котова", action: "сдала задание", task: "Уравнения с дробями", time: "1 час назад", group: "7А", avatar: "Е" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-8 pb-32 max-w-6xl w-full flex-1 flex flex-col min-h-0"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 shrink-0 gap-4">
        <h1 className="text-3xl font-bold text-slate-800">Здравствуйте, Иван Петрович! 👋</h1>
        <div className="flex items-center gap-4 hidden md:flex">
          <button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2 hover:brightness-110 transition-all text-sm">
            ✨ Сгенерировать с помощью ИИ
          </button>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
        {kpis.map((kpi, idx) => {
          const isHighlight = kpi.highlight;
          return (
            <div 
              key={idx} 
              className={cn(
                "p-5 rounded-[24px] relative overflow-hidden flex flex-col justify-between h-32",
                isHighlight 
                  ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30" 
                  : "bg-white/70 backdrop-blur-xl border border-white shadow-sm"
              )}
            >
              <div className="relative z-10">
                <div className={cn("text-sm mb-1", isHighlight ? "opacity-80" : "text-slate-500")}>
                  {kpi.title}
                </div>
                <div className={cn("text-3xl font-bold", isHighlight ? "text-white" : "text-slate-800")}>
                  {kpi.value}
                </div>
              </div>
              
              {isHighlight && (
                <div className="absolute -bottom-2 -right-2 opacity-20">
                  <kpi.icon className="w-20 h-20" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Today's Lessons */}
        <section className="flex-[1.5] bg-white/70 backdrop-blur-xl border border-white p-6 rounded-[24px] shadow-sm flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-5 shrink-0">
            <h2 className="text-lg font-bold">Сегодняшние уроки</h2>
            <span className="text-xs text-blue-600 font-medium cursor-pointer">Показать всё</span>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2">
            {todayLessons.map((lesson, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white/50 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex-1"> 
                  <div className="font-bold">{lesson.type}</div>
                  <div className="text-xs text-slate-400">{lesson.room}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{lesson.time.split(' - ')[0]}</div>
                  <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mt-1">{lesson.group}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activities */}
        <section className="flex-1 bg-white/70 backdrop-blur-xl border border-white p-6 rounded-[24px] shadow-sm flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-lg font-bold">Последние действия</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {recentActivities.map((act, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shadow-sm text-xs font-bold shrink-0">
                  {act.avatar}
                </div>
                <div className="text-sm">
                  <span className="font-bold">{act.name}</span> {act.action} <span className="text-blue-600 font-medium italic">«{act.task}»</span>
                  <div className="text-[10px] text-slate-400 mt-1">{act.time}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
