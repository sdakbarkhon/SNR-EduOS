import {
  Bell,
  ChevronRight,
  Activity,
  Book,
  Hash,
  Hexagon,
  FolderOpen,
  FileText,
  TerminalSquare,
} from "lucide-react";
import React from "react";

// --- Mock Data ---

const scheduleData = [
  {
    id: 1,
    time: "09:00",
    timeStyle: "text-blue-500",
    duration: "45 мин",
    durationStyle: "text-green-500",
    lineColor: "bg-green-400",
    title: "Робототехника",
    subtitle: "#каб_305",
    room: "Каб. 305",
    status: "Сейчас",
    statusStyle: "bg-green-100 text-green-600",
  },
  {
    id: 2,
    time: "10:00",
    timeStyle: "text-blue-500",
    duration: "45 мин",
    durationStyle: "text-blue-500",
    lineColor: "bg-blue-400",
    title: "Математика",
    subtitle: "#каб_301",
    room: "Каб. 301",
    status: "Скоро",
    statusStyle: "bg-orange-100 text-orange-500",
  },
  {
    id: 3,
    time: "11:00",
    timeStyle: "text-red-400",
    duration: "45 мин",
    durationStyle: "text-orange-400",
    lineColor: "bg-orange-400",
    title: "Информатика",
    subtitle: "#каб_307",
    room: "Каб. 307",
    status: "Скоро",
    statusStyle: "bg-orange-100 text-orange-500",
  },
  {
    id: 4,
    time: "12:00",
    timeStyle: "text-blue-500",
    duration: "45 мин",
    durationStyle: "text-orange-400",
    lineColor: "bg-pink-400",
    title: "Физика",
    subtitle: "#каб_302",
    room: "Каб. 302",
    status: "5 мин",
    statusStyle: "bg-transparent text-blue-400 border border-blue-200/50",
  },
  {
    id: 5,
    time: "13:00",
    timeStyle: "text-green-500",
    duration: "45 мин",
    durationStyle: "text-green-500",
    lineColor: "bg-green-300",
    title: "Английский язык",
    subtitle: "#каб_101",
    room: "Каб. 101",
    status: "5 мин",
    statusStyle: "bg-transparent text-blue-400 border border-blue-200/50",
  },
  {
    id: 6,
    time: "14:00",
    timeStyle: "text-orange-500",
    duration: "45 мин",
    durationStyle: "text-orange-500",
    lineColor: "bg-cyan-400",
    title: "История",
    subtitle: "#каб_105",
    room: "Каб. 105",
    status: "5 мин",
    statusStyle: "bg-transparent text-blue-400 border border-blue-200/50",
  },
];

const homeworkData = [
  {
    id: 1,
    subject: "Робототехника",
    subjectIcon: <Book size={18} className="text-orange-500" />,
    subjectBg: "bg-orange-100",
    taskIcon: <FolderOpen size={16} className="text-blue-600 mt-1" />,
    taskTitle: "Проект: Умный дом",
    taskSub: "Ожидается",
    deadline: "до 16 мая",
  },
  {
    id: 2,
    subject: "Математика",
    subjectIcon: <Hash size={18} className="text-blue-500" />,
    subjectBg: "bg-blue-100",
    taskIcon: <FileText size={16} className="text-pink-500 mt-1" />,
    taskTitle: "№134, 135, 136",
    taskSub: "Учебник",
    deadline: "до 16 мая",
  },
  {
    id: 3,
    subject: "Информатика",
    subjectIcon: <Hexagon size={18} className="text-orange-500" />,
    subjectBg: "bg-orange-100",
    taskIcon: <TerminalSquare size={16} className="text-purple-600 mt-1" />,
    taskTitle: "Практика в Python",
    taskSub: "Проверка",
    deadline: "до 16 мая",
  },
];

// --- Components ---

export default function App() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#eef1ff] flex items-center justify-center p-4 sm:p-8">
      {/* Decorative Luminous Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-300 opacity-40 mix-blend-multiply filter blur-[100px] animate-blob"></div>
        <div className="absolute top-[-5%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-pink-300 opacity-40 mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-purple-300 opacity-40 mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-blue-300 opacity-40 mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>

      {/* Main Glass Application Container */}
      <main className="relative w-full max-w-6xl rounded-[2.5rem] bg-white/70 backdrop-blur-2xl border border-white/60 shadow-glass overflow-hidden flex flex-col p-8 sm:p-10 z-10">
        
        {/* Top Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-indigo-950">
            <div className="w-8 h-8 rounded-full bg-indigo-100/80 flex items-center justify-center">
              <Activity size={18} className="text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              3. Уроки (список уроков)
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center border border-white/50 shadow-sm transition hover:bg-white/80">
              <Bell size={20} className="text-indigo-500" />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center bg-white/80">
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150&h=150" 
                alt="User Profile" 
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-8">
          <button className="px-6 py-2.5 rounded-full bg-[#185AF7] text-white font-medium text-sm shadow-md transition hover:bg-[#154ED8]">
            Сегодня
          </button>
          <button className="px-6 py-2.5 rounded-full bg-white/60 backdrop-blur-md text-indigo-900 font-medium text-sm border border-white/50 shadow-sm transition hover:bg-white/80">
            Неделя
          </button>
          <button className="px-6 py-2.5 rounded-full bg-white/60 backdrop-blur-md text-indigo-900 font-medium text-sm border border-white/50 shadow-sm transition hover:bg-white/80">
            Все предметы
          </button>
        </div>

        {/* Two Column Layout layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
          
          {/* Left Column: Schedule */}
          <div className="col-span-1 lg:col-span-8 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-5 pl-2">
              <h2 className="text-xl font-bold text-indigo-950">Среда, 14 мая</h2>
              <button className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center transition hover:bg-white/90">
                <ChevronRight size={20} className="text-indigo-900" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-3">
              {scheduleData.map((item) => (
                <div 
                  key={item.id} 
                  className="group relative flex items-center bg-white/80 backdrop-blur-xl border border-white/70 p-4 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition hover:shadow-soft"
                >
                  {/* Left Color Indicator */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-r-full ${item.lineColor}`}></div>
                  
                  {/* Time */}
                  <div className="w-20 pl-4 shrink-0 flex flex-col justify-center">
                    <span className={`font-bold text-[15px] ${item.timeStyle}`}>{item.time}</span>
                    <span className={`text-[11px] font-semibold mt-0.5 ${item.durationStyle}`}>{item.duration}</span>
                  </div>

                  {/* Subject Details */}
                  <div className="flex-1 px-4 min-w-0">
                    <h3 className="font-bold text-indigo-950 text-base truncate">{item.title}</h3>
                    <p className="text-slate-400 text-xs font-medium mt-0.5">{item.subtitle}</p>
                  </div>

                  {/* Room Number */}
                  <div className="w-24 shrink-0 px-2 text-center text-sm font-medium text-slate-500">
                    {item.room}
                  </div>

                  {/* Status Tag */}
                  <div className="w-28 shrink-0 flex justify-end pr-2">
                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${item.statusStyle}`}>
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Homework Panel */}
          <div className="col-span-1 lg:col-span-4 flex flex-col">
            <div className="bg-white/50 backdrop-blur-[32px] border border-white/50 rounded-[2rem] p-6 shadow-glass flex flex-col h-full relative z-10 overflow-hidden">
              
              <h2 className="text-lg font-bold text-indigo-950 mb-6 px-2">
                Домашние задания
              </h2>

              <div className="flex-1 overflow-y-auto space-y-5 pb-24">
                {homeworkData.map((hw, idx) => (
                  <div key={hw.id} className="group relative">
                    <div className="flex items-center justify-between mb-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${hw.subjectBg} flex items-center justify-center`}>
                          {hw.subjectIcon}
                        </div>
                        <span className="font-bold text-sm text-indigo-950">{hw.subject}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>

                    <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl p-4 shadow-sm relative transition hover:bg-white/80">
                      {/* Decorative fade behind the icon */}
                      <div className="absolute top-4 left-4 w-6 h-6 rounded-full blur-md opacity-30 mix-blend-multiply bg-current text-blue-500"></div>
                      
                      <div className="flex gap-3 relative z-10">
                        <div className="shrink-0 pt-0.5">
                          {hw.taskIcon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-indigo-950 truncate">{hw.taskTitle}</p>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">{hw.taskSub}</p>
                        </div>
                      </div>
                      <div className="text-right mt-2 w-full">
                        <span className="text-[11px] font-medium text-slate-500">{hw.deadline}</span>
                      </div>
                      {/* Separate lines separator between items except last one could go here, but visual design uses spacing */}
                    </div>
                    {idx < homeworkData.length - 1 && (
                       <div className="absolute -bottom-2.5 left-[10%] right-[10%] h-px bg-slate-200/50"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Fixed CTA Button inside panel at bottom */}
              <div className="absolute bottom-6 left-6 right-6">
                <button className="w-full py-4 bg-[#185AF7] hover:bg-[#154ED8] text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/25 transition transform active:scale-[0.98]">
                  Открыть расписание
                </button>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
