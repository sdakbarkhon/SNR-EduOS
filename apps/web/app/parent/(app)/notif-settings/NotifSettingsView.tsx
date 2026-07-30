"use client";

/**
 * Экран d32 «Настройки уведомлений» — веб-порт
 * apps/mobile-parent/src/screens/profile/NotifSettingsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1275–1294).
 *
 * Состояние переключателей — только на время сессии, ровно как в мобилке:
 * таблицы предпочтений уведомлений для родителя в БД нет (`notification_
 * settings` в core — учительская, со своим набором полей и своей RLS), а
 * заводить её задачей этого захода не поручено. Поэтому экран честно пишет
 * под списком, что настройки пока не сохраняются между входами.
 *
 * Мастер-тумблер при OFF гасит и отключает все категории (требование
 * заказчика из Захода 7 мобилки).
 */

import { useState } from "react";
import { GlassCard } from "../v2/GlassCard";
import { CardRow, ICON, IconTile, RowText, SectionCap, Toggle } from "../_ui/screen-kit";
import { ink1, ink2, ink3 } from "../v2/tokens";

type Category = {
  id: string;
  name: string;
  subtitle: string;
  gradient: [string, string];
  paths: readonly string[];
  defaultOn: boolean;
};

/**
 * Категории соответствуют реальным `notifications.kind`, которые родитель
 * действительно получает, — а не девяти выдуманным разделам фикстуры.
 */
const CATEGORIES: Category[] = [
  {
    id: "grades",
    name: "Оценки",
    subtitle: "Новые оценки и проверенные работы",
    gradient: ["#34d399", "#059669"],
    paths: ICON.check,
    defaultOn: true,
  },
  {
    id: "homework",
    name: "Домашние задания",
    subtitle: "Новые задания и сроки сдачи",
    gradient: ["#60a5fa", "#2563eb"],
    paths: ICON.checkSquare,
    defaultOn: true,
  },
  {
    id: "attendance",
    name: "Посещаемость",
    subtitle: "Отметки о приходе и уходе",
    gradient: ["#fbbf24", "#f97316"],
    paths: ICON.clock,
    defaultOn: true,
  },
  {
    id: "lessons",
    name: "Уроки",
    subtitle: "Материалы урока и скорое начало",
    gradient: ["#22d3ee", "#0891b2"],
    paths: ICON.doc,
    defaultOn: true,
  },
  {
    id: "announcements",
    name: "Объявления",
    subtitle: "Новости школы и класса",
    gradient: ["#f472b6", "#db2777"],
    paths: ICON.mega,
    defaultOn: true,
  },
  {
    id: "messages",
    name: "Сообщения",
    subtitle: "Ответы учителей и поддержки",
    gradient: ["#a78bfa", "#7c3aed"],
    paths: ICON.chat,
    defaultOn: true,
  },
];

export function NotifSettingsView() {
  const [master, setMaster] = useState(true);
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of CATEGORIES) init[c.id] = c.defaultOn;
    return init;
  });

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {/* Мастер-тумблер. */}
      <GlassCard radius={20} className="flex items-center" style={{ padding: "13px 14px", gap: 11 }}>
        <IconTile gradient={["#7c3aed", "#4f6df5"]} paths={ICON.bell} size={38} round glyphSize={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
            Разрешить уведомления
          </span>
          <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
            Главный переключатель всех уведомлений
          </span>
        </span>
        <Toggle value={master} onChange={setMaster} ariaLabel="Разрешить уведомления" />
      </GlassCard>

      <SectionCap label="Уведомления" tone="ink3" />

      <GlassCard radius={20} className="px-[14px] py-1">
        {CATEGORIES.map((c, i) => (
          <CardRow key={c.id} divider={i > 0}>
            <span
              className="flex min-w-0 flex-1 items-center gap-[11px]"
              style={{ opacity: master ? 1 : 0.55 }}
            >
              <IconTile gradient={c.gradient} paths={c.paths} size={36} glyphSize={15} />
              <RowText title={c.name} subtitle={c.subtitle} />
            </span>
            <Toggle
              value={master ? values[c.id] ?? false : false}
              onChange={(next) => setValues((prev) => ({ ...prev, [c.id]: next }))}
              disabled={!master}
              ariaLabel={c.name}
            />
          </CardRow>
        ))}
      </GlassCard>

      <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
        Настройки действуют до конца сеанса: хранилища предпочтений уведомлений в системе пока нет.
      </span>
    </div>
  );
}
