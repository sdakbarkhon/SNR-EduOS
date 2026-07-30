"use client";

import { StudyError } from "../_study/StudyError";

/** Error-граница маршрута /parent/day — общий компонент ../_study/StudyError.
 *  parent-queries не глотает ошибки, поэтому сбой должен быть видим и
 *  повторяем, а не выглядеть как «данных нет». */
export default function DayError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <StudyError {...props} />;
}
