import { FileText, MonitorPlay, FileCode2, CircuitBoard } from 'lucide-react';
import { motion } from 'motion/react';

const materials = [
  { id: 1, title: 'Презентация', icon: MonitorPlay, color: 'text-orange-600', bg: 'bg-orange-100' },
  { id: 2, title: 'Инструкция', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  { id: 3, title: 'Схемы', icon: CircuitBoard, color: 'text-purple-600', bg: 'bg-purple-100' },
  { id: 4, title: 'Примеры кода', icon: FileCode2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
];

export function LessonMaterials() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Материалы урока</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {materials.map((item) => (
          <motion.div
            whileHover={{ y: -2 }}
            key={item.id}
            className="bg-white/70 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-4 group cursor-pointer"
          >
            <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform duration-300`}>
              <item.icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold">{item.title}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
