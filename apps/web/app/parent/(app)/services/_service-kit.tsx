/**
 * Общее для ветки «Сервисы» веб-родителя: набор глифов, плитка сервиса и
 * единый экран-заглушка «Функция появится скоро».
 *
 * Почему отдельный файл, а не `_ui/screen-kit.tsx`: screen-kit — общий для
 * всех экранов родителя, а здесь лежат вещи, нужные ТОЛЬКО «Сервисам»
 * (шесть путей иконок + композиция заглушки). Стекло, типографика и цвета
 * по-прежнему берутся из `../v2/*` и `../_ui/screen-kit` — вторых копий не
 * заводим.
 *
 * Файл начинается с подчёркивания только по соглашению соседних папок; для
 * App Router роут создаёт лишь `page.tsx`, поэтому маршрута отсюда нет.
 *
 * Только светлая тема.
 */

import Link from "next/link";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, Glyph, InnerHeader, ScreenScroll } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON, WHITE } from "../_ui/screen-tokens";
// grad135 — строго из tokens, а не из screen-kit: этот файл серверный, а
// screen-kit помечен "use client", и вызов его функции роняет пререндер.
import { glass1, glassBorder, glassInset, grad135, ink1, ink3 } from "../v2/tokens";

/* ── Глифы, которых нет в общем ICON ──────────────────────────────────────
 * Пути 1:1 из ServicesScreen.tsx мобилки (ветка feat/mobile-parent-redesign):
 * вилка-нож, автобус, звезда, сердце, файл-галочка. `doc` и `chat` берём из
 * общего ICON — они там уже есть.
 */
export const SERVICE_ICON = {
  meals: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
  transport: [
    "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
    "M4 11h16",
    "M8 18v2",
    "M16 18v2",
    "M8 15h.01",
    "M16 15h.01",
  ],
  portfolio: ["M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z"],
  medical: [
    "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z",
  ],
  applications: [
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
    "M14 3v5h5",
    "m9 15 2 2 4-4",
  ],
  reviews: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z", "M8 9h8", "M8 13h5"],
} as const;

/* ── Плитка сервиса ──────────────────────────────────────────────────────
 * Геометрия — веб-вариант ServiceTile мобилки, приведённый к тому же
 * QuickActionTile, что уже стоит на главной (r18, стекло glass-1 blur 20,
 * тень 0 10 24 rgba(99,86,214,.13) + inset-блик, плашка 38 r13 с цветной
 * тенью 0 7 16). На вебе сетка 3-колоночная (не 4, как в 390-кадре RN),
 * поэтому подпись 10.5/700 — как у быстрых действий, а не 8.5.
 */
export function ServiceTile({
  label,
  href,
  gradient,
  shadowRgb,
  paths,
}: {
  label: string;
  href: string;
  gradient: readonly [string, string];
  shadowRgb: string;
  paths: readonly string[];
}) {
  return (
    <Link
      href={href}
      className="flex h-full w-full flex-col items-center justify-center transition-transform active:scale-[0.97]"
      style={{
        borderRadius: 18,
        border: `1px solid ${glassBorder}`,
        background: glass1.background,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: `0 10px 24px rgba(99,86,214,0.13), ${glassInset}`,
        gap: 6,
        padding: "13px 4px",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          background: grad135(gradient),
          boxShadow: `0 7px 16px rgba(${shadowRgb},0.3)`,
        }}
      >
        <Glyph paths={paths} size={17} color={WHITE} strokeWidth={1.9} />
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: ink1, textAlign: "center" }}>{label}</span>
    </Link>
  );
}

/* ── Экран-заглушка ──────────────────────────────────────────────────────
 * Один компонент на все пять «будущих» сервисов: у них отличаются только
 * заголовок, иконка и одна фраза о том, что здесь появится. Бэкендов у этих
 * разделов нет вообще (ни таблиц, ни бакетов) — рисовать «примерное меню» или
 * «примерный маршрут» нельзя: родитель принял бы выдумку за факт.
 */
export function ServiceSoonScreen({
  title,
  backHref,
  description,
  paths,
}: {
  title: string;
  backHref: string;
  description: string;
  paths: readonly string[];
}) {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={title} backHref={backHref} />

      <ScreenScroll>
        <GlassCard radius={22}>
          <EmptyState title="Функция появится скоро" text={description} paths={paths} />
        </GlassCard>

        <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
          Нужна информация уже сейчас?{" "}
          <Link href="/parent/messages" style={{ color: ink1, fontWeight: 800 }}>
            Напишите в чат школы
          </Link>
          .
        </span>
      </ScreenScroll>
    </div>
  );
}

/** Реэкспорт общего ICON, чтобы подэкраны тянули иконки из одного места. */
export { ICON };
