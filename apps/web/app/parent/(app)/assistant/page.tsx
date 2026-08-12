import { childInsight, getSelectedChild } from "@/lib/parent-queries";
import { AssistantView } from "./AssistantView";

/**
 * «EduOS Assistant» — веб-порт
 * apps/mobile-parent/src/screens/study/EduosAssistantScreen.tsx.
 *
 * ОТКУДА БЕРЁТСЯ СОДЕРЖИМОЕ. Разбор пишет модель, хранит таблица
 * `parent_insights` (миграция 128). Экран НЕ генерирует ничего при открытии:
 * при заходе показывает последний сохранённый разбор, а новый собирается
 * только по нажатию кнопки. Причина простая — генерация стоит обращения к
 * модели, и открывать экран «на посмотреть» было бы дорого. Свежий разбор
 * (моложе недели) отдаётся из базы вообще без обращения к модели.
 *
 * ЯЗЫК ЗДЕСЬ ВЛИЯЕТ НЕ НА ПОДПИСЬ, А НА ДАННЫЕ: разбор пишется на языке
 * родителя и хранится с ним же (колонка `locale`). Сервер читает разбор на
 * русском — языке по умолчанию; если у родителя выбран другой, экран
 * перечитает свой сам (см. AssistantView).
 */
export default async function ParentAssistantPage() {
  const [child, initial] = await Promise.all([getSelectedChild(), childInsight("ru")]);
  return <AssistantView initial={initial} childName={child?.full_name ?? null} />;
}
