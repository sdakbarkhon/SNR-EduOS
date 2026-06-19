export function FilterTabs() {
  const tabs = ['Все', 'Презентации', 'Видео', 'PDF', 'Книги', 'Ссылки'];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 w-full">
      {tabs.map((tab, idx) => (
        <button
          key={tab}
          className={`w-full py-2.5 rounded-full text-sm font-medium transition-all text-center cursor-pointer ${
            idx === 0
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'bg-white/70 backdrop-blur-md border border-white/40 text-slate-700 hover:bg-white'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
