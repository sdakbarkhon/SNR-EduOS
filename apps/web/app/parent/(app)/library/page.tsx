import { libraryBooks } from "@/lib/parent-queries";
import { LibraryView } from "./LibraryView";

/**
 * «Библиотека» — веб-порт apps/mobile-parent/src/screens/study/LibraryScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: таблица `books` (в демо-школе 11 книг) плюс отметки
 * `book_favorites` выбранного ребёнка — те же, что видит сам ученик.
 *
 * Файл книги здесь НЕ открывается. Ссылка требует подписанного URL из
 * приватного бакета `books`, а после миграций 188/189 путь обязан начинаться
 * со школы: у части старых книг он ещё прежний, и родитель получил бы отказ
 * вместо файла. Показываем карточку без кнопки скачивания — это честнее, чем
 * кнопка, которая через раз не работает. Сама пометка «файла нет» приходит из
 * данных: у книги может не быть ни файла, ни внешней ссылки.
 */
export default async function ParentLibraryPage() {
  const books = await libraryBooks();
  return <LibraryView books={books} />;
}
