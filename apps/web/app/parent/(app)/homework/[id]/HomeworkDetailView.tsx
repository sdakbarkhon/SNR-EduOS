/**
 * Экран #13 «Детали задания», вёрстка — перенос RN-экрана
 * study/HomeworkDetailScreen.tsx (feat/mobile-parent-redesign, ветка
 * реального входа) → макет «SNR EduOS v2 Light.dc.html» строки 546–583:
 *   1. TopBar 46/18/8 — glass-back + «Домашнее задание»;
 *   3. компактная карточка ребёнка;
 *   4. HomeworkHeaderCard — glass r20: плитка предмета 42 + caps-предмет +
 *      заголовок + чип статуса; нижняя строка — срок и учитель;
 *   5. TeacherInstructionCard — описание задания (если есть);
 *   6. AttachmentsCard — файл, приложенный учителем (если есть);
 *   8. «Ваша сдача» — read-only содержимое сдачи ученика по типу задания;
 *   8b. TeacherCommentCard — комментарий учителя (если есть);
 *   9. PrimaryAction «Написать учителю» → /parent/messages;
 *   11. SentStateBadge — «Работа отправлена · статус», если что-то сдано.
 *
 * Блоков отправки/переотправки работы НЕТ: родитель read-only (в мобилке для
 * real-флоу они тоже не рендерятся). Степпер из 4 дат не переносится — под
 * него нет реальных данных, а рисовать выдуманные даты нельзя.
 *
 * Серверный компонент: интерактива на экране нет, кроме ссылок.
 */

import Link from "next/link";
import { InnerHeader } from "../../_study/InnerHeader";
import {
  ACCENT_INSET,
  ChildCard,
  GlassCaps,
  GlassPanel,
  IconCalendar,
  IconChat,
  IconCheck,
  IconDoc,
  MiniChip,
  ScreenBody,
  SubjectSquare,
} from "../../_study/parts";
import { StatusText, SentWithStatus } from "../../_study/StatusText";
import type { HomeworkStatusKind } from "../../_study/homework-status";
import { DIVIDER } from "../../_ui/screen-tokens";
import { DateText } from "../../_ui/dates";
import { accentGrad, chip, ink1, ink2, ink3, status, type StatusKey } from "../../v2/tokens";

type Attachment = {
  name: string;
  ext: string;
  size: string;
  externalUrl: string | null;
};

type Submission = {
  /** ISO момента сдачи — подпись собирает клиентский <DateText/>. */
  submittedAt: string;
  answerText: string | null;
  codeText: string | null;
  fileName: string | null;
  fileExt: string;
  fileSize: string;
  teacherComment: string | null;
};

type TestResult = {
  /** ISO момента сдачи — подпись собирает клиентский <DateText/>. */
  submittedAt: string;
  score: number | null;
  maxScore: number | null;
};

const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/** Плитка типа файла 42 (макет 552): расширение белым на фиолетовом стекле. */
function FileTile({ ext }: { ext: string }) {
  const c = chip(status.violet.rgb);
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 42,
        height: 42,
        borderRadius: 13,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
        fontSize: 9.5,
        fontWeight: 800,
        color: status.violet.text,
      }}
    >
      {ext}
    </span>
  );
}

function TeacherAvatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: accentGrad,
        fontSize: Math.round(size * 0.42),
        fontWeight: 800,
      }}
    >
      {initials}
    </span>
  );
}

export function HomeworkDetailView({
  childName,
  childClass,
  subjectName,
  subjectGlyph,
  color,
  title,
  description,
  statusKind,
  family,
  gradeDisplay,
  dueAt,
  createdAt,
  teacherName,
  teacherInitials,
  contentType,
  attachment,
  submission,
  test,
}: {
  childName: string;
  childClass: string | null;
  subjectName: string;
  subjectGlyph: string;
  color: string;
  title: string;
  description: string | null;
  /** Ключ состояния: слово рисует клиентский <StatusText/> — оно зависит
   *  от языка, а этот экран серверный. */
  statusKind: HomeworkStatusKind;
  family: StatusKey;
  gradeDisplay: string | null;
  /** ISO срока или null — подпись собирает клиентский <DateText/>. */
  dueAt: string | null;
  createdAt: string;
  teacherName: string | null;
  teacherInitials: string;
  contentType: string;
  attachment: Attachment | null;
  submission: Submission | null;
  test: TestResult | null;
}) {
  const st = status[family];
  const c = chip(st.rgb);
  const isTest = contentType === "test";
  const submitted = isTest ? !!test : !!submission;

  return (
    <>
      <InnerHeader title="Домашнее задание" backHref="/parent/homework" />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* 4. HomeworkHeaderCard (макет 549–554). */}
        <GlassPanel radius={20}>
          <div className="flex flex-col" style={{ padding: 13, gap: 10 }}>
            <div className="flex items-center" style={{ gap: 11 }}>
              <SubjectSquare color={color} glyph={subjectGlyph} size={42} radius={14} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className="truncate"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: ink3,
                  }}
                >
                  {subjectName}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: ink1, lineHeight: 1.25 }}>
                  {title}
                </span>
              </span>
              <MiniChip label={<StatusText kind={statusKind} grade={gradeDisplay} />} family={family} />
            </div>
            <div
              className="flex flex-wrap items-center"
              style={{ gap: 12, paddingTop: 9, borderTop: `1px solid ${DIVIDER}` }}
            >
              <span className="flex items-center" style={{ gap: 5 }}>
                <IconCalendar size={13} color={ink2} strokeWidth={1.9} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>
                  <DateText kind="dateTimeOrNone" iso={dueAt} />
                </span>
              </span>
              <span className="ml-auto flex items-center" style={{ gap: 6 }}>
                <TeacherAvatar initials={teacherInitials} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>
                  {teacherName ?? "Учитель не назначен"}
                </span>
              </span>
            </div>
          </div>
        </GlassPanel>

        {/* 5. TeacherInstructionCard — только если описание реально есть. */}
        {description && (
          <GlassPanel radius={20}>
            <div className="flex flex-col" style={{ padding: 13, gap: 6 }}>
              <GlassCaps>Задание от учителя</GlassCaps>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  color: ink2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {description}
              </p>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                Выдано: <DateText kind="dateTime" iso={createdAt} />
              </span>
            </div>
          </GlassPanel>
        )}

        {/* 6. AttachmentsCard — файл учителя. Скачивание идёт по подписанной
            ссылке Storage, которой у родителя нет: показываем сам факт файла,
            а внешнюю ссылку (если учитель её вставлял) делаем кликабельной. */}
        {attachment && (
          <GlassPanel radius={20}>
            <div className="flex flex-col" style={{ padding: 13, gap: 9 }}>
              <GlassCaps>Материалы</GlassCaps>
              <div className="flex items-center" style={{ gap: 10 }}>
                <FileTile ext={attachment.ext} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                    {attachment.name}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                    {attachment.size}
                  </span>
                </span>
                {attachment.externalUrl && HTTP_URL_RE.test(attachment.externalUrl) && (
                  <a
                    href={attachment.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      paddingBlock: 7,
                      paddingInline: 11,
                      borderRadius: 10,
                      background: chip(status.violet.rgb).background,
                      border: `1px solid ${chip(status.violet.rgb).borderColor}`,
                      fontSize: 10,
                      fontWeight: 800,
                      color: status.violet.text,
                    }}
                  >
                    Открыть
                  </a>
                )}
              </div>
            </div>
          </GlassPanel>
        )}

        {/* 8. «Работа ученика» — read-only, по типу задания. */}
        <GlassPanel radius={20}>
          <div className="flex flex-col" style={{ padding: 13, gap: 9 }}>
            <GlassCaps>Работа ученика</GlassCaps>

            {gradeDisplay && (
              <span style={{ fontSize: 13, fontWeight: 800, color: status.green.text }}>
                Оценка: {gradeDisplay}
              </span>
            )}

            {isTest ? (
              test ? (
                test.score != null && test.maxScore != null ? (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: ink1 }}>
                    Результат теста: {test.score} из {test.maxScore}
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ink2 }}>
                    Тест пройден, результат ещё считается
                  </span>
                )
              ) : (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: ink3 }}>
                  Тест ещё не пройден
                </span>
              )
            ) : !submission ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: ink3 }}>
                Работа ещё не сдана
              </span>
            ) : (
              <div className="flex flex-col" style={{ gap: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                  Отправлено: <DateText kind="dateTime" iso={submission.submittedAt} />
                </span>

                {submission.codeText && (
                  <pre
                    className="overflow-auto"
                    style={{
                      maxHeight: 220,
                      padding: 10,
                      borderRadius: 12,
                      background: "var(--p-code-bg, rgba(23,18,67,0.05))",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 10.5,
                      lineHeight: 1.5,
                      color: ink1,
                    }}
                  >
                    {submission.codeText}
                  </pre>
                )}

                {submission.answerText &&
                  (HTTP_URL_RE.test(submission.answerText) ? (
                    <a
                      href={submission.answerText}
                      target="_blank"
                      rel="noreferrer"
                      className="self-start"
                      style={{
                        paddingBlock: 7,
                        paddingInline: 11,
                        borderRadius: 10,
                        background: chip(status.violet.rgb).background,
                        border: `1px solid ${chip(status.violet.rgb).borderColor}`,
                        fontSize: 10,
                        fontWeight: 800,
                        color: status.violet.text,
                      }}
                    >
                      Открыть ссылку
                    </a>
                  ) : (
                    <p
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        lineHeight: 1.6,
                        color: ink2,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {submission.answerText}
                    </p>
                  ))}

                {submission.fileName && (
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <FileTile ext={submission.fileExt} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                        {submission.fileName}
                      </span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                        {submission.fileSize}
                      </span>
                    </span>
                    <IconDoc size={16} color={ink3} />
                  </div>
                )}

                {!submission.answerText && !submission.fileName && !submission.codeText && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ink3 }}>
                    Файл или текст ответа не приложен
                  </span>
                )}
              </div>
            )}
          </div>
        </GlassPanel>

        {/* 8b. Комментарий учителя — только если он реально есть. */}
        {submission?.teacherComment && (
          <GlassPanel radius={20}>
            <div className="flex flex-col" style={{ padding: 13, gap: 8 }}>
              <GlassCaps>Комментарий учителя</GlassCaps>
              <div className="flex items-start" style={{ gap: 9 }}>
                <TeacherAvatar initials={teacherInitials} size={28} />
                <p
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    lineHeight: 1.55,
                    color: ink2,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {submission.teacherComment}
                </p>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* 9. PrimaryAction «Написать учителю» — единственное действие,
            доступное родителю с этого экрана. */}
        <Link
          href="/parent/messages"
          className="flex items-center justify-center transition-transform active:scale-[0.99]"
          style={{
            gap: 8,
            padding: 14,
            borderRadius: 15,
            background: accentGrad,
            boxShadow: `0 14px 32px rgba(124,58,237,0.40), ${ACCENT_INSET}`,
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <IconChat size={15} color="#fff" strokeWidth={2} />
          Написать учителю
        </Link>

        {/* 11. SentStateBadge — если что-то реально сдано. */}
        {submitted && (
          <div
            className="flex items-center justify-center"
            style={{
              gap: 8,
              padding: 13,
              borderRadius: 15,
              background: c.background,
              border: `1px solid ${c.borderColor}`,
            }}
          >
            <IconCheck size={15} color={st.text} strokeWidth={2.2} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: st.text }}>
              <SentWithStatus kind={statusKind} grade={gradeDisplay} />
            </span>
          </div>
        )}
      </ScreenBody>
    </>
  );
}
