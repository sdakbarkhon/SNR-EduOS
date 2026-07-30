import { getSelectedChild } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, Glyph, ICON, InnerHeader, ScreenScroll, SectionCap } from "../_ui/screen-kit";
import { ink1, ink2, ink3, status } from "../v2/tokens";

/**
 * Экран #31 «Документы» — веб-порт
 * apps/mobile-parent/src/screens/profile/DocumentsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1247–1274).
 *
 * ЧЕСТНОЕ СОСТОЯНИЕ: хранилища документов в проекте нет — ни таблицы, ни
 * бакета Storage (проверено: `course_materials` — это учебные материалы
 * группы, а не личные документы семьи). В мобилке список рисовался фикстурой
 * с выдуманными датами «Добавлен 12.01.2026»; переносить её на реальный экран
 * нельзя — родитель принял бы выдумку за факт и искал бы несуществующие файлы.
 *
 * Поэтому от макета взяты рамка и security-баннер, а списки показывают пустое
 * состояние. Кнопка «Добавить документ» не рисуется: загружать некуда.
 */
export default async function ParentDocumentsPage() {
  const child = await getSelectedChild();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Документы" backHref="/parent/profile" />

      <ScreenScroll>
        {/* Security-баннер (макет 1254–1257). */}
        <div
          className="flex items-start"
          style={{
            gap: 10,
            padding: "12px 14px",
            borderRadius: 18,
            background: `rgba(${status.green.rgb},0.10)`,
            border: `1px solid rgba(${status.green.rgb},0.30)`,
          }}
        >
          <span style={{ paddingTop: 1 }}>
            <Glyph paths={ICON.shield} size={17} color={status.green.text} strokeWidth={1.9} />
          </span>
          <span className="flex-1" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>Мы защищаем ваши данные</span>
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: "15px", color: ink2 }}>
              Документы хранятся в зашифрованном виде и доступны только вам и администрации школы.
            </span>
          </span>
        </div>

        <SectionCap label="Документы ребёнка" />
        <GlassCard radius={20}>
          <EmptyState
            title="Документов пока нет"
            text={
              child
                ? `Свидетельство о рождении, медицинскую справку и другие файлы ученика ${child.full_name} загружает администрация школы — они появятся здесь автоматически.`
                : "Свидетельство о рождении, медицинскую справку и другие файлы загружает администрация школы."
            }
            paths={ICON.doc}
          />
        </GlassCard>

        <SectionCap label="Документы родителя" />
        <GlassCard radius={20}>
          <EmptyState
            title="Документов пока нет"
            text="Паспорт и доверенности добавляет школа при оформлении договора."
            paths={ICON.doc}
          />
        </GlassCard>

        <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
          Нужен документ? Напишите в чат поддержки — школа пришлёт копию.
        </span>
      </ScreenScroll>
    </div>
  );
}
