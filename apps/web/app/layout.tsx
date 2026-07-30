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

            Скрипт ОБЯЗАН оставаться блокирующим и стоять до первой отрисовки:
            класс `dark` вешается здесь, а не в React-эффекте — иначе тёмная
            тема мигала бы светлой на каждой загрузке.

            Две ветки, потому что политика темы у них разная:

            • ВНЕ /parent (ученик, учитель, админ) — исходное поведение без
              единого изменения: 'dark' → тёмная, 'system' → по
              prefers-color-scheme, остальное → светлая. Выражение ниже
              дословно то же, что было до появления /parent-ветки.

            • НА /parent — тёмная только при ЯВНОМ 'dark'. 'system', пустое
              значение и мусор дают светлую, prefers-color-scheme на /parent
              не спрашивается вовсе: у родителя переключатель из двух кнопок
              («Светлая»/«Тёмная»), варианта «Системная» нет, и первый вход с
              пустым localStorage обязан быть светлым даже на тёмной ОС.
              color-scheme проставляется тут же, чтобы нативные элементы
              (скроллбар, поля ввода) не мигали чужой темой. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('snr-theme') || 'light';
            var parent = location.pathname === '/parent' || location.pathname.indexOf('/parent/') === 0;
            var dark = parent
              ? t === 'dark'
              : (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
            if (dark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            if (parent) {
              document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
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
