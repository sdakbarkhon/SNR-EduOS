import { motion } from 'motion/react';
import { GlassCard } from './components/GlassCard';
import { BalanceHero } from './components/BalanceHero';
import { AnalyticsChart } from './components/AnalyticsChart';
import { PaymentsHistory } from './components/PaymentsHistory';
import { ChargesHistory } from './components/ChargesHistory';

export default function App() {
  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-slate-800 antialiased" style={{ background: 'linear-gradient(135deg, #eefcff 0%, #f4f0ff 50%, #e0f2ff 100%)' }}>
      {/* Floating Background Shapes */}
      <div className="absolute top-[-100px] left-[-50px] w-80 h-80 bg-blue-300 opacity-20 rounded-full blur-[80px] animate-blob"></div>
      <div className="absolute bottom-[-50px] right-[-100px] w-96 h-96 bg-purple-300 opacity-20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-cyan-200 opacity-30 rounded-xl rotate-45 blur-[40px] animate-blob animation-delay-4000"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#007AFF] text-white rounded-[14px] flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
              SNR
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">Оплаты и Баланс</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/70 border border-white flex items-center justify-center text-blue-600 shadow-sm cursor-pointer hover:bg-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-white overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
              <div className="w-full h-full bg-gradient-to-tr from-blue-400 to-indigo-500"></div>
            </div>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <BalanceHero />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AnalyticsChart />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="h-full"
          >
            <PaymentsHistory />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="h-full"
          >
            <ChargesHistory />
          </motion.div>
        </div>

        <footer className="mt-8 flex items-center justify-between opacity-60">
          <p className="text-xs font-medium text-slate-500">SNR EduOS v2.4 • Система управления обучением</p>
          <div className="flex gap-4">
            <span className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer transition-colors">Поддержка</span>
            <span className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer transition-colors">Политика конфиденциальности</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
