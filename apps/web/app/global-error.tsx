"use client";

import { useEffect } from "react";

/**
 * Большой фикс — "React #310 ещё живёт на /schedule": повторный разведочный
 * проход (8 параллельных агентов + ручная проверка /schedule → редирект на
 * /lessons → LessonsView.tsx и ВСЕГО дерева предков: AppShell, (app)/layout,
 * fullscreen-lesson-context, LocaleProvider, ThemeProvider, Toast) НЕ нашёл
 * ни одного нарушения Rules of Hooks — та же картина, что предыдущий заход
 * ("React #310 при выходе из урока", см. apps/web/app/(app)/error.tsx) уже
 * зафиксировал для другого места. Структурно чинить нечего.
 *
 * Реальный найденный пробел — во всём приложении не было НИ ОДНОГО
 * global-error.tsx. apps/web/app/(app)/error.tsx (добавлен предыдущим
 * заходом) ловит крэши ТОЛЬКО внутри (app)-сегмента — крэш в корневом
 * app/layout.tsx (ThemeProvider/LocaleProvider, сама разметка <html>/<body>)
 * никаким вложенным error.tsx не перехватывается и падает в голый
 * next.js-дефолтный "Application error: a client-side exception has
 * occurred" — именно то сообщение, что процитировано в промте. Этот файл —
 * последняя линия обороны на уровне всего приложения.
 *
 * Требование Next.js App Router: global-error.tsx подменяет ВЕСЬ корневой
 * layout (включая <html>/<body>), поэтому не может полагаться на
 * LocaleProvider/ThemeProvider/Tailwind-классы из globals.css — если крэш
 * произошёл именно в них, этот компонент должен остаться самодостаточным
 * (инлайн-стили, захардкоженный русский текст — ru приоритетный язык
 * проекта, см. CLAUDE.md §6).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error boundary]", error.message, error.digest ? `digest=${error.digest}` : "", error);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            background: "#F2F1FA",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              maxWidth: "24rem",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              borderRadius: "1rem",
              border: "1px solid #ffffffb3",
              background: "#ffffffb3",
              padding: "2rem",
              textAlign: "center",
              boxShadow: "0 2px 12px rgba(24,20,50,0.08)",
            }}
          >
            <div style={{ fontSize: "2rem" }}>⚠️</div>
            <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#1e293b" }}>Ошибка</h1>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              Что-то пошло не так. Попробуйте обновить страницу или вернуться на главную.
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: "0.5rem",
                width: "100%",
                borderRadius: "0.75rem",
                border: "none",
                padding: "0.625rem",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)",
                cursor: "pointer",
              }}
            >
              Попробовать снова
            </button>
            <a
              href="/"
              style={{
                marginTop: "0.25rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#1D6FF5",
                textDecoration: "none",
              }}
            >
              На главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
