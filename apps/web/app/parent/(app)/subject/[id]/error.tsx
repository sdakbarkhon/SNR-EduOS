"use client";

import { StudyError } from "../../_study/StudyError";

/** Error-граница маршрута /parent/subject/[id] — общий компонент StudyError. */
export default function SubjectDetailError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <StudyError {...props} />;
}
