import { MessagesView } from "./MessagesView";

/**
 * «Сообщения» — состав 1:1 с apps/mobile-parent MessagesScreen.tsx, но
 * ПОЛНОСТЬЮ мок (как в самой мобилке — getMessageThreads/getMessagesStories
 * читают фикстуру, ни одного core-запроса). Личных чатов родитель-учитель
 * по факту 0 в БД (только один групповой тред «Родители») — подключать
 * реальные chat_threads/chat_messages здесь не стали, см. отчёт захода.
 * Никакого клиент-специфичного серверного стейта не требуется — экран не
 * зависит от активного ребёнка (как и в мобилке).
 */
export default function ParentMessagesPage() {
  return <MessagesView />;
}
