import { Clock } from 'lucide-react';
import { motion } from 'motion/react';

export function LessonTask() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-1 flex flex-col h-full"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Задание урока</h3>
      <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-xl flex flex-col">
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          Соберите схему на макетной плате, используя один светодиод, резистор 220 Ом и тактовую кнопку. Ваша задача — написать скетч для Arduino так, чтобы светодиод загорался только при нажатой кнопке. Убедитесь в правильности подключения полярности и надежности соединений перед подключением питания.
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Осталось: 45 минут</span>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 bg-[#2563EB] text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:bg-blue-700 transition-all text-sm"
          >
            Начать задание
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
