// 07.08.2026 — оформление фильтров материалов, общее для ученика и учителя.
//
// Фильтры по дате/уроку/предмету (коммит 4746c93) выглядели «скучно»: сплошной
// белый фон и системные выпадающие списки, ничем не отличающиеся друг от друга
// и от фона страницы — по виду нельзя было понять, выбрано что-то или нет.
//
// Классы вынесены сюда, а не скопированы в оба экрана, ровно по той же
// причине, по которой в этом проекте уже собраны material-url.ts,
// material-filters.ts и markdown-plugins.ts: копии расходятся. Здесь копия
// была бы буквально двойной — экраны ученика и учителя показывают одни и те
// же фильтры.
//
// ЛОГИКА ФИЛЬТРАЦИИ НЕ ЗАТРОНУТА: это файл только про внешний вид, отбор
// по-прежнему живёт в lib/material-filters.ts.

/** База выпадающего списка. appearance-none — рисуем свою стрелку, иначе
 *  системная не даёт управлять отступами и цветом. */
export const FILTER_SELECT_BASE =
  "appearance-none cursor-pointer rounded-2xl border py-2.5 pl-9 pr-9 text-sm font-medium " +
  "shadow-sm backdrop-blur-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/40";

/** Ничего не выбрано — как поле поиска рядом. */
export const FILTER_SELECT_IDLE =
  "border-white/40 bg-white/60 text-slate-700 hover:bg-white/80";

/** Выбран конкретный вариант — синий, как активная вкладка типа. */
export const FILTER_SELECT_ON =
  "border-blue-400/50 bg-blue-50/90 text-blue-700 ring-1 ring-blue-500/15";

export const FILTER_ICON =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2";
export const FILTER_CHEVRON =
  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2";

/** Кнопка «сбросить» — появляется, только когда есть что сбрасывать. */
export const FILTER_RESET =
  "flex items-center gap-1.5 rounded-2xl border border-white/40 bg-white/60 px-3.5 py-2.5 " +
  "text-sm font-medium text-slate-500 shadow-sm backdrop-blur-xl transition-all " +
  "hover:bg-white/90 hover:text-slate-700";

export function filterSelectClass(active: boolean, extra = ""): string {
  return `${FILTER_SELECT_BASE} ${active ? FILTER_SELECT_ON : FILTER_SELECT_IDLE} ${extra}`.trim();
}

/** Подпись варианта со счётчиком. Раньше было «Понедельник, 28 июля (12)» —
 *  скобка сливалась с названием урока, в котором свои скобки. Точка-разделитель
 *  и неразрывный пробел читаются заметно лучше в узком списке. */
export function withCount(label: string, count: number): string {
  return `${label} · ${count}`;
}
