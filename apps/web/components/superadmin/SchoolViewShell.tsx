"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Eye, LogOut } from "lucide-react";
import { SchoolMark } from "@/components/SchoolMark";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Оболочка экранов «суперадмин смотрит школу».
 *
 * ЯНТАРНАЯ ПОЛОСА СВЕРХУ — не украшение. Каркас админки синий, каркас
 * суперадмина серый, и человек, попавший сюда, обязан понимать боковым
 * зрением, что он не у себя и не в роли администратора школы, а в гостях и
 * только смотрит. Поэтому третий цвет, название школы прямо в полосе и выход
 * рядом.
 *
 * ВЫХОД — ЭТО ПРОСТО УХОД С АДРЕСА. Ни куки, ни срока, ни состояния на
 * сервере: «где я сейчас» написано в самом адресе. Отсюда два следствия,
 * которые нам нужны: закрытая вкладка не оставляет ничего, а две вкладки с
 * разными школами не путаются между собой.
 *
 * ═══ 03.09.2026 — ТА ЖЕ ОБОЛОЧКА СЛУЖИТ МЕНЕДЖЕРУ ══════════════════════
 *
 * Появились три необязательных свойства: корень вкладок, адрес выхода и
 * логотип школы. У всех трёх умолчания — прежние суперадминские, поэтому
 * его макет не тронут ВООБЩЕ: он их не передаёт, и всё работает как вчера.
 *
 * Логотип просил заказчик отдельно: «чтобы всё фильтровалось и чётко было
 * различно, чтобы не путать с другими школами». Менеджер ходит по чужим
 * школам подряд, и название словами он читает, а знак школы узнаёт боковым
 * зрением — как в шапке админки, откуда знак и взят.
 */

const ВКЛАДКИ = [
  { seg: "", key: "svTabOverview" },
  { seg: "groups", key: "svTabGroups" },
  { seg: "students", key: "svTabStudents" },
  { seg: "teachers", key: "svTabTeachers" },
  { seg: "parents", key: "svTabParents" },
  { seg: "subjects", key: "svTabSubjects" },
  { seg: "departments", key: "svTabDepartments" },
  { seg: "assignments", key: "svTabAssignments" },
  { seg: "marks", key: "svTabMarks" },
  { seg: "announcements", key: "svTabAnnouncements" },
  { seg: "analytics", key: "svTabAnalytics" },
] as const;

/** Вкладка правки карточки. Показывается ТОЛЬКО менеджеру: у суперадмина
 *  карточка правится своим окном, вместе с именем, кодом и автостартом. */
const ВКЛАДКА_КАРТОЧКИ = { seg: "card", key: "mgrCardTab" } as const;

/** Вкладка оплат. Показывается ТОЛЬКО менеджеру: суперадмину деньги закрыты
 *  миграцией 222, и заводить ему дорогу к ним этот заход не собирается. */
const ВКЛАДКА_ОПЛАТ = { seg: "payments", key: "mgrMoneyTab" } as const;

export function SchoolViewShell({
  schoolId,
  schoolName,
  isDemo,
  children,
  /** Корень вкладок. Умолчание — прежний суперадминский. */
  basePath,
  /** Куда уводит «Выйти». Умолчание — прежний список школ суперадмина. */
  exitHref = "/superadmin/schools",
  /** Подписанная ссылка на логотип. Нет — знак нарисует буквы названия. */
  logoUrl,
  /** Показывать ли вкладки правки карточки и оплат. Только у менеджера. */
  cardTab = false,
  /**
   * Кнопка рядом с выходом. Срез 3c: у менеджера нет дашборда админа, где
   * живёт «Создать всё сразу», — а школа у него выбирается адресом. Поэтому
   * окно переехало в шапку школы: оно доступно с любой её вкладки и всегда
   * знает, о какой школе речь.
   *
   * Суперадмин ничего не передаёт, и его полоса выглядит как вчера.
   */
  extra,
}: {
  schoolId: string;
  schoolName: string;
  isDemo: boolean;
  children: ReactNode;
  basePath?: string;
  exitHref?: string;
  logoUrl?: string | null;
  cardTab?: boolean;
  extra?: ReactNode;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin;
  const pathname = usePathname();

  const база = basePath ?? `/superadmin/schools/${schoolId}/view`;
  const хвост = pathname.startsWith(база) ? pathname.slice(база.length).replace(/^\//, "") : "";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Полоса гостя. Стоит выше всего и не уезжает при прокрутке содержимого. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <Eye className="h-5 w-5 shrink-0 text-amber-700" />
        {/* Знак школы. Показывается, только если ссылка передана: у
            суперадминского макета её нет, и его полоса выглядит как вчера. */}
        {logoUrl !== undefined && (
          <SchoolMark name={schoolName} logoUrl={logoUrl} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-amber-900">
            {schoolName}
            {isDemo && <span className="ml-2 text-[11px] font-medium text-amber-700">{t.svDemoMark}</span>}
          </p>
          <p className="text-[12px] text-amber-800">{t.svReadOnly}</p>
        </div>
        {extra}
        <Link
          href={exitHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[13px] font-medium text-amber-900 hover:bg-amber-100"
        >
          <LogOut className="h-4 w-4" />
          {t.svExit}
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1.5">
        {[...ВКЛАДКИ, ...(cardTab ? [ВКЛАДКА_ОПЛАТ, ВКЛАДКА_КАРТОЧКИ] : [])].map((v) => {
          const href = v.seg ? `${база}/${v.seg}` : база;
          const active = хвост === v.seg;
          return (
            <Link
              key={v.seg || "overview"}
              href={href}
              className={
                "rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors " +
                (active
                  ? "bg-slate-800 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50")
              }
            >
              {t[v.key]}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">{children}</div>
    </div>
  );
}
