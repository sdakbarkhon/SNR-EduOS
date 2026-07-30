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

            • НА /parent — СВОЙ ключ 'snr-parent-theme' и тёмная только при
              явном 'dark'. Ключи разведены намеренно: пока он был общий,
              «Тёмная», выбранная когда-то в приложении УЧЕНИКА на этом же
              устройстве, утаскивала родителя в тёмное, хотя в самом /parent
              её никто не выбирал — родитель открывал приложение и видел
              тёмный экран при выбранной «Светлой». Теперь пустой ключ
              (а он пуст у всех, кто не жал переключатель ИМЕННО в /parent)
              даёт светлую, даже на телефоне с тёмной ОС.
              prefers-color-scheme на /parent не спрашивается вовсе: у
              родителя переключатель из двух кнопок, «Системной» нет.
              color-scheme проставляется тут же, чтобы нативные элементы
              (скроллбар, поля ввода) не мигали чужой темой. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var parent = location.pathname === '/parent' || location.pathname.indexOf('/parent/') === 0;
            var dark;
            if (parent) {
              dark = localStorage.getItem('snr-parent-theme') === 'dark';
            } else {
              var t = localStorage.getItem('snr-theme') || 'light';
              dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            }
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
