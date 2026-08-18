"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { SchoolMark } from "@/components/SchoolMark";

/**
 * Выбор школы перед входом — модальным окном поверх экрана.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА — вход не должен зависеть от нового шага.
 * Если список не загрузился, пришёл пустым или запрос упал, окно НЕ показывает
 * ошибку и не запирает человека: оно молча зовёт onSkip, и открывается обычная
 * форма логина. Вход — главный экран платформы, и добавленный поверх него шаг
 * не имеет права стать новой точкой отказа.
 *
 * ОДНА ШКОЛА — ОКНА НЕТ. Выбирать из одной плитки нечего, а окно поверх экрана
 * ради этого выглядит издевательством. Школа подставляется сама; учитель
 * увидит её логотип и название над формой и сможет передумать по «Сменить
 * школу» — вот тогда окно и откроется, потому что это уже осознанное действие.
 *
 * ПОИСК НА КЛИЕНТЕ. Список приходит целиком и один раз; фильтровать его
 * запросом к серверу на каждую букву незачем — школ в установке десятки, а не
 * десятки тысяч.
 *
 * ПОЧЕМУ ПЛИТКИ, А НЕ СТРОКИ. Строка во всю ширину тратит место на пустоту
 * справа: у школы всего два поля — логотип и название. Логотип при этом
 * становится главным: его узнают быстрее, чем читают название.
 *
 * СКОЛЬКО ПЛИТОК В РЯД, И ПОЧЕМУ ИХ СТАЛО МЕНЬШЕ. Было шесть колонок: плитка
 * 147×147, логотип 56, подпись в 12 пунктов. Влезало восемнадцать школ сразу,
 * но в белом поле такой логотип теряется, а название приходится вычитывать —
 * то есть экран показывал много и не помогал ничем. Три-четыре крупных лучше
 * шести мелких, поэтому колонок теперь 2 на телефоне, 3 с 640px и 4 с 1024px.
 *
 * Что получилось на деле (замерено в браузере, не прикинуто):
 *   ноутбук 1280×720  — окно 998×562,  плитка 228×180, 4 в ряд, видно 8;
 *   монитор 1920×1080 — окно 1152×842, плитка 266×180, 4 в ряд, видно 12;
 *   телефон 375×812   — окно 345×633,  плитка 145×180, 2 в ряд, видно 4.
 * Двадцать школ на ноутбуке — пять рядов, из них два с половиной видны сразу,
 * остальное прокруткой. Это сознательный размен: показать меньше, но так,
 * чтобы школу узнавали с одного взгляда, а не вычитывали.
 *
 * ФОРМА ПЛИТКИ НЕ ЗАДАНА ЖЁСТКО, и это осознанно. Высота складывается из
 * содержимого: отступ 16, логотип 96, зазор 10, ровно две строки под название,
 * отступ 16 — итого 180 на любом экране. Ширину задаёт колонка, поэтому на
 * широком экране плитка выходит шире, чем выше (228 или 266 на 180) — верный
 * вид для «логотип сверху, подпись снизу». На телефоне колонка узкая, плитка
 * становится выше своей ширины, но логотип и подпись там того же размера, так
 * что читается одинаково.
 *
 * ПОЧЕМУ ВСЕ ПЛИТКИ ОДИНАКОВЫ. Под название всегда отведены ДВЕ строки, даже
 * если имя школы влезает в одну. Иначе ряд с коротким названием оказался бы
 * ниже соседнего, а сетка обязана быть ровной. Проверено на двадцати школах с
 * названиями от «Ёшлик» до «Государственное бюджетное общеобразовательное
 * учреждение…»: все плитки до одной 228×180, длинное название — две строки с
 * многоточием и полным текстом в подсказке.
 *
 * ЧТО ЗАПОМИНАЕТСЯ. Выбранная школа кладётся в localStorage, чтобы не
 * переспрашивать каждый раз. Рядом с названием всегда стоит «Сменить школу» —
 * запомненный выбор не должен превращаться в ловушку для того, кто ошибся.
 */

const STORAGE_KEY = "login_school_id";

export type PublicSchool = { id: string; name: string; logoUrl: string | null };

export function readRememberedSchool(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // приватный режим — просто спросим заново
  }
}

export function rememberSchool(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* приватный режим — переживём */ }
}

export function SchoolPickerModal({
  locale,
  onPick,
  onSkip,
  /** Окно открыто повторно по «Сменить школу»: список уже был загружен, и
   *  подставлять запомненное или единственную школу больше нельзя — человек
   *  пришёл сюда именно затем, чтобы выбрать другую. */
  reopened = false,
  onClose,
}: {
  locale: Locale;
  onPick: (school: PublicSchool) => void;
  /** Школ нет либо список не открылся — шага не существует. */
  onSkip: () => void;
  reopened?: boolean;
  onClose?: () => void;
}) {
  const d = getDictionary(locale);
  const t = d.auth;

  const [schools, setSchools] = useState<PublicSchool[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/schools")
      .then((r) => (r.ok ? r.json() : { schools: [] }))
      .then((json: { schools?: PublicSchool[] }) => {
        if (cancelled) return;
        // Порядок по алфавиту. Сервер уже сортирует, но полагаться на это
        // нельзя: сортировка в базе зависит от collation, а тут нужен порядок,
        // понятный человеку в его языке.
        const list = (Array.isArray(json.schools) ? json.schools : [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "ru"));
        setSchools(list);

        if (reopened) return; // повторное открытие — только ручной выбор

        // Ни одной школы — шага не существует.
        if (list.length === 0) { onSkip(); return; }

        // Прошлый выбор подставляется сам, без второго запроса.
        const remembered = readRememberedSchool();
        const found = remembered ? list.find((s) => s.id === remembered) : undefined;
        if (found) { onPick(found); return; }

        // Единственная школа — выбирать не из чего.
        if (list.length === 1) { rememberSchool(list[0]!.id); onPick(list[0]!); }
      })
      .catch(() => {
        if (cancelled) return;
        setSchools([]);
        if (!reopened) onSkip();
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !schools) return schools ?? [];
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, query]);

  // Пока список грузится и шаг ещё может оказаться пропущенным, окна не
  // показываем вовсе: мигать модалкой на долю секунды хуже, чем подождать.
  if (schools === null && !reopened) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={() => reopened && onClose?.()}
    >
      {/* 78% высоты и ширины — и ни пикселем больше: окно во весь экран
          прижимает поиск к системным элементам. Внутри всё сжимаемое
          скроллится, поэтому содержимое не режется ни на какой высоте.

          На телефоне ширина другая — 92%. 78% от 390-пиксельного экрана это
          304px: две плитки туда влезают только сплющенными до нечитаемости.
          Ограничение сверху (max-w-4xl) держит плитки квадратными на большом
          мониторе: без него при 78% от 2560px они растянулись бы в полосы. */}
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="flex h-[78vh] max-h-[78vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:w-[78vw]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{t.chooseSchoolTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.chooseSchoolSubtitle}</p>
          </div>
          {reopened && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Поиск. При двадцати школах листать неудобно, а при трёх поиск не
            мешает: поле маленькое и не отнимает места у списка. */}
        <div className="shrink-0 px-5 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={t.chooseSchoolSearch}
              autoCapitalize="none"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#FFB020] focus:bg-white"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {schools === null ? (
            <p className="py-8 text-center text-sm text-slate-400">{t.chooseSchoolLoading}</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {schools.length === 0 ? t.chooseSchoolNone : t.chooseSchoolNotFound}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { rememberSchool(s.id); onPick(s); }}
                  title={s.name}
                  className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-center transition-colors hover:border-[#FFB020] hover:bg-amber-50/40"
                >
                  {/* Логотипа может не быть — SchoolMark покажет буквы названия.
                      Правило одно на всё приложение, здесь не переписывается. */}
                  <SchoolMark name={s.name} logoUrl={s.logoUrl} size="tile" />
                  {/* Две строки с многоточием, а не одна и не сколько влезет.
                      Одна строка режет «SNR International School» до «SNR
                      Internat…» — по такому обрезку школу не узнать. Место под
                      две строки занято ВСЕГДА (min-h), даже у короткого имени:
                      иначе ряд с короткими названиями стал бы ниже соседнего, а
                      плитки обязаны быть одинаковыми все до одной. Полное
                      название — в подсказке при наведении. */}
                  {/* ДВА ТЕГА, А НЕ ОДИН — не украшательство, а найденная ошибка.
                      Обрезка в две строки живёт на display:-webkit-box, и класс
                      flex на ТОМ ЖЕ теге этот display молча перебивает: обрезка
                      отключается, длинное название занимает три строки, плитка
                      растёт, и ряд перестаёт быть ровным. Замерено на телефоне:
                      с обоими классами на одном теге плитки в сетке оказались
                      разной высоты. Поэтому внешний тег держит место под две
                      строки и центрует, внутренний обрезает. */}
                  <span className="flex min-h-[2.5rem] w-full items-center justify-center">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-tight text-slate-800">
                      {s.name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
