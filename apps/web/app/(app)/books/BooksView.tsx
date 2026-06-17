import {
  Star, Calculator, Zap, Terminal, Landmark, MessageCircle, Ruler, Leaf, FlaskConical,
} from "lucide-react";

// ── Моки (захардкожены, без БД) ──
const books = [
  { id: 1, title: "Алгебра 7 класс", type: "Учебник", color: "from-blue-400 to-blue-600", icon: Calculator, favorite: false },
  { id: 2, title: "Физика 7 класс", type: "Учебник", color: "from-purple-400 to-purple-600", icon: Zap, favorite: true },
  { id: 3, title: "Информатика", type: "Конспект", color: "from-orange-400 to-orange-500", icon: Terminal, favorite: false },
  { id: 4, title: "История 7 класс", type: "Учебник", color: "from-amber-600 to-amber-800", icon: Landmark, favorite: false },
  { id: 5, title: "Английский язык", type: "Сборник", color: "from-pink-400 to-rose-500", icon: MessageCircle, favorite: true },
  { id: 6, title: "Геометрия 7 класс", type: "Учебник", color: "from-emerald-400 to-emerald-600", icon: Ruler, favorite: false },
  { id: 7, title: "Биология 7 класс", type: "Учебник", color: "from-green-400 to-green-600", icon: Leaf, favorite: false },
  { id: 8, title: "Химия 7 класс", type: "Учебник", color: "from-indigo-400 to-purple-500", icon: FlaskConical, favorite: true },
];

const filterTabs = [
  { label: "Мои книги", active: true },
  { label: "Библиотека школы", active: false },
  { label: "Избранное", active: false },
];

export function BooksView() {
  return (
    <section className="mx-auto max-w-7xl text-slate-800">
      <h1 className="mb-6 text-3xl font-bold text-slate-800">Книги и учебники</h1>

      <div className="mb-8 flex flex-wrap gap-4">
        {filterTabs.map((tab) => (
          <button key={tab.label}
            className={tab.active
              ? "rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200"
              : "rounded-full border border-white/50 bg-white/70 px-6 py-2.5 font-medium text-slate-700 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl"}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
        {books.map((book) => {
          const Icon = book.icon;
          return (
            <div key={book.id} className="group cursor-pointer">
              <div className={`relative mb-3 flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${book.color}`}>
                <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.1) 100%)" }} />
                <button className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-white/70 p-1.5 backdrop-blur-xl transition-colors hover:bg-white/80">
                  <Star className={`h-4 w-4 ${book.favorite ? "fill-yellow-400 text-yellow-400" : "text-slate-400/80"}`} />
                </button>
                <Icon className="relative z-0 h-12 w-12 text-white/50 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
              </div>
              <p className="mb-0.5 text-xs uppercase tracking-wide text-slate-400">{book.type}</p>
              <h3 className="text-sm font-bold leading-tight text-slate-800">{book.title}</h3>
            </div>
          );
        })}
      </div>

      <footer className="mt-12 flex justify-center pb-6">
        <button className="rounded-2xl bg-blue-600 px-12 py-4 font-bold text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95">
          Открыть библиотеку
        </button>
      </footer>
    </section>
  );
}
