import { InnerHeader, ScreenScroll } from "../_ui/screen-kit";
import { NotifSettingsView } from "./NotifSettingsView";

/**
 * «Настройки уведомлений». Данных с сервера экрану не нужно: таблицы
 * родительских предпочтений в БД нет (см. комментарий в NotifSettingsView),
 * состояние переключателей — сессионное.
 */
export default function ParentNotifSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Настройки уведомлений" backHref="/parent/profile" />
      <ScreenScroll>
        <NotifSettingsView />
      </ScreenScroll>
    </div>
  );
}
