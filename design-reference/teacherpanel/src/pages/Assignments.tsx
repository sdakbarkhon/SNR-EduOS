import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { Plus, Filter, MoreHorizontal, FileText, CheckSquare, Sparkles, X, ChevronLeft, Send } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { AssignmentView } from '../types';

export function Assignments() {
  const [view, setView] = useState<AssignmentView>('list');

  return (
    <AnimatePresence mode="wait">
      {view === 'list' && <AssignmentList key="list" onNavigate={setView} />}
      {view === 'create' && <AssignmentCreate key="create" onNavigate={setView} />}
      {view === 'detail' && <AssignmentDetail key="detail" onNavigate={setView} />}
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------------
// SCREEN 2: Assignment List Workspace
// ----------------------------------------------------------------------
function AssignmentList({ onNavigate }: { onNavigate: (v: AssignmentView) => void }) {
  const chartData = [
    { name: 'Проверено', value: 45, color: '#10b981' },
    { name: 'На проверке', value: 25, color: '#f59e0b' },
    { name: 'Просрочено', value: 10, color: '#ef4444' },
  ];

  const assignments = [
    { id: 1, title: 'Уравнения с дробями', subject: 'Алгебра', group: '7А', type: 'Файл', submitted: 22, total: 25, status: 'Активно' },
    { id: 2, title: 'Теорема Пифагора', subject: 'Геометрия', group: '9В', type: 'Тест', submitted: 18, total: 30, status: 'Завершено' },
    { id: 3, title: 'Производная функции', subject: 'Алгебра', group: '10А', type: 'Файл', submitted: 5, total: 20, status: 'Активно' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 pb-32 max-w-7xl w-full flex space-x-8">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Задания</h1>
          <button 
            onClick={() => onNavigate('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-[12px] font-semibold shadow-lg shadow-blue-600/20 flex items-center transition-all"
          >
            <Plus className="w-5 h-5 mr-2" />
            Создать задание
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 mb-6">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur border border-white/50 rounded-full text-sm font-semibold shadow-sm text-gray-700">
            <Filter className="w-4 h-4" />
            <span>Все классы</span>
          </button>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm font-semibold shadow-sm">Все</button>
          <button className="px-4 py-2 bg-white/60 backdrop-blur border border-white/50 text-gray-600 rounded-full text-sm font-semibold shadow-sm">Активные</button>
          <button className="px-4 py-2 bg-white/60 backdrop-blur border border-white/50 text-gray-600 rounded-full text-sm font-semibold shadow-sm">Завершенные</button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map(a => (
            <GlassCard key={a.id} className="p-6 hover:bg-white/90 transition-colors cursor-pointer" onClick={() => onNavigate('detail')}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-[16px] bg-blue-50 flex items-center justify-center text-blue-600">
                    {a.type === 'Тест' ? <CheckSquare className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{a.title}</h3>
                    <p className="text-sm font-medium text-gray-500">{a.subject}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-2 mb-6">
                <Badge variant="blue">{a.group}</Badge>
                <Badge variant={a.type === 'Тест' ? 'yellow' : 'gray'}>{a.type}</Badge>
                {a.status === 'Активно' && <Badge variant="green">Активно</Badge>}
              </div>
              <div>
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span className="text-gray-500">Сдано</span>
                  <span className="text-gray-900">{a.submitted} / {a.total}</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${(a.submitted / a.total) * 100}%` }}
                  />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 space-y-6">
        <GlassCard className="p-6 flex flex-col items-center">
          <h3 className="font-bold text-gray-900 mb-6 self-start">Статистика проверок</h3>
          <div className="w-48 h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-bold text-gray-900">80</span>
              <span className="text-xs font-semibold text-gray-500">Всего работ</span>
            </div>
          </div>
          <div className="w-full mt-6 space-y-3">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-sm font-medium text-gray-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------------------------
// SCREEN 3: Creation Flow
// ----------------------------------------------------------------------
function AssignmentCreate({ onNavigate }: { onNavigate: (v: AssignmentView) => void }) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 pb-32 max-w-4xl w-full mx-auto">
      <button onClick={() => onNavigate('list')} className="flex items-center text-gray-500 hover:text-gray-900 font-semibold mb-6 transition-colors">
        <ChevronLeft className="w-5 h-5 mr-1" />
        Назад к заданиям
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Создание задания</h1>
        <div className="flex space-x-2">
          <div className={cn("w-2.5 h-2.5 rounded-full transition-colors", step === 1 ? "bg-blue-600" : "bg-gray-300")} />
          <div className={cn("w-2.5 h-2.5 rounded-full transition-colors", step === 2 ? "bg-blue-600" : "bg-gray-300")} />
        </div>
      </div>

      {step === 1 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-6 mt-10">
          <GlassCard className="p-8 hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all flex flex-col items-center justify-center text-center group bg-white/80" onClick={() => setStep(2)}>
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Тест</h2>
            <p className="text-gray-500 font-medium">Создайте тест с автоматической проверкой ответов.</p>
          </GlassCard>

          <GlassCard className="p-8 hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all flex flex-col items-center justify-center text-center group bg-white/80" onClick={() => setStep(2)}>
            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileText className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Загрузка файла</h2>
            <p className="text-gray-500 font-medium">Ученики должны загрузить документ или фото решения.</p>
          </GlassCard>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <GlassCard className="p-8 bg-white/80">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1 mr-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Название задания</label>
                <input type="text" className="w-full bg-white/50 border border-gray-200 rounded-[12px] px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" placeholder="Введите название..." />
              </div>
              <button className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-[12px] font-semibold shadow-lg shadow-blue-500/30 transition-all mt-7">
                <Sparkles className="w-5 h-5" />
                <span>Сгенерировать с помощью ИИ</span>
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Классы</label>
              <div className="flex space-x-2">
                <Badge variant="blue" className="px-3 py-1.5 cursor-pointer text-sm">7А</Badge>
                <Badge variant="gray" className="px-3 py-1.5 cursor-pointer text-sm">7Б</Badge>
                <Badge variant="gray" className="px-3 py-1.5 cursor-pointer text-sm">9В</Badge>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Вопросы</label>
              <GlassCard className="p-5 border border-blue-100 bg-blue-50/30 mb-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <input type="text" defaultValue="Чему равна площадь круга?" className="w-full bg-transparent font-bold text-lg text-gray-900 border-b border-transparent focus:border-blue-300 outline-none mb-4" />
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <input type="radio" name="q1" className="w-4 h-4 text-blue-600" />
                        <input type="text" defaultValue="πR²" className="bg-white/60 border border-gray-200 rounded-md px-3 py-1 font-medium flex-1 outline-none focus:border-blue-400" />
                      </div>
                      <div className="flex items-center space-x-3">
                        <input type="radio" name="q1" className="w-4 h-4 text-blue-600" />
                        <input type="text" defaultValue="2πR" className="bg-white/60 border border-gray-200 rounded-md px-3 py-1 font-medium flex-1 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-red-500 transition-colors p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </GlassCard>
              <button className="text-blue-600 font-bold flex items-center hover:underline">
                <Plus className="w-4 h-4 mr-1" /> Добавить вопрос
              </button>
            </div>
          </GlassCard>

          <div className="flex justify-end space-x-4">
            <button onClick={() => setStep(1)} className="px-6 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-[12px] transition-colors">Отмена</button>
            <button onClick={() => onNavigate('list')} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-[12px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">Опубликовать</button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ----------------------------------------------------------------------
// SCREEN 4 & 5: Grading Detail View
// ----------------------------------------------------------------------
function AssignmentDetail({ onNavigate }: { onNavigate: (v: AssignmentView) => void }) {
  const students = [
    { name: 'Анна Смирнова', status: 'Сдал', time: '12:30, 14 Окт', grade: null },
    { name: 'Максим Иванов', status: 'На проверке', time: '11:15, 14 Окт', grade: null, active: true },
    { name: 'Елизавета Котова', status: 'Оценено', time: '09:00, 14 Окт', grade: '5' },
    { name: 'Дмитрий Соколов', status: 'Не сдал', time: '-', grade: null },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 pb-32 max-w-full w-full h-[calc(100vh-80px)] flex space-x-6">
      
      {/* List Sidebar */}
      <div className="w-80 flex flex-col h-full">
        <button onClick={() => onNavigate('list')} className="flex items-center text-gray-500 hover:text-gray-900 font-semibold mb-6 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Назад
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-tight">Уравнения с дробями <span className="block text-sm text-gray-500 font-medium mt-1">7А класс</span></h2>
        
        <GlassCard className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/40">
            <input type="text" placeholder="Поиск ученика..." className="w-full bg-white/50 border border-white/60 rounded-[8px] px-3 py-2 text-sm outline-none focus:border-blue-400 font-medium" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {students.map((s, i) => (
              <div key={i} className={cn("p-3 rounded-[12px] cursor-pointer transition-colors flex items-center justify-between group", s.active ? "bg-blue-50/80 border border-blue-200/50 shadow-sm" : "hover:bg-white/60 text-gray-700")}>
                <div>
                  <h4 className={cn("text-sm font-bold", s.active ? "text-blue-900" : "text-gray-800")}>{s.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{s.time}</p>
                </div>
                {s.status === 'Сдал' ? <Badge variant="blue">Сдал</Badge> :
                 s.status === 'На проверке' ? <Badge variant="yellow">Проверка</Badge> :
                 s.status === 'Не сдал' ? <Badge variant="red">Не сдал</Badge> :
                 <Badge variant="green">Оценка: {s.grade}</Badge>}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Main Grading Split Interface */}
      <GlassCard className="flex-1 flex overflow-hidden border border-white/60">
        {/* Left: Document Viewer */}
        <div className="flex-1 bg-gray-50/50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Работа: Максим Иванов</h3>
            <div className="flex space-x-2">
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-[8px] text-sm font-semibold text-gray-600 shadow-sm">1/3 стр</button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-[16px] border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center">
            {/* Placeholder for uploaded assignment image */}
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Превью документа</p>
            </div>
          </div>
        </div>

        {/* Right: Grading Form */}
        <div className="w-80 border-l border-white/40 bg-white/30 p-6 flex flex-col">
          <h3 className="font-bold text-gray-900 mb-6">Оценка</h3>
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Балл (из 5)</label>
            <input type="number" min="1" max="5" className="w-full bg-white/80 border border-gray-200 rounded-[12px] px-4 py-3 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-blue-600" placeholder="-" />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-bold text-gray-700 mb-2">Комментарий</label>
            <textarea className="w-full flex-1 bg-white/80 border border-gray-200 rounded-[12px] p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-medium text-gray-800" placeholder="Напишите отзыв..."></textarea>
            
            <button className="mt-3 flex items-center justify-center space-x-2 w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-[10px] text-sm font-bold transition-colors">
              <Sparkles className="w-4 h-4" />
              <span>✨ ИИ-подсказка</span>
            </button>
          </div>

          <button className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[12px] font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2">
            <span>Сохранить</span>
            <Send className="w-4 h-4 ml-1" />
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
