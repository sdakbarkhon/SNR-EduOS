import {
  Search, FileText, BookOpen, Link as LinkIcon, Video, Presentation, FileImage, File,
} from "lucide-react";

type MaterialType = "PDF" | "Book" | "Link" | "Video" | "Presentation" | "Image" | "File";
interface MaterialInfo {
  id: string; title: string; subject: string; type: MaterialType; date: string; colorHex: string;
}

// ── Моки (захардкожены, без БД) ──
const mockMaterials: MaterialInfo[] = [
  { id: "1", title: "Лабораторная работа №3", subject: "Робототехника", type: "PDF", date: "17 июня", colorHex: "text-red-500 bg-red-100/50" },
  { id: "2", title: "Конспект: системы уравнений", subject: "Математика", type: "Book", date: "16 июня", colorHex: "text-blue-500 bg-blue-100/50" },
  { id: "3", title: "Статья: история программирования", subject: "Информатика", type: "Link", date: "15 июня", colorHex: "text-gray-500 bg-gray-100/50" },
  { id: "4", title: "Видео: введение в Python", subject: "Информатика", type: "Video", date: "12 июня", colorHex: "text-purple-500 bg-purple-100/50" },
  { id: "5", title: "Презентация: основы Arduino", subject: "Робототехника", type: "Presentation", date: "10 июня", colorHex: "text-orange-500 bg-orange-100/50" },
  { id: "6", title: "Схема: подключение датчиков", subject: "Физика", type: "Image", date: "8 июня", colorHex: "text-emerald-500 bg-emerald-100/50" },
  { id: "7", title: "Инструкция к сборке робота", subject: "Робототехника", type: "PDF", date: "5 июня", colorHex: "text-red-500 bg-red-100/50" },
  { id: "8", title: "Примеры кода на Python", subject: "Информатика", type: "File", date: "2 июня", colorHex: "text-slate-600 bg-slate-200/50" },
];
const mockRecent: MaterialInfo[] = [0, 3, 1, 4].map((i) => mockMaterials[i]!);

const iconMap: Record<MaterialType, typeof FileText> = {
  PDF: FileText, Book: BookOpen, Link: LinkIcon, Video, Presentation, Image: FileImage, File,
};

const tabs = ["Все", "Презентации", "Видео", "PDF", "Книги", "Ссылки"];

export function MaterialsView() {
  return (
    <div className="text-slate-800">
      {/* Header */}
      <header className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Материалы</h1>
        <div className="relative w-80 max-w-[50vw]">
          <input type="text" placeholder="Поиск материалов..."
            className="w-full rounded-2xl border border-white/40 bg-white/60 py-3 pl-12 pr-4 text-sm text-slate-700 shadow-sm backdrop-blur-xl transition-all placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
          <Search className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-slate-400" />
        </div>
      </header>

      {/* Filter tabs */}
      <div className="mb-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tabs.map((tab, idx) => (
          <button key={tab}
            className={`w-full rounded-full py-2.5 text-center text-sm font-medium transition-all ${
              idx === 0 ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border border-white/40 bg-white/70 text-slate-700 backdrop-blur-md hover:bg-white"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Recently opened */}
      <section className="mb-10">
        <h2 className="mb-4 px-1 text-lg font-bold text-slate-800">Недавно открытые</h2>
        <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockRecent.map((mat, i) => {
            const Icon = iconMap[mat.type] ?? File;
            return (
              <div key={`${mat.id}-${i}`} className="flex w-full cursor-pointer items-center space-x-3 rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xs ${mat.colorHex}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{mat.title}</p>
                  <p className="text-[10px] text-slate-400">Вчера</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockMaterials.map((mat) => {
          const Icon = iconMap[mat.type] ?? File;
          return (
            <div key={mat.id} className="group relative flex h-[180px] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:shadow-lg">
              <div className="z-10 mb-2 flex w-full flex-1 flex-col items-center justify-center">
                <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${mat.colorHex}`}>
                  <Icon className="h-10 w-10" />
                </div>
                <p className="line-clamp-2 w-full px-2 text-center text-sm font-bold leading-tight text-slate-800">{mat.title}</p>
              </div>
              <div className="z-10 mt-auto flex w-full items-end justify-between">
                <div className="mr-2 truncate text-[10px] text-slate-400">{mat.subject} · {mat.type}</div>
                <div className="whitespace-nowrap text-[10px] text-slate-400">{mat.date}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center pb-8">
        <button className="rounded-2xl border border-white/60 bg-white/40 px-10 py-3 text-sm font-bold text-blue-600 shadow-sm backdrop-blur-md transition-all hover:bg-white/60">
          Показать ещё
        </button>
      </div>
    </div>
  );
}
