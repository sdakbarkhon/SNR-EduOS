import { Plus } from "lucide-react";

// ── Моки (захардкожены, без БД) ──
const projects = [
  { id: 1, title: "Умный дом", status: "В работе", progress: 75, gradient: "from-violet-900 via-indigo-800 to-blue-900", image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=600&h=400" },
  { id: 2, title: "Робот-манипулятор", status: "В работе", progress: 80, gradient: "from-orange-900 via-red-900 to-rose-900", image: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&q=80&w=600&h=400" },
  { id: 3, title: "Сайт-портфолио", status: "Завершён", progress: 100, gradient: "from-emerald-900 via-teal-800 to-cyan-900", image: "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&q=80&w=600&h=400" },
  { id: 4, title: "Метеостанция", status: "В работе", progress: 40, gradient: "from-sky-900 via-blue-800 to-indigo-900", image: "https://images.unsplash.com/photo-1592210454359-9043f067919b?auto=format&fit=crop&q=80&w=600&h=400" },
  { id: 5, title: "Игра на Python", status: "В работе", progress: 90, gradient: "from-fuchsia-900 via-purple-800 to-violet-900", image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&q=80&w=600&h=400" },
];

function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button className={`rounded-full px-6 py-2 text-sm font-bold transition-all duration-300 ${
      active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "border border-white/50 bg-white/70 text-slate-600 backdrop-blur-xl hover:bg-white/90"
    }`}>
      {label}
    </button>
  );
}

export function ProjectsView() {
  return (
    <div className="mx-auto w-full max-w-7xl text-slate-800">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Проекты</h1>
        <div className="mt-4 flex gap-2">
          <FilterPill label="Мои проекты" active />
          <FilterPill label="В работе" />
          <FilterPill label="Завершённые" />
        </div>
      </div>

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 content-start items-start gap-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const isCompleted = p.status === "Завершён";
          return (
            <div key={p.id} className="group flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-white bg-white/70 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="relative h-28 overflow-hidden bg-slate-900">
                <div className={`absolute inset-0 bg-gradient-to-br ${p.gradient} opacity-90`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} className="h-full w-full object-cover opacity-60 mix-blend-luminosity transition-opacity duration-300 group-hover:scale-105 group-hover:opacity-80" />
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  isCompleted ? "bg-green-400/90 text-green-950" : "bg-yellow-400/90 text-yellow-950"
                }`}>
                  {p.status}
                </span>
              </div>
              <div className="p-5">
                <h3 className="mb-4 font-bold text-slate-900">{p.title}</h3>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-slate-400">{p.progress}%</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* New project card */}
        <div className="group flex h-full min-h-[178px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-slate-300 bg-slate-100/30 transition-all hover:bg-slate-100/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-transform group-hover:scale-110">
            <Plus className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-500">Новый проект</p>
        </div>
      </div>
    </div>
  );
}
