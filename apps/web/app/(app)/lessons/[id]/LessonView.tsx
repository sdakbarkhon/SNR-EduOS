"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, MapPin, Check, Eye, BookOpen, FileText, Clock, ClipboardList } from "lucide-react";
import type { StudentLessonView, LessonStageWithProgress, ContentType } from "@snr/core";
import { getSubjectStyle } from "@snr/core";
import { LessonHeaderBar, LessonHeaderPill } from "@/components/LessonHeaderBar";
import { PreLessonView } from "./PreLessonView";
import { LessonWorkspaceView } from "./LessonWorkspaceView";
import { StudentStageReviewModal } from "./StudentStageReviewModal";
import { FileViewerModal } from "@/components/FileViewerModal";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });
}
function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  lesson: StudentLessonView;
  materialUrls: Record<string, string>;
  studentId: string | null;
  linkedHomework: Array<{ id: string; title: string; content_type: ContentType; due_date: string | null }>;
}

export function LessonView({ lesson, materialUrls, studentId, linkedHomework }: Props) {
  // Hooks must run unconditionally on every render — declared before the
  // scheduled/in_progress early returns below, even though they're only
  // used by the completed branch.
  const [reviewStage, setReviewStage] = useState<LessonStageWithProgress | null>(null);
  const [viewerMaterial, setViewerMaterial] = useState<{ url: string; title: string; fileName: string | null } | null>(null);

  // Before the lesson starts → full pre-lesson page (countdown + excuse).
  if (lesson.status === "scheduled") {
    return <PreLessonView lesson={lesson} studentId={studentId} />;
  }
  // Lesson is live → workspace (design lesson_workspace).
  if (lesson.status === "in_progress") {
    return <LessonWorkspaceView lesson={lesson} materialUrls={materialUrls} studentId={studentId} />;
  }

  const style = getSubjectStyle(lesson.group.subject);

  const stages = [...lesson.stages].sort((a, b) => a.position - b.position);
  const doneCount = stages.filter((s) => s.is_completed || s.progress?.is_completed).length;

  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  const heroTitle = lesson.title ?? lesson.topic ?? `Урок от ${fmtDate(lesson.starts_at)}`;

  // scheduled → PreLessonView, in_progress → LessonWorkspaceView; here status is completed
  const isScheduled   = false;
  const isInProgress  = false;
  const isCompleted   = true;

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-[#1D1D1F]">
      {/* Back */}
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад к расписанию
      </Link>

      {/* Status indicator */}
      {isScheduled && (
        <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-3 text-sm text-yellow-800">
          <Clock className="h-4 w-4 shrink-0" />
          Урок ещё не начался. Дождитесь начала.
        </div>
      )}
      {isInProgress && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500 shrink-0" />
          Урок идёт прямо сейчас
        </div>
      )}
      {isCompleted && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-500">
          <Check className="h-4 w-4 shrink-0" />
          Урок завершён
        </div>
      )}

      {/* Hero */}
      <LessonHeaderBar
        subjectIcon={lesson.subjectIcon}
        subjectColor={lesson.subjectColor}
        subjectName={lesson.subjectName ?? style.label}
        title={heroTitle}
        actions={
          lesson.teacher && (
            <div className="flex items-center gap-2 rounded-[13px] border border-[#E6E7EF] bg-white py-1 pl-1 pr-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "linear-gradient(135deg,#7C63F0,#6A4FE6)" }}
              >
                {initials(lesson.teacher.full_name)}
              </div>
              <span className="text-xs font-bold text-[#242A45]">{lesson.teacher.full_name}</span>
            </div>
          )
        }
        pills={
          <>
            <LessonHeaderPill tone="done" icon={<Check className="h-4 w-4" />}>
              Урок завершён
            </LessonHeaderPill>
            <LessonHeaderPill>{timeRange}</LessonHeaderPill>
            <LessonHeaderPill>{lesson.group.name}</LessonHeaderPill>
            {lesson.lesson_no != null && <LessonHeaderPill>{`Урок №${lesson.lesson_no}`}</LessonHeaderPill>}
            {lesson.room && (
              <LessonHeaderPill icon={<MapPin className="h-3.5 w-3.5 text-[#9CA0B4]" />}>
                Каб. {lesson.room}
              </LessonHeaderPill>
            )}
            {stages.length > 0 && (
              <LessonHeaderPill>{`Прогресс: ${doneCount}/${stages.length} этапов`}</LessonHeaderPill>
            )}
          </>
        }
      />

      {/* Stages (only if teacher enabled any) */}
      {stages.length > 0 && (
        <div className="anim-fade-up anim-delay-1">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
            Этапы урока
          </h3>
          <div className="relative flex items-center justify-between px-4">
            <div className="absolute left-[60px] right-[60px] top-[18px] z-0 h-[2px] bg-gray-200" />
            {stages.map((stage: LessonStageWithProgress) => {
              const isDone = stage.is_completed || stage.progress?.is_completed;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setReviewStage(stage)}
                  className="relative z-10 flex flex-col items-center gap-2"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-4 transition-transform duration-300 hover:scale-105 ${
                      isDone
                        ? "border-white bg-green-500 text-white shadow-sm"
                        : "border-gray-200 bg-white/70 text-gray-400 backdrop-blur-sm"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-5 w-5 text-white" strokeWidth={3} />
                    ) : (
                      <span className="text-xs font-bold">{stage.position}</span>
                    )}
                  </div>
                  <span
                    className={`max-w-[64px] truncate text-center text-xs font-bold ${
                      isDone ? "text-green-600" : "font-medium text-gray-400"
                    }`}
                  >
                    {stage.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials */}
      <div className="anim-fade-up anim-delay-2">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
          Материалы урока
        </h3>
        {isScheduled ? (
          <div className="flex items-center gap-3 rounded-2xl border border-yellow-100 bg-yellow-50/60 px-5 py-4 text-sm text-yellow-700">
            <Clock className="h-4 w-4 shrink-0" />
            Материалы появятся когда учитель начнёт урок
          </div>
        ) : lesson.materials.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-5 py-4 text-sm text-gray-400 backdrop-blur-xl">
            <BookOpen className="h-4 w-4 shrink-0" />
            Материалы к этому уроку пока не добавлены
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lesson.materials.map((m) => {
              const url = materialUrls[m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!url}
                  onClick={() => url && setViewerMaterial({ url, title: m.title, fileName: m.file_original_name })}
                  className="group flex items-center gap-3 rounded-2xl border border-white bg-white/70 p-4 text-left shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    {m.file_size_bytes && (
                      <p className="text-xs text-gray-400">{fmtBytes(m.file_size_bytes)}</p>
                    )}
                  </div>
                  {url && (
                    <span
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600"
                      title="Открыть"
                    >
                      <Eye className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Homework created from this lesson, if any */}
      {linkedHomework.length > 0 && (
        <div className="anim-fade-up anim-delay-2">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
            Задание по этому уроку
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {linkedHomework.map((hw) => (
              <Link
                key={hw.id}
                href={`/homework/${hw.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{hw.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {reviewStage && studentId && (
        <StudentStageReviewModal stage={reviewStage} studentId={studentId} onClose={() => setReviewStage(null)} />
      )}
      {viewerMaterial && (
        <FileViewerModal
          url={viewerMaterial.url}
          title={viewerMaterial.title}
          fileName={viewerMaterial.fileName}
          onClose={() => setViewerMaterial(null)}
        />
      )}
    </div>
  );
}
