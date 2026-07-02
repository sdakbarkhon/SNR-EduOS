import { permanentRedirect } from "next/navigation";

// Страница расписания переехала на /lessons (Iter5 P5). Старые ссылки
// (в т.ч. редирект из модалки завершения урока) ведут сюда — пробрасываем.
export default function SchedulePage() {
  permanentRedirect("/lessons");
}
