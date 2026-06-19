import { motion } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { Users, BookOpen, Clock, MoreVertical } from 'lucide-react';

export function Groups() {
  const groups = [
    { grade: '7А', subject: 'Алгебра', students: 25, avgGrade: '4.2', attendance: '95%' },
    { grade: '7Б', subject: 'Алгебра', students: 24, avgGrade: '4.6', attendance: '98%' },
    { grade: '9В', subject: 'Геометрия', students: 28, avgGrade: '3.8', attendance: '92%' },
    { grade: '10А', subject: 'Алгебра', students: 20, avgGrade: '4.8', attendance: '100%' },
    { grade: '10Б', subject: 'Алгебра', students: 22, avgGrade: '4.4', attendance: '96%' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 pb-32 max-w-6xl w-full">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Мои классы</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group, idx) => (
          <GlassCard key={idx} className="p-6 relative group overflow-hidden cursor-pointer hover:shadow-[0_8px_32px_rgba(37,99,235,0.1)] transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-gray-400 hover:text-gray-700">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/20">
                {group.grade}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{group.subject}</h3>
                <span className="text-xs font-semibold text-gray-500 flex items-center mt-1">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  {group.students} учеников
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100/50 pt-5 mt-2">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Средний балл</p>
                <p className="text-2xl font-bold text-gray-900 flex items-baseline space-x-1">
                  <span>{group.avgGrade}</span>
                  <span className="text-sm font-medium text-gray-400">/ 5</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Посещаемость</p>
                <p className="text-2xl font-bold text-gray-900">{group.attendance}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
}
