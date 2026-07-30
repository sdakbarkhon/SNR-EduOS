import { InnerHeader, ScreenScroll } from "../_ui/screen-kit";
import { LangSecurityView } from "./LangSecurityView";

/** «Язык и безопасность». Данных с сервера не требует — см. LangSecurityView. */
export default function ParentLangSecurityPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Язык и безопасность" backHref="/parent/profile" />
      <ScreenScroll>
        <LangSecurityView />
      </ScreenScroll>
    </div>
  );
}
