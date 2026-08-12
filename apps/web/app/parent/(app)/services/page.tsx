import { InnerHeader, ScreenScroll, SectionCap } from "../_ui/screen-kit";
import { ICON, SERVICE_ICON, ServiceTile } from "./_service-kit";
import { StudyTiles } from "./StudyTiles";
import { ink3 } from "../v2/tokens";

/**
 * «Все сервисы» — веб-порт
 * apps/mobile-parent/src/screens/study/ServicesScreen.tsx (ветка
 * feat/mobile-parent-redesign).
 *
 * Отличие от мобилки — состав плиток. В RN-экране их 19: он дублировал ВСЕ
 * разделы приложения (Оценки, ДЗ, Расписание, Оплаты, Сообщения, Настройки…),
 * потому что в мобильном стеке это был единственный способ добраться до части
 * экранов. В вебе те разделы уже лежат на своих табах и в «Профиле», и второй
 * их список только размножил бы точки входа. Поэтому здесь остаются шесть
 * плиток — ровно те сервисы, которых нет ни на одном табе.
 *
 * Пять из шести ведут на заглушки (бэкендов у них пока нет — см.
 * `_service-kit.tsx`), «Документы» — на реальный существующий экран.
 * Промо-карточка «Что нового в SNR EduOS» из макета не переносится: экрана
 * релиз-нот в вебе нет, кнопка вела бы в никуда.
 *
 * Только светлая тема.
 */

const TILES: {
  label: string;
  href: string;
  gradient: readonly [string, string];
  shadowRgb: string;
  paths: readonly string[];
}[] = [
  {
    label: "Питание",
    href: "/parent/services/meals",
    gradient: ["#f472b6", "#db2777"],
    shadowRgb: "219,39,119",
    paths: SERVICE_ICON.meals,
  },
  {
    label: "Транспорт",
    href: "/parent/services/transport",
    gradient: ["#fbbf24", "#f97316"],
    shadowRgb: "249,115,22",
    paths: SERVICE_ICON.transport,
  },
  {
    label: "Портфолио",
    href: "/parent/services/portfolio",
    gradient: ["#2dd4bf", "#0d9488"],
    shadowRgb: "13,148,136",
    paths: SERVICE_ICON.portfolio,
  },
  {
    label: "Медкарта",
    href: "/parent/services/medical",
    gradient: ["#fb7185", "#e11d48"],
    shadowRgb: "225,29,72",
    paths: SERVICE_ICON.medical,
  },
  {
    label: "Заявления",
    href: "/parent/services/applications",
    gradient: ["#34d399", "#059669"],
    shadowRgb: "5,150,105",
    paths: SERVICE_ICON.applications,
  },
  {
    label: "Документы",
    href: "/parent/documents",
    gradient: ["#60a5fa", "#2563eb"],
    shadowRgb: "37,99,235",
    paths: ICON.doc,
  },
];

export default function ParentServicesPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Все сервисы" backHref="/parent/home" />

      <ScreenScroll>
        <SectionCap label="Сервисы школы" />

        <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
          {TILES.map((t) => (
            <ServiceTile
              key={t.label}
              label={t.label}
              href={t.href}
              gradient={t.gradient}
              shadowRgb={t.shadowRgb}
              paths={t.paths}
            />
          ))}
        </div>

        <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
          Питание, транспорт, портфолио, медкарта и заявления пока в разработке — на их экранах
          написано, что там появится. «Документы» работают уже сейчас.
        </span>

        {/* 12.08.2026 — четыре раздела учёбы на настоящих данных. */}
        <StudyTiles />
      </ScreenScroll>
    </div>
  );
}
