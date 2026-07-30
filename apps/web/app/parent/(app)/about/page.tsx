import Link from "next/link";
import { GlassCard } from "../v2/GlassCard";
import { CardRow, ChevronRight, Glyph, IconTile, InnerHeader, RowText, ScreenScroll, SectionCap } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { DIVIDER, ICON, WHITE } from "../_ui/screen-tokens";
import { accentGrad, fontDisplay, ink1, ink2, ink3 } from "../v2/tokens";

/**
 * Экран da7 «О приложении» — короткая версия: кто мы, версия сборки, контакты
 * школы и переходы в поддержку.
 *
 * Контакты школы (телефон / почта / адрес) были захардкожены прямо в макете
 * «SNR EduOS v2 Light.dc.html» (строки 1196–1200) — таблицы школы в БД нет,
 * поэтому они остаются константами и живут здесь, в одном месте, а не
 * размазаны по экранам.
 */

const APP_VERSION = "1.0.0";

const SCHOOL_CONTACTS: { label: string; value: string }[] = [
  { label: "Телефон", value: "+998 71 200-40-40" },
  { label: "Email", value: "info@snr-school.uz" },
  { label: "Адрес", value: "г. Ташкент, ул. Мустакиллик, 45" },
];

export default function ParentAboutPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="О приложении" backHref="/parent/profile" />

      <ScreenScroll>
        {/* Шапка-визитка. */}
        <GlassCard radius={22} className="flex flex-col items-center" style={{ padding: 18, gap: 8 }}>
          <span
            className="flex items-center justify-center rounded-[18px]"
            style={{ width: 58, height: 58, background: accentGrad, boxShadow: "0 12px 28px rgba(124,58,237,0.35)" }}
          >
            <Glyph paths={ICON.user} size={26} color={WHITE} strokeWidth={1.9} />
          </span>
          <span style={{ fontFamily: fontDisplay, fontSize: 15, fontWeight: 600, color: ink1 }}>
            SNR EduOS
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "16px", color: ink2, textAlign: "center" }}>
            Кабинет родителя SNR International School: успеваемость, расписание, посещаемость, домашние
            задания, оплаты и связь с учителями.
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>{`Версия ${APP_VERSION}`}</span>
        </GlassCard>

        {/* Контакты школы. */}
        <SectionCap label="Контакты школы" />
        <GlassCard radius={20} className="px-[14px] py-1">
          {SCHOOL_CONTACTS.map((c, i) => (
            <div
              key={c.label}
              className="flex items-center justify-between gap-3"
              style={{ paddingBlock: 10, borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>{c.label}</span>
              <span className="shrink text-right" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                {c.value}
              </span>
            </div>
          ))}
        </GlassCard>

        {/* Переходы. */}
        <SectionCap label="Поддержка" />
        <GlassCard radius={20} className="px-[14px] py-1">
          <CardRow href="/parent/chat/support" divider={false}>
            <IconTile gradient={["#f472b6", "#db2777"]} paths={ICON.help} size={36} glyphSize={18} />
            <RowText title="Написать в поддержку" subtitle="Чат со школой" />
            <ChevronRight />
          </CardRow>
          <CardRow href="/parent/announcements" divider>
            <IconTile gradient={["#a78bfa", "#7c3aed"]} paths={ICON.mega} size={36} glyphSize={18} />
            <RowText title="Объявления школы" subtitle="Новости и события" />
            <ChevronRight />
          </CardRow>
        </GlassCard>

        <Link
          href="/parent/profile"
          style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}
        >
          © SNR International School
        </Link>
      </ScreenScroll>
    </div>
  );
}
