import { MapPin, UserIcon as User2 } from 'lucide-react';
import { motion } from 'motion/react';

export function HeroCard() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative bg-gradient-to-br from-[#1E40AF] via-[#4338CA] to-[#7C3AED] rounded-[24px] p-8 text-white shadow-2xl overflow-hidden min-h-[210px] flex flex-col md:flex-row gap-8"
    >
      <div className="relative z-10 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
            Робототехника и электроника
          </p>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">
            Урок 12. Управление <br className="hidden lg:block"/> светодиодом и кнопкой
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center">
                <User2 className="w-3 h-3 text-indigo-700" />
              </div>
              <span className="text-sm font-medium">Иван Петрович</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-full text-sm font-medium border border-white/10 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/70" />
              Кабинет 305
            </div>
          </div>
        </div>
        <div className="w-full max-w-sm mt-6 md:mt-10">
          <div className="flex justify-between text-xs mb-2 text-white/80 font-medium">
            <span>Прогресс урока</span>
            <span>5/7 этапов</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="h-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.4)]"
            />
          </div>
        </div>
      </div>
      
      <motion.div 
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="w-48 lg:w-[180px] flex-shrink-0 flex items-center justify-center opacity-90 mx-auto md:mx-0"
      >
        <div className="relative">
          <div className="w-32 h-20 bg-indigo-900/50 rounded-xl border border-white/20 backdrop-blur-sm -rotate-6 flex items-center justify-center">
            <div className="w-24 h-2 bg-green-400 rounded-full" />
          </div>
          <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-orange-400 rounded-full border-4 border-white/20 overflow-hidden">
             <img 
               src="https://images.unsplash.com/photo-1555664424-778a1e5e1b48?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" 
               alt="Робототехника"
               className="w-full h-full object-cover"
             />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
