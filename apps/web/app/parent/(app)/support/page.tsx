import { parentToday } from "@/lib/parent-queries";
import { SUPPORT_TICKETS, SUPPORT_TOPICS } from "../_demo/demo-data";
import { SupportView } from "./SupportView";

/**
 * «Поддержка» — веб-порт
 * apps/mobile-parent/src/screens/messages/SupportScreen.tsx.
 *
 * ДАННЫЕ ВЫДУМАННЫЕ, и экран говорит об этом сам: тред поддержки в
 * `chat_threads` не заведён, поэтому /parent/chat/support сегодня показывает
 * пустоту. Обращения лежат в общем файле выдуманных данных раздела
 * (`_demo/demo-data.ts`), а не здесь — там же написано, чем они заменятся.
 *
 * Форма нового обращения НИЧЕГО НЕ ОТПРАВЛЯЕТ и не делает вид, что отправила:
 * по нажатию она показывает пояснение (SOON_SUPPORT), а поля не очищает — то,
 * что родитель написал, остаётся на месте.
 */
export default async function ParentSupportPage() {
  const today = await parentToday();
  return <SupportView tickets={SUPPORT_TICKETS} topics={SUPPORT_TOPICS} today={today} />;
}
