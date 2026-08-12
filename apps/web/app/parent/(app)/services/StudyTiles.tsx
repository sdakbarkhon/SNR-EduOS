"use client";

/**
 * Вторая секция «Все сервисы» — четыре входа в разделы учёбы, которых до
 * 12.08.2026 в вебе не было вовсе: Библиотека, Тесты, Учителя, Новости школы.
 *
 * Отдельным клиентским компонентом, а не строками в TILES на странице, по
 * одной причине: подписи этих четырёх — из словаря (три языка), а страница
 * сервисов серверная и подписывает старые плитки по-русски литералами.
 * Смешивать в одном массиве переведённое и непереведённое хуже, чем разнести
 * по секциям: видно, что переведено, а что ещё нет.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SectionCap } from "../_ui/screen-kit";
import { ICON, SERVICE_ICON, ServiceTile } from "./_service-kit";

export function StudyTiles() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;

  const tiles = [
    {
      label: d.scr.library,
      href: "/parent/library",
      gradient: ["#a78bfa", "#7c3aed"] as const,
      shadowRgb: "124,58,237",
      paths: ICON.doc,
    },
    {
      label: d.scr.tests,
      href: "/parent/tests",
      gradient: ["#38bdf8", "#0284c7"] as const,
      shadowRgb: "2,132,199",
      paths: ICON.checkSquare,
    },
    {
      label: d.scr.teachers,
      href: "/parent/teachers",
      gradient: ["#f0556b", "#b91c4a"] as const,
      shadowRgb: "185,28,74",
      paths: ICON.user,
    },
    {
      label: d.scr.adminNews,
      href: "/parent/news",
      gradient: ["#facc15", "#ca8a04"] as const,
      shadowRgb: "202,138,4",
      paths: SERVICE_ICON.reviews,
    },
  ];

  return (
    <>
      <SectionCap label={d.more.studySection} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
        {tiles.map((t) => (
          <ServiceTile
            key={t.href}
            label={t.label}
            href={t.href}
            gradient={t.gradient}
            shadowRgb={t.shadowRgb}
            paths={t.paths}
          />
        ))}
      </div>
    </>
  );
}
