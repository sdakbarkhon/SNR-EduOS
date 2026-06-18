import Link from "next/link";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { getSubjectStyle } from "@snr/core";

type LessonItem = {
  id: string;
  group_id: string;
  lesson_no: number | null;
  topic: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  group: { id: string; name: string; subject: string };
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function isFuture(iso: string): boolean {
  return new Date(iso) > new Date(new Date().setHours(23, 59, 59, 999));
}
function isPast(iso: string): boolean {
  const d = new Date(iso);
  return d < new Date(new Date().setHours(0, 0, 0, 0));
}

function LessonCard({ lesson }: { lesson: LessonItem }) {
  const style = getSubjectStyle(lesson.group.subject);
  const displayTitle = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);
  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  return (
    <Link
      href={`/teacher/lessons/${lesson.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white text-xl"
        style={{ background: style.color }}
      >
        {style.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#1D1D1F]">{displayTitle}</p>
        <p className="text-xs text-gray-500">{lesson.group.name} · {style.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeRange}</span>
          {lesson.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Каб. {lesson.room}</span>}
        </div>
      </div>
      <span className="shrink-0 text-xs text-gray-400">{fmtDate(lesson.starts_at)}</span>
    </Link>
  );
}

function Section({ title, lessons }: { title: string; lessons: LessonItem[] }) {
  if (lessons.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h2>
      <div className="space-y-2">
        {lessons.map((l) => <LessonCard key={l.id} lesson={l} />)}
      </div>
    </section>
  );
}

export function TeacherLessonsView({ lessons }: { lessons: LessonItem[] }) {
  const todayLessons = lessons.filter((l) => isToday(l.starts_at));
  const upcoming = lessons.filter((l) => isFuture(l.starts_at)).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const past = lessons.filter((l) => isPast(l.starts_at));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F]">Уроки</h1>
          <p className="text-sm text-gray-500">{lessons.length} уроков в ваших группах</p>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">Уроков нет</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Сегодня" lessons={todayLessons} />
          <Section title="Предстоящие" lessons={upcoming} />
          <Section title="Прошедшие" lessons={past} />
        </div>
      )}
    </div>
  );
}
