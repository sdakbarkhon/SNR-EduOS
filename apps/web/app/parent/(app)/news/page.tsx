import { parentAdminNews } from "@/lib/parent-queries";
import { NewsView } from "./NewsView";

/**
 * «От администрации» — веб-порт
 * apps/mobile-parent/src/screens/school/AdminNewsScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: те же объявления, что на экране «Объявления школы», но
 * отфильтрованные по автору-администратору (`isFromAdmin`). Отдельного
 * запроса не заводим — фильтр над уже существующим `parentAnnouncements`.
 *
 * Экран «Объявления» при этом остаётся полным (учителя + администрация): здесь
 * не подмножество ради подмножества, а тот же разрез, что в мобильном
 * приложении — родителю нужно уметь посмотреть только официальное.
 */
export default async function ParentNewsPage() {
  const news = await parentAdminNews();
  return <NewsView news={news} />;
}
