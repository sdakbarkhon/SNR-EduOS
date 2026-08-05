import type { Gradient, HomeFeedRow, HomeViewData } from "./HomeView";
import { HomeView } from "./HomeView";
import { getParentContext } from "@/lib/parent-context";
import {
  childDailyStats,
  childDailyStatus,
  childGradesSummary,
  childHomework,
  childNextLessonDate,
  childScheduleDay,
  getSelectedChild,
  parentToday,
  parentUnreadCount,
} from "@/lib/parent-queries";
import { getDemoNowMs } from "@/lib/demo-date";
import { avatarGradient, givenNameLetter, initialsOf, tashkentDay } from "../_ui/format";
import { getDueBills, getDueBillsCount, getDueTotal, getSelectedChildContext } from "../v2/data";
import { billsCountLabel } from "../payments/mock-data";
import { subjects, type StatusKey, type SubjectKey } from "../v2/tokens";
import { tashkentRelativeDayLabel, tashkentTimeLabel } from "./tashkent";

/**
 * «Главная» (П5) — серверная сборка view-model из РЕАЛЬНЫХ данных Supabase.
 *
 * Раньше страница была витриной фикстур ../v2/data (чужой ребёнок «Малика
 * Каримова», выдуманные числа). Теперь всё, что можно взять из БД, берётся
 * через lib/parent-queries — обёртки, которые сами резолвят выбранного ребёнка
 * и ВСЕГДА передают studentId в core (иначе родительский RLS вернул бы
 * объединение по всем детям и экран молча соврал бы на втором ребёнке).
 *
 * Что остаётся моком и почему: «Кошелёк», «К оплате», «Питание» — платёжного
 * бэкенда и сервиса питания в проекте нет вовсе (ни таблиц, ни core-запросов),
 * поэтому это единственные три числа на экране, которые не из БД. Питание
 * помечено константой MOCK_* ниже, чтобы его было видно грепом, а «Кошелёк» и
 * «К оплате» берутся аксессорами ../v2/data — теми же, что и на
 * /parent/payments: две плитки в одном тапе друг от друга обязаны показывать
 * под одним ярлыком одно число.
 *
 * Все производные строки (время, даты, инициалы) считаются ЗДЕСЬ, на сервере:
 * клиентский `new Date()` дал бы другой результат (часовой пояс браузера +
 * замороженная демо-дата) и React ругался бы на рассинхрон гидратации.
 */

/* ─── Мок-значения: бэкенда нет ───────────────────────────────────────────── */

/**
 * Баланс кошелька — из той же фикстуры, что и экраны /parent/payments и
 * /parent/payments/top-up, а не своей константой.
 *
 * Раньше здесь лежало `185 000`, тогда как оба экрана оплат показывали баланс
 * из `getSelectedChildContext().wallet_balance`. Это ровно тот же дефект, что
 * был у «К оплате» ниже: два экрана в одном тапе друг от друга под одной
 * подписью показывали разные числа. Платёжного бэкенда по-прежнему нет (см.
 * заголовок файла) — но фикстура должна быть ОДНА.
 */
function walletBalance(): number {
  return getSelectedChildContext().wallet_balance;
}
/**
 * «К оплате» — ЕДИНЫЙ источник с экраном /parent/payments: те же аксессоры
 * над той же фикстурой счетов, а не своя константа.
 *
 * Раньше здесь лежало `{ amount: 1 250 000, bills: 2 }`. 1 250 000 — это
 * «ОБЩИЙ БАЛАНС» экрана оплат, а не долг: плитка на главной и экран оплат,
 * до которого один тап, показывали под одним ярлыком «К оплате» разные числа,
 * и меньшее выглядело опечаткой. Настоящий долг — getDueTotal() (4 950 000).
 */
function dueTile(): { amount: number; bills: number; untilLabel: string } {
  // «5 августа 2026» → «до 5 августа»: год в плитке не нужен.
  const deadline = getDueBills()[0]?.due_date_label.replace(/\s*\d{4}$/, "") ?? "";
  return {
    amount: getDueTotal(),
    bills: getDueBillsCount(),
    untilLabel: deadline ? `до ${deadline}` : "",
  };
}
/** «Питание»: статус абонемента. */
const MOCK_MEALS = { statusLabel: "Активно", untilLabel: "до конца месяца" };

/* ─── Предметы: цветовая схема v2 по названию предмета ────────────────────── */

const SUBJECT_GLYPH: Record<SubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** У предметов в БД нет ключа палитры v2 (только name/icon/color), поэтому
 *  сопоставляем по названию, а незнакомое — стабильным хешем: один и тот же
 *  предмет обязан получать один и тот же цвет на всех экранах и рендерах. */
const SUBJECT_PATTERNS: readonly (readonly [RegExp, SubjectKey])[] = [
  [/матем|алгебр|геометр/i, "math"],
  [/англ|english/i, "eng"],
  [/рус|литерат/i, "rus"],
  [/робот|robot|ардуин|arduino/i, "robo"],
  [/програм|информат|код|python|scratch|web|веб/i, "prog"],
];

const SUBJECT_KEYS: readonly SubjectKey[] = ["prog", "robo", "math", "eng", "rus"];

function subjectKeyOf(name: string): SubjectKey {
  for (const [re, key] of SUBJECT_PATTERNS) {
    if (re.test(name)) return key;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_KEYS[hash % SUBJECT_KEYS.length] ?? "prog";
}

function subjectGradient(name: string): Gradient {
  const g = subjects[subjectKeyOf(name)].grad;
  return [g[0], g[1]];
}

/* ─── Форматирование ──────────────────────────────────────────────────────── */

/** Разряды по 3 цифры, разделитель — неразрывный пробел (макет: «185 000»). */
const NBSP = " ";
function formatMoney(value: number): string {
  const s = String(Math.round(Math.abs(value)));
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) groups.unshift(s.slice(Math.max(0, i - 3), i));
  const joined = groups.join(NBSP);
  return value < 0 ? `-${joined}` : joined;
}

/** «Исмаилов Шерзод» → «Шерзод» (в БД порядок «Фамилия Имя», см. initialsOf). */
function givenNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[1] ?? parts[0] ?? "";
}

/** Родительный падеж мужского/женского имени: «Шерзод» → «Шерзода».
 *  Нужен ровно для одной строки приветствия («…у Шерзода сегодня»). */
function genitiveName(name: string): string {
  if (!name) return name;
  const last = name.slice(-1);
  const prev = name.slice(-2, -1).toLowerCase();
  if (last === "й" || last === "ь") return `${name.slice(0, -1)}я`;
  if (last === "я") return `${name.slice(0, -1)}и`;
  if (last === "а") return `${name.slice(0, -1)}${"гкхжчшщ".includes(prev) ? "и" : "ы"}`;
  if ("оеиуыэю".includes(last.toLowerCase())) return name;
  return `${name}а`;
}

/** Часть суток по Ташкенту — префикс приветствия. UTC+5 без переходов на
 *  летнее время, поэтому сдвиг миллисекундами точен (тот же приём, что в
 *  lib/parent-queries.ts). */
function greetingPrefix(): string {
  const hour = new Date(getDemoNowMs() + 5 * 60 * 60 * 1000).getUTCHours();
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

/* ─── Страница ────────────────────────────────────────────────────────────── */

export default async function ParentHomePage() {
  const ctx = await getParentContext();
  const child = await getSelectedChild();

  const parentFullName = ctx?.parentName ?? "";
  const parentFirstName = givenNameOf(parentFullName);
  const parentInitials = parentFullName ? initialsOf(parentFullName) : "?";

  // parentUnreadCount() раньше ждали ДО развилки child/no-child отдельным
  // await — лишний последовательный round-trip перед стартом остальных
  // запросов. Он не зависит от child, поэтому запускаем его сразу и
  // Promise.all'им с остальными: экономит один сетевой round-trip на каждый
  // заход на /parent/home (ветка «есть ребёнок» — самая частая).
  const bellCountPromise = parentUnreadCount();

  if (!child) {
    const bellCount = await bellCountPromise;
    // ctx может быть null и по совсем другой причине (гонка с редиректом —
    // см. комментарий в profile/page.tsx), тогда hadError не имеет смысла.
    const childLoadError = Boolean(ctx?.hadError);
    const data: HomeViewData = {
      parent: { firstName: parentFirstName, initials: parentInitials },
      bellCount,
      child: null,
      childLoadError,
      greeting: {
        title: `${greetingPrefix()}${parentFirstName ? `, ${parentFirstName}` : ""}!`,
        subtitle: childLoadError
          ? "Не удалось загрузить данные — попробуйте обновить страницу"
          : "Профиль ученика ещё не привязан к вашему аккаунту",
      },
      statusChip: null,
      metrics: { atSchoolSince: "—", lessonsTotal: "0", attended: "0/0", homework: "0", walletLabel: "—" },
      nextLesson: null,
      due: { amountLabel: "—", subtitle: "" },
      meals: { statusLabel: "—", untilLabel: "" },
      assistantText: "",
      feed: [],
    };
    return <HomeView data={data} />;
  }

  const today = parentToday();
  const [stats, dayStatus, homework, gradesSummary, bellCount] = await Promise.all([
    childDailyStats(today),
    childDailyStatus(today),
    childHomework(),
    childGradesSummary(),
    bellCountPromise,
  ]);

  const childGiven = givenNameOf(child.full_name);
  const gradient = avatarGradient(child.id);

  /* ── Следующий урок: сегодняшний, иначе первый урок ближайшего учебного дня ── */

  const nowIso = new Date(getDemoNowMs()).toISOString();
  let next: {
    subjectName: string;
    startsAt: string;
    room: string | null;
    teacher: string | null;
    dateKey: string;
  } | null = null;

  const upcomingToday = dayStatus.lessons.find((l) => l.startsAt > nowIso);
  if (upcomingToday) {
    next = {
      subjectName: upcomingToday.subjectName ?? upcomingToday.title,
      startsAt: upcomingToday.startsAt,
      room: upcomingToday.room,
      teacher: upcomingToday.teacherName,
      dateKey: today,
    };
  } else {
    const nextDate = await childNextLessonDate(today);
    if (nextDate) {
      const lessons = await childScheduleDay(nextDate);
      const first = lessons[0];
      if (first) {
        next = {
          subjectName: first.subject?.name ?? first.title ?? "Урок",
          startsAt: first.starts_at,
          room: first.room,
          teacher: first.subject?.teacher?.full_name ?? first.group.teacher?.full_name ?? null,
          dateKey: nextDate,
        };
      }
    }
  }

  const nextLesson: HomeViewData["nextLesson"] = next
    ? {
        subjectName: next.subjectName || "Урок",
        metaLabel: [
          tashkentRelativeDayLabel(next.dateKey, today),
          tashkentTimeLabel(next.startsAt),
          next.room ? `каб. ${next.room}` : null,
          next.teacher,
        ]
          .filter((p): p is string => Boolean(p))
          .join(" · "),
        glyph: SUBJECT_GLYPH[subjectKeyOf(next.subjectName || "Урок")],
        gradient: subjectGradient(next.subjectName || "Урок"),
      }
    : null;

  /* ── Статус дня ─────────────────────────────────────────────────────────── */

  let statusChip: HomeViewData["statusChip"];
  if (dayStatus.totalLessons === 0) {
    statusChip = { label: "Выходной", tone: "gray" };
  } else if (stats.arrivalTime && upcomingToday) {
    statusChip = { label: "В школе", tone: "green" };
  } else if (stats.arrivalTime) {
    statusChip = { label: "Уроки окончены", tone: "gray" };
  } else {
    statusChip = { label: "Нет отметок", tone: "gray" };
  }

  /* ── Домашние задания ───────────────────────────────────────────────────── */

  const pendingHomework = homework
    .filter((h) => !h.submission && !h.test_submission)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const submittedToday = homework.filter((h) => {
    const at = h.submission?.submitted_at;
    return at != null && tashkentDay(at) === today;
  });

  /* ── Лента «Сегодня» ────────────────────────────────────────────────────── */

  const subjectIdByName = new Map(gradesSummary.subjects.map((s) => [s.subjectName, s.subjectId]));
  const subjectHref = (name: string | null) => {
    const id = name ? subjectIdByName.get(name) : undefined;
    return id ? `/parent/subject/${id}` : "/parent/day";
  };

  const feed: HomeFeedRow[] = [];

  for (const g of dayStatus.gradesToday.slice(0, 2)) {
    feed.push({
      id: `grade-${g.subjectName}-${g.grade}-${feed.length}`,
      title: g.subjectName,
      subtitle: "Оценка за урок сегодня",
      href: subjectHref(g.subjectName),
      icon: { gradient: subjectGradient(g.subjectName), glyph: SUBJECT_GLYPH[subjectKeyOf(g.subjectName)] },
      badge: { kind: "grade", value: g.grade },
    });
  }

  for (const h of submittedToday.slice(0, 2)) {
    if (feed.length >= 4) break;
    const graded = h.submission?.grade != null;
    feed.push({
      id: `sub-${h.id}`,
      title: h.title,
      subtitle: h.subjectName ?? h.group.name,
      href: "/parent/homework",
      icon: {
        gradient: subjectGradient(h.subjectName ?? h.title),
        glyph: SUBJECT_GLYPH[subjectKeyOf(h.subjectName ?? h.title)],
      },
      badge: graded
        ? { kind: "grade", value: h.submission?.grade ?? 0 }
        : { kind: "chip", label: "Сдано", tone: "green" as StatusKey },
    });
  }

  for (const h of pendingHomework) {
    if (feed.length >= 4) break;
    const dueKey = h.due_date ? tashkentDay(h.due_date) : null;
    let label = "Без срока";
    let tone: StatusKey = "gray";
    if (dueKey) {
      if (dueKey < today) {
        label = "Просрочено";
        tone = "red";
      } else if (dueKey === today) {
        label = "Срок сегодня";
        tone = "orange";
      } else {
        label = `Срок ${tashkentRelativeDayLabel(dueKey, today) ?? ""}`.trim();
        tone = "orange";
      }
    }
    feed.push({
      id: `hw-${h.id}`,
      title: h.title,
      subtitle: h.subjectName ?? h.group.name,
      href: "/parent/homework",
      icon: {
        gradient: subjectGradient(h.subjectName ?? h.title),
        glyph: SUBJECT_GLYPH[subjectKeyOf(h.subjectName ?? h.title)],
      },
      badge: { kind: "chip", label, tone },
    });
  }

  /* ── Текст ассистента: только из реальных чисел ─────────────────────────── */

  const avgLabel = gradesSummary.average != null ? gradesSummary.average.toFixed(1).replace(".", ",") : null;
  const assistantParts: string[] = [];
  if (dayStatus.totalLessons === 0) {
    assistantParts.push(`Сегодня у ${genitiveName(childGiven)} уроков нет.`);
  } else {
    assistantParts.push(`Сегодня посещено ${dayStatus.attendedCount} из ${dayStatus.totalLessons} уроков.`);
  }
  if (dayStatus.gradesToday.length > 0) {
    assistantParts.push(`Новых оценок за день — ${dayStatus.gradesToday.length}.`);
  }
  assistantParts.push(
    avgLabel ? `Средний балл — ${avgLabel}.` : "Оценок пока нет — они появятся здесь сразу после выставления.",
  );
  if (pendingHomework.length > 0) {
    assistantParts.push(`Несданных заданий: ${pendingHomework.length}.`);
  }

  /* ── Итоговый view-model ────────────────────────────────────────────────── */

  const data: HomeViewData = {
    parent: { firstName: parentFirstName, initials: parentInitials },
    bellCount,
    child: {
      fullName: child.full_name,
      initial: givenNameLetter(child.full_name),
      className: child.className ?? "",
      gradient: [gradient[0], gradient[1]],
    },
    greeting: {
      title: `${greetingPrefix()}${parentFirstName ? `, ${parentFirstName}` : ""}!`,
      subtitle: `Вот что происходит у ${genitiveName(childGiven)} сегодня`,
    },
    statusChip,
    metrics: {
      atSchoolSince: stats.arrivalTime ? tashkentTimeLabel(stats.arrivalTime) : "—",
      lessonsTotal: String(dayStatus.totalLessons),
      attended: `${dayStatus.attendedCount}/${dayStatus.totalLessons}`,
      homework: String(pendingHomework.length),
      walletLabel: `${formatMoney(walletBalance())} сум`,
    },
    nextLesson,
    due: (() => {
      const d = dueTile();
      return {
        amountLabel: `${formatMoney(d.amount)} сум`,
        subtitle: [billsCountLabel(d.bills), d.untilLabel].filter(Boolean).join(" · "),
      };
    })(),
    meals: { statusLabel: MOCK_MEALS.statusLabel, untilLabel: MOCK_MEALS.untilLabel },
    assistantText: assistantParts.join(" "),
    feed,
  };

  return <HomeView data={data} />;
}
