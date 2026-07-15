/** P1-5 аудит: было — голый useState в каждом экране (без Context), из-за
 *  чего смена языка не распространялась по уже смонтированным экранам и не
 *  переживала перезапуск. Реализация теперь в LocaleContext.tsx (Provider +
 *  useContext); публичный интерфейс useAppLocale() не изменился, поэтому
 *  ни один из ~30 экранов, вызывающих `useAppLocale()` из "../i18n", править
 *  не пришлось. */
export { LocaleProvider, useAppLocale } from "./LocaleContext";
