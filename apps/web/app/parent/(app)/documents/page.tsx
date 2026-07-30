import { getParentContext } from "@/lib/parent-context";
import { getSelectedChild } from "@/lib/parent-queries";
import { InnerHeader } from "../_ui/screen-kit";
import { DocumentsView } from "./DocumentsView";

/**
 * Экран #31 «Документы» — веб-порт
 * apps/mobile-parent/src/screens/profile/DocumentsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1247–1274).
 *
 * СОСТОЯНИЕ ДАННЫХ: хранилища личных документов в проекте нет — ни таблицы,
 * ни бакета Storage (`course_materials` — это учебные материалы группы, а не
 * документы семьи). Поэтому карточки документов здесь МОК, как в мобилке, а
 * файлов за ними нет: кнопка «Скачать» честно объясняет это при нажатии, а не
 * молча ничего не делает. ФИО ребёнка, его класс и ФИО родителя — настоящие,
 * с сервера, чтобы владелец документа не расходился с тем, что родитель видит
 * на /parent/profile.
 */
export default async function ParentDocumentsPage() {
  const child = await getSelectedChild();
  // getParentContext() уже вызван внутри getSelectedChild() и мемоизирован
  // react cache(), так что это не новый round-trip; обе функции возвращают
  // null вместо throw (lib/parent-context.ts).
  const ctx = await getParentContext();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Документы" backHref="/parent/profile" />
      <DocumentsView
        childName={child?.full_name ?? null}
        childClassName={child?.className ?? null}
        parentName={ctx?.parentName ?? null}
      />
    </div>
  );
}
