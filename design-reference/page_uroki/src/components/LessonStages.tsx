import { Check } from 'lucide-react';
import { motion } from 'motion/react';

const stages = [
  { id: 1, label: 'Цель', status: 'completed' },
  { id: 2, label: 'Теория', status: 'completed' },
  { id: 3, label: 'Практика', status: 'completed' },
  { id: 4, label: 'Задание', status: 'completed' },
  { id: 5, label: 'Проверка', status: 'active' },
  { id: 6, label: 'Итог', status: 'pending' },
];

export function LessonStages() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Этапы урока</h3>
      <div className="flex items-center justify-between px-4 relative">
        <div className="absolute top-[18px] left-[60px] right-[60px] h-[2px] bg-gray-200 z-0" />
        
        {stages.map((stage) => (
          <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2 group">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className={`w-9 h-9 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                stage.status === 'completed' 
                  ? 'bg-green-500 border-white text-white shadow-sm' 
                  : stage.status === 'active'
                  ? 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-4 ring-blue-100'
                  : 'bg-white/70 border-gray-200 text-gray-400 backdrop-blur-sm'
              }`}
            >
              {stage.status === 'completed' ? (
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              ) : stage.status === 'active' ? (
                 <div className="w-2 h-2 bg-white rounded-full" />
              ) : (
                <span className="text-xs font-bold">{stage.id}</span>
              )}
            </motion.div>
            <span className={`text-xs font-bold ${
              stage.status === 'completed' ? 'text-green-600' :
              stage.status === 'active' ? 'text-blue-700' :
              'text-gray-400 font-medium'
            }`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
