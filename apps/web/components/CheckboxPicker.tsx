"use client";

// Набор галочек с «выбрать все» и «снять выбор».
//
// ═══ ОТКУДА ОН ВЗЯЛСЯ И ПОЧЕМУ ПЕРЕЕХАЛ СЮДА ═════════════════════════════
//
// Своего компонента множественного выбора в проекте не было — был устойчивый
// образец (Set в состоянии, две кнопки, число в заголовке) прямо в разметке
// учебного плана. 03.09.2026 он понадобился дважды в окне массового
// назначения, и был написан там же, локально.
//
// 03.09.2026, пункт 228 — понадобился в ТРЕТИЙ раз, в едином окне создания.
// Третья копия была бы уже не небрежностью, а системой: в этом проекте копии
// правил расходились семь раз на одном только среднем балле. Поэтому он
// переехал в общий файл, а окно назначений теперь его импортирует.
//
// ПОВЕДЕНИЕ НЕ ИЗМЕНИЛОСЬ НИ НА ЙОТУ. Тело перенесено дословно: те же
// свойства, та же разметка, те же классы. Переезд — это переезд, а не повод
// заодно что-то улучшить: экран назначений работает, и трогать его поведение
// заказчик запретил.
//
// Учебный план на этот компонент НЕ переводим: он не в этом заходе, и переезд
// рабочего экрана — отдельная работа со своей проверкой.

export function ВыборГалочками({
  title, items, picked, onToggle, onAll, onNone, allLabel, noneLabel,
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  picked: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
  allLabel: string;
  noneLabel: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700">{title}</span>
        <div className="flex gap-1.5">
          <button
            type="button" onClick={onAll}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            {allLabel}
          </button>
          <button
            type="button" onClick={onNone} disabled={picked.size === 0}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            {noneLabel}
          </button>
        </div>
      </div>
      <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
        {items.map((it) => (
          <label
            key={it.id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${picked.has(it.id) ? "bg-violet-100 text-violet-900" : "text-zinc-700 hover:bg-white"}`}
          >
            <input
              type="checkbox"
              checked={picked.has(it.id)}
              onChange={() => onToggle(it.id)}
              className="h-4 w-4 shrink-0 rounded border-zinc-300 text-violet-600 focus:ring-violet-400"
            />
            <span className="min-w-0 truncate">{it.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
