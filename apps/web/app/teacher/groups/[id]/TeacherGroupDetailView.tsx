"use client";

import Link from "next/link";
import { resolveSubject,
  getDictionary, getSubjectConfig, pluralizeStudents,
  groupClassLabel, averageOfGrades, countedGrades, studentStatus,
  formatDate, formatTime,
} from "@snr/core";
import type { Locale, TeacherGroupSubject, GradeSource, StudentStatus } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { subjectIconByName } from "@/lib/subject-icons";
import { ChevronLeft } from "lucide-react";

type LessonRow = {
  id: string;
  starts_at: string;
  topic: string | null;
  title: string | null;
  lesson_no: number | null;
  subjectName: string | null;
};

interface Props {
  group: { id: string; name: string; subject: string };
  students: Array<{ id: string; full_name: string; avatar_url: string | null; status: string }>;
  /** Настоящие предметы учителя в этой группе — см. getTeacherGroupSubjects. */
  subjects: TeacherGroupSubject[];
  /** Оценки группы, уже суженные до предмета учителя. */
  grades: Array<{ sourceTable: GradeSource; grade5: number | null }>;
  /** Статусы посещаемости по урокам этой группы. */
  attendance: string[];
  /** Последние уроки группы по предмету учителя. */
  lessons: LessonRow[];
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

/**
 * Статус ученика словами. 26.08.2026.
 *
 * Печаталось сырое значение из базы — «active». Общий словарь для этого
 * существовал всё это время: presenters/status отдаёт ключ, Dictionary.status
 * знает его на трёх языках. В живой базе у всех 31 ученика статус `active`;
 * код допускает ещё `debtor` и `frozen`, и оба уже переведены.
 *
 * Неизвестное значение показывается как есть, а не подменяется ближайшим:
 * ограничения на колонку в схеме нет, и соврать статусом хуже, чем показать
 * непонятное слово.
 */
const KNOWN_STUDENT_STATUSES: readonly StudentStatus[] = ["active", "debtor", "frozen"];

function statusLabel(d: ReturnType<typeof getDictionary>, status: string): string {
  return KNOWN_STUDENT_STATUSES.includes(status as StudentStatus)
    ? d.status[studentStatus(status as StudentStatus).key]
    : status;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-white/60 p-4">
      <div className="text-[24px] font-bold leading-none text-brand-ink">{value}</div>
      <div className="mt-1.5 text-[12px] font-medium text-brand-ink-muted">{label}</div>
    </div>
  );
}

export function TeacherGroupDetailView({ group, students, subjects, grades, attendance, lessons }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  // Предмет группы берётся из subjects, а не из groups.subject: там у каждой
  // группы стоит 'programming' с ресета Этапа 1. У куратора настоящих
  // предметов нет вовсе — все его тринадцать строк помечены is_stub, и
  // getTeacherGroupSubjects их отсеивает; тогда подписи о предмете не будет.
  const single = subjects.length === 1 ? subjects[0] : null;
  const color = resolveSubject({ catalog: single }).color;
  const GroupSubjectIcon = subjectIconByName(single?.icon);
  const cls = groupClassLabel(group.name);
  const subjectLine = subjects.map((s) => s.name).join(", ");

  // 26.08.2026. Средний балл считается ЕДИНЫМ правилом (utils/gradeAverage) —
  // своего усреднения здесь нет и быть не должно: на 24.08 их в продукте
  // насчитали семь, и одна группа показывала четыре разных числа.
  const avg = averageOfGrades(grades);
  const counted = countedGrades(grades).length;

  const present = attendance.filter((s) => s === "present").length;
  const attendancePct = attendance.length
    ? `${Math.round((present / attendance.length) * 100)}%`
    : "—";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/teacher/groups" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px]"
            style={{ background: color + "20", color }}>
            <GroupSubjectIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-brand-ink">{group.name}</h1>
            <div className="truncate text-[13px] text-brand-ink-muted" title={subjectLine}>
              {subjectLine ? `${subjectLine} · ` : ""}
              {pluralizeStudents(students.length, locale)}
              {cls ? ` · ${d.teacher.groupClassPrefix} ${cls}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Средний балл, посещаемость, число учтённых оценок — те же числа,
          что показывает карточка группы, из которой сюда заходят. */}
      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label={d.teacher.groupAvgScore} value={avg != null ? avg.toFixed(1) : "—"} />
          <StatTile label={d.teacher.groupAttendance} value={attendancePct} />
          <StatTile label={d.teacher.groupGradesCounted} value={String(counted)} />
        </div>
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.groupRecentLessons}</h2>
        {lessons.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.common.none}</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <Link key={lesson.id} href={`/teacher/lessons/${lesson.id}`}
                className="flex items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white">
                <div className="w-[86px] shrink-0 text-[12px] font-semibold text-brand-ink-muted">
                  {formatDate(lesson.starts_at, locale)}
                  <div className="font-medium">{formatTime(lesson.starts_at, locale)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-brand-ink">
                    {lesson.topic ?? lesson.title ?? d.teacher.gradesExportLesson}
                  </div>
                  <div className="truncate text-[11px] text-brand-ink-muted">
                    {lesson.lesson_no != null ? `${d.teacher.gradesExportLesson} ${lesson.lesson_no}` : ""}
                    {lesson.lesson_no != null && lesson.subjectName ? " · " : ""}
                    {lesson.subjectName ?? ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
        {students.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.common.none}</p>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-3 rounded-[14px] bg-white/60 p-3">
                <Avatar name={student.full_name} url={student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{student.full_name}</div>
                  <div className="text-[11px] text-brand-ink-muted">{statusLabel(d, student.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
