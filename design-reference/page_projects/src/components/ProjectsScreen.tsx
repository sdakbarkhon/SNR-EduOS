import React from 'react';
import { Plus } from 'lucide-react';

const projects = [
  {
    id: 1,
    title: 'Умный дом',
    status: 'В работе',
    progress: 75,
    gradient: 'from-violet-900 via-indigo-800 to-blue-900',
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    id: 2,
    title: 'Робот-манипулятор',
    status: 'В работе',
    progress: 80,
    gradient: 'from-orange-900 via-red-900 to-rose-900',
    image: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    id: 3,
    title: 'Сайт-портфолио',
    status: 'Завершён',
    progress: 100,
    gradient: 'from-emerald-900 via-teal-800 to-cyan-900',
    image: 'https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    id: 4,
    title: 'Метеостанция',
    status: 'В работе',
    progress: 40,
    gradient: 'from-sky-900 via-blue-800 to-indigo-900',
    image: 'https://images.unsplash.com/photo-1592210454359-9043f067919b?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    id: 5,
    title: 'Игра на Python',
    status: 'В работе',
    progress: 90,
    gradient: 'from-fuchsia-900 via-purple-800 to-violet-900',
    image: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&q=80&w=600&h=400'
  }
];

export default function ProjectsScreen() {
  return (
    <div className="px-12 pt-2 mb-6 w-full max-w-7xl mx-auto flex flex-col h-full items-stretch relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Проекты</h1>
          <div className="flex gap-2 mt-4">
            <FilterPill label="Мои проекты" active />
            <FilterPill label="В работе" />
            <FilterPill label="Завершённые" />
          </div>
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 pb-12 mt-8 items-start content-start">
        {projects.map((project) => (
          <ProjectCard key={project.id} {...project} />
        ))}
        
        {/* New Project Card */}
        <div className="bg-slate-100/30 border-2 border-dashed border-slate-300 h-full min-h-[178px] rounded-[20px] flex flex-col items-center justify-center group cursor-pointer hover:bg-slate-100/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" strokeWidth={2} />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-500">Новый проект</p>
        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
          : 'bg-white/70 backdrop-blur-xl border border-white/50 text-slate-600 hover:bg-white/90'
      }`}
    >
      {label}
    </button>
  );
}

function ProjectCard({ title, status, progress, image, gradient }: { title: string, status: string, progress: number, image: string, gradient: string }) {
  const isCompleted = status === 'Завершён';
  
  return (
    <div className="group bg-white/70 backdrop-blur-xl border border-white shadow-md rounded-[20px] overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Visual Header */}
      <div className={`h-28 relative bg-slate-900 overflow-hidden`}>
        {/* Using gradient from component definition as per original design, adapted to fit target layout height/theme */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}></div>
        <img src={image} alt={title} className="w-full h-full object-cover opacity-60 mix-blend-luminosity group-hover:opacity-80 transition-opacity duration-300 group-hover:scale-105" />
        
        {/* Status Chip */}
        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${
            isCompleted 
              ? 'bg-green-400/90 text-green-950' 
              : 'bg-yellow-400/90 text-yellow-950'
          }`}>
            {status}
        </span>
      </div>

      {/* Content Area */}
      <div className="p-5">
        <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
        
        {/* Progress Section */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
