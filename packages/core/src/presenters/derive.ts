import type { Attendance, AttendanceWithLesson, ContentType, Homework, HomeworkSubmission, HomeworkWithSubmission, Lesson, TestSubmission } from "../types";
import { isSameTashkentDay } from "../utils/date";

const DEFAULT_LESSON_MS = 45 * 60 * 1000;

/** % посещаемости: present / всего, округлённый. */
export function attendancePercent(records: Pick<Attendance, "status">[]): number {
  if (records.length === 0) return 0;
  const attended = records.filter((r) => r.status === "present").length;
  return Math.round((attended / records.length) * 100);
}

/** Ближайший будущий или идущий сейчас урок. */
export function nextLesson<T extends Pick<Lesson, "starts_at" | "ends_at" | "status">>(
  lessons: T[],
  now: number = Date.now(),
): T | null {
  const upcoming = lessons
    .filter((l) => l.status !== "completed")
    .filter((l) => {
      const end = l.ends_at
        ? new Date(l.ends_at).getTime()
        : new Date(l.starts_at).getTime() + DEFAULT_LESSON_MS;
      return end >= now;
    })
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  return upcoming[0] ?? null;
}

// ─── Посещаемость ─────────────────────────────────────────────────────────────

export const ATTENDANCE_LOW_THRESHOLD = 75; // TODO: вынести в настройки школы

export type SubjectAttendanceStat = {
  subject: string;
  /** Вид предмета из справочника школы — для плитки. Пусто, если урок без
   *  назначения: тогда экран рисует запасной значок и цвет. */
  icon: string | null;
  color: string | null;
  pct: number;
  attended: number;
  total: number;
};

export type AttendanceStats = {
  overall: number;
  bySubject: SubjectAttendanceStat[];
  daysWithoutAbsence: number;
  missed: number;
};

/** Полная статистика посещаемости по записям с join-данными. */
export function attendanceCalcAll(rows: AttendanceWithLesson[]): AttendanceStats {
  if (rows.length === 0) {
    return { overall: 0, bySubject: [], daysWithoutAbsence: 0, missed: 0 };
  }

  // overall
  const attended = rows.filter((r) => r.status === "present").length;
  const overall = Math.round((attended / rows.length) * 100);

  // missed = any absence (excused or unexcused)
  const missed = rows.filter((r) => r.status !== "present").length;

  // days without absence
  const byDay = new Map<string, { hasAbsent: boolean }>();
  for (const r of rows) {
    const d = r.lesson.starts_at.slice(0, 10);
    const cur = byDay.get(d) ?? { hasAbsent: false };
    if (r.status !== "present") cur.hasAbsent = true;
    byDay.set(d, cur);
  }
  const daysWithoutAbsence = [...byDay.values()].filter((d) => !d.hasAbsent).length;

  // by subject
  // 06.09.2026 — группируем по ПРЕДМЕТУ УРОКА. Здесь стояла колонка группы
  // (`lesson.group.subject`): она устарела вместе с моделью «группа = один
  // курс», у трёх демо-классов в ней одно и то же слово, и вся посещаемость
  // ученика складывалась в один предмет. Колонка оставлена запасным путём для
  // строк, у которых предмета урока нет вовсе.
  const subjectMap = new Map<string, { attended: number; total: number; icon: string | null; color: string | null }>();
  for (const r of rows) {
    const subj = (r.lesson.subject?.name ?? "").trim() || r.lesson.group.subject;
    const cur = subjectMap.get(subj)
      ?? { attended: 0, total: 0, icon: r.lesson.subject?.icon ?? null, color: r.lesson.subject?.color ?? null };
    cur.total += 1;
    if (r.status === "present") cur.attended += 1;
    subjectMap.set(subj, cur);
  }
  const bySubject: SubjectAttendanceStat[] = [...subjectMap.entries()]
    .map(([subject, { attended, total, icon, color }]) => ({
      subject,
      icon,
      color,
      pct: Math.round((attended / total) * 100),
      attended,
      total,
    }))
    .sort((a, b) => b.pct - a.pct);

  return { overall, bySubject, daysWithoutAbsence, missed };
}

/** Записи посещаемости за конкретный день — для точки в календаре. */
export function attendanceForDay(
  rows: AttendanceWithLesson[],
  day: Date,
): AttendanceWithLesson[] {
  // 26.08.2026: сравнение дня — по Ташкенту, а не в поясе среды. Раньше обе
  // стороны читались через getFullYear/getMonth/getDate, то есть на сервере
  // сравнивались дни UTC. Сегодня это не проявлялось (уроки идут 09:00–14:30
  // по Ташкенту и суток не пересекают), но правило то же, что и везде.
  return rows.filter((r) => isSameTashkentDay(r.lesson.starts_at, day));
}

/** Цвет точки для дня: absent_* → warning, present → success, нет записей → null */
export type DotColor = "success" | "warning" | "neutral" | null;
export function dayDotColor(dayRows: AttendanceWithLesson[]): DotColor {
  if (dayRows.length === 0) return null;
  if (dayRows.some((r) => r.status !== "present")) return "warning";
  return "success";
}

// ─── Расписание ───────────────────────────────────────────────────────────────

/** Уроки на конкретный день (по локальной дате), отсортированы по времени. */
export function lessonsOnDay<T extends Pick<Lesson, "starts_at">>(
  lessons: T[],
  day: Date,
): T[] {
  // 26.08.2026: день считается по Ташкенту (см. attendanceForDay выше).
  return lessons
    .filter((l) => isSameTashkentDay(l.starts_at, day))
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
}

// ─── Домашние задания ─────────────────────────────────────────────────────────

export type HomeworkTab = "active" | "review" | "completed" | "overdue";

/** Категория ДЗ для табов (единая логика, не путать с homeworkState-StatusBadge).
 *  `now` — по умолчанию реальное время (как и было), но вызывающий может
 *  передать замороженное `getDemoNow().getTime()` — иначе категоризация
 *  "просрочено" расходится между ролями, у которых свой источник "сейчас"
 *  (см. resheniya_2.md, заморозка времени 05.08.2026). */
export function homeworkCategory(
  hw: Pick<Homework, "due_date"> & { content_type?: ContentType; test_submission?: TestSubmission | null },
  submission?: Pick<HomeworkSubmission, "status"> | null,
  now: number = Date.now(),
): HomeworkTab {
  if (hw.content_type === "test") {
    if (hw.test_submission) return "completed";
    const due = hw.due_date ? new Date(hw.due_date).setHours(23, 59, 59, 999) : null;
    if (due !== null && due < now) return "overdue";
    return "active";
  }
  // ЧЕРНОВИК — НЕ «НА ПРОВЕРКЕ». Пункт 122, 03.09.2026.
  //
  // Раньше сюда попадала ЛЮБАЯ строка сдачи, и `in_progress` — работа,
  // которую ученик начал, но не отправил, — вставала в таб «На проверку»
  // с янтарным бейджем «На проверке».
  //
  // Это было прямой неправдой сразу с двух сторон. Учитель такую работу НЕ
  // ВИДИТ вовсе: и очередь проверки, и пончик на его экране отбрасывают
  // черновики нарочно — «их никто не сдавал, и держать их в „Всего работ"
  // значит обещать проверку того, чего учителю не отдавали»
  // (app/teacher/homework/TeacherHomeworkView.tsx). А экран самого задания у
  // ученика писал про ту же работу «Не сдано»: два его собственных экрана
  // спорили об одной работе.
  //
  // Верное слово — «Не сдано»: работа действительно не отправлена, и никто
  // её не проверяет. Поэтому черновик проходит НИЖЕ, к разбору срока, и
  // ведёт себя как несданная работа: «Активно», пока срок не вышел, и
  // «Просрочено», когда вышел.
  //
  // Счётчики табов считает homeworkCounts() этой же функцией — они уезжают
  // вместе с бейджем, и разойтись между собой не могут.
  if (submission && submission.status !== "in_progress") {
    return submission.status === "graded" ? "completed" : "review";
  }
  const due = hw.due_date ? new Date(hw.due_date).setHours(23, 59, 59, 999) : null;
  if (due !== null && due < now) return "overdue";
  return "active";
}

export type DeadlineUrgency = "normal" | "soon" | "overdue";

/** Срочность дедлайна: просрочено / < 2 дней / нормально. `now` — см.
 *  комментарий у homeworkCategory() выше, тот же принцип. */
export function deadlineUrgency(dueDate: string | null, now: number = Date.now()): DeadlineUrgency {
  if (!dueDate) return "normal";
  const due = new Date(dueDate).setHours(23, 59, 59, 999);
  if (due < now) return "overdue";
  if (due - now < 2 * 86_400_000) return "soon";
  return "normal";
}

export type HomeworkCounts = {
  active: number;
  review: number;
  completed: number;
  overdue: number;
  total: number;
};

/** Счётчики по всем табам за один проход. `now` — см. homeworkCategory():
 *  найдено при заморозке времени 05.08.2026 — эта функция тоже зовёт
 *  homeworkCategory() внутри, без прокидывания now() счётчики бейджей
 *  разошлись бы с фильтрацией списка на том же экране. */
export function homeworkCounts(rows: HomeworkWithSubmission[], now: number = Date.now()): HomeworkCounts {
  let active = 0, review = 0, completed = 0, overdue = 0;
  for (const r of rows) {
    const tab = homeworkCategory(r, r.submission, now);
    if (tab === "active") active++;
    else if (tab === "review") review++;
    else if (tab === "completed") completed++;
    else if (tab === "overdue") overdue++;
  }
  return { active, review, completed, overdue, total: rows.length };
}
