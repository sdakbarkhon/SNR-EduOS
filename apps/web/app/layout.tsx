import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SNR EduOS — Student Portal",
  description: "Образовательная платформа для ученика SNR",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before hydration to prevent flash.
            /parent — светлая тема принудительно и без вариантов: переключателя
            там нет, а сохранённое 'dark'/'system' иначе красило бы родителя в
            тёмное ещё до гидратации (класс вешается здесь, до первой
            отрисовки — один React-эффект этот флеш убрать не успевает).
            Ветка ученика/учителя не меняется ни на байт. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('snr-theme') || 'light';
            var parent = location.pathname === '/parent' || location.pathname.indexOf('/parent/') === 0;
            if (!parent && (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      {/* suppressHydrationWarning — браузерные расширения (Yandex/Алиса,
          переводчики, менеджеры паролей и т.д.) нередко модифицируют DOM
          <body> ДО гидратации (добавляют атрибуты/дочерние узлы) — без
          этого такая правка сторонним расширением превращается в React
          error #418 (hydration mismatch), из-за которого падает вся
          гидратация приложения (см. React #310 на /schedule, разведка
          нашла live-репорт именно с Yandex Browser). suppressHydrationWarning
          не скрывает НАШИ баги (те по-прежнему всплывают предупреждением в
          консоли) — оно только останавливает React от паники на разметке
          <body>, добавленной ПОСЛЕ первого рендера кем-то другим. */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
