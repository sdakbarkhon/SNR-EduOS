/**
 * Блок 7.1 — дизайн-токены SNR EduOS v2 для ВЕБ-родителя.
 *
 * Источник 1:1 — apps/mobile-parent/src/theme/tokens.ts с ветки
 * `feat/mobile-parent-redesign` (то, что реально крутится в Expo Go),
 * которая, в свою очередь, перенесена дословно из утверждённого макета
 * «SNR EduOS v2 Light.dc.html» §s10 «Токены».
 *
 * ВАЖНО: значения не «улучшать» — они дословные. Мобилка задаёт эталон,
 * веб обязан совпадать. При расхождении правится сначала макет.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ТЁМНАЯ ТЕМА: почему здесь var(), а не цвета
 *
 * Экраны /parent красятся ИНЛАЙН-стилями из этих констант — style={{ color:
 * ink1 }} и т.п., ~680 обращений в 58 файлах, и почти все эти экраны
 * СЕРВЕРНЫЕ. Tailwind-вариант `dark:` на инлайн-стиль не действует, а
 * серверный инлайн не может отреагировать на клиентский тумблер.
 *
 * Поэтому имена и места использования сохранены, но константа хранит теперь
 * не цвет, а ссылку на CSS-переменную. Значения обеих схем лежат в
 * apps/web/app/parent/parent-theme.css (`html { --p-* }` / `html.dark { --p-* }`),
 * тема переключается классом `dark` на <html>. Ни одна из 680 строк разметки
 * не меняется: браузер разрешает var() в рантайме, сервер/клиент тут ни при чём.
 *
 * Второй аргумент var() — светлое значение как fallback. Он дублирует
 * parent-theme.css намеренно: (а) экран не «съедет в чёрное», если CSS-файл
 * не подключён на конкретном роуте, (б) дословные значения макета остаются
 * видны прямо здесь, как было до темизации.
 *
 * Что НЕ темизируется (осознанно):
 *   * subjects[k].base и subjects[k].grad — общие для тем; вдобавок их
 *     hex-форму разбирают по символам (hexToRgbCsv, `${grad[1]}55`), var()
 *     там бы сломался. Темизируется только .accent;
 *   * status[k].rgb — общая база для rgba(); темизируется только .text;
 *   * glass1.blur / glass2.blur — см. комментарий у glass1 ниже.
 *
 * Прочие отличия от мобильного файла (осознанные, из-за платформы):
 *   * градиенты хранятся сразу CSS-строками (в RN нужен был helper
 *     gradPoints() под expo-linear-gradient — вебу он не нужен, CSS
 *     понимает угол напрямую, и это как раз ИСХОДНАЯ форма из макета);
 *   * тени — CSS box-shadow строками (в RN была раскладка на
 *     shadowOffset/shadowRadius + elevation).
 */

/* ===== Геометрия (общая, §s10) ===== */

export const radius = {
  card: 24,
  tile: 18,
  chip: 999,
  phone: 48,
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  /** Поля экрана. */
  page: 18,
  /** Межблочные отступы. */
  block: 12,
} as const;

/* ===== Цвета: ссылки на переменные темы (значения — parent-theme.css) ===== */

export const ink1 = "var(--p-ink1, #171243)";
export const ink2 = "var(--p-ink2, rgba(26,19,74,0.64))";
export const ink3 = "var(--p-ink3, rgba(26,19,74,0.45))";

export const accent = "var(--p-accent, #7C3AED)";
export const accentGrad = "var(--p-accent-grad, linear-gradient(135deg, #7C3AED, #4F6DF5))";

/** Фон страницы (§s10 bg-page). */
export const bgPage =
  "var(--p-bg-page, linear-gradient(165deg, #DCD2FD 0%, #C7D3FD 34%, #C2E0FC 64%, #ECD9FB 100%))";

/**
 * Радиальные блобы фона — геометрия макета (строки 213–216, кадр 390×844),
 * одинаковая в обеих темах. Различается только цвет, поэтому он и вынесен в
 * переменную: в тёмной теме циан и розовый бледнее, а четвёртый (синий) в
 * прототипе спрятан целиком — `--p-blob4: transparent`.
 */
export const blobs = [
  { color: "var(--p-blob1, rgba(124,92,255,0.5))", size: 380, top: -110, left: -80 },
  { color: "var(--p-blob2, rgba(34,211,238,0.42))", size: 360, top: 250, right: -120 },
  { color: "var(--p-blob3, rgba(244,114,182,0.4))", size: 380, top: 480, left: -110 },
  { color: "var(--p-blob4, rgba(96,140,255,0.44))", size: 340, bottom: -100, right: -70 },
] as const;

/**
 * Стекло: основное (glass-1) и тонкое (glass-2).
 *
 * `blur` остаётся ЧИСЛОМ и остаётся светлым (22/20). Причина техническая:
 * потребители пишут `blur(${g.blur}px)`, а var() подставляется на уровне
 * токенов — `blur(var(--p-glass1-blur)px)` дало бы невалидное значение и
 * backdrop-filter отвалился бы целиком. Переменные --p-glass1-blur /
 * --p-glass2-blur в parent-theme.css заведены (тёмная 24/20) и уже
 * используются в lib/parent/glass-tokens.ts, где строка фильтра собирается
 * здесь же и целиком. Чтобы их подхватил и v2, потребителям достаточно
 * заменить `blur(${g.blur}px)` на `blur(var(--p-glass1-blur, 22px))`.
 */
export const glass1 = {
  background: "var(--p-glass1-bg, linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46)))",
  blur: 22,
};
export const glass2 = {
  background: "var(--p-glass2-bg, linear-gradient(160deg, rgba(255,255,255,0.58), rgba(255,255,255,0.36)))",
  blur: 20,
};

export const glassBorder = "var(--p-glass-border, rgba(255,255,255,0.78))";
/** inset-блик сверху (в вебе — настоящий inset box-shadow, в RN его пришлось рисовать линией). */
export const glassInset = "var(--p-glass-inset, inset 0 1.5px 0 rgba(255,255,255,0.95))";

export const shCard = "var(--p-sh-card, 0 14px 34px rgba(99,86,214,0.16))";
export const shFloat = "var(--p-sh-float, 0 20px 48px rgba(78,66,190,0.30))";

/**
 * Цветная тень под акцентной плиткой: sh-color.
 *
 * Цвет приходит аргументом, поэтому темизируются отдельно ГЕОМЕТРИЯ и АЛЬФА:
 * в светлой это тень снизу `0 8px 18px … .30`, в тёмной — глоу вокруг плитки
 * `0 0 10px … .50`. `rgba(R,G,B, var(--a))` — валидный CSS: var() подставляется
 * внутрь компоненты rgba() до разбора значения.
 */
export const shColor = (rgb: string) =>
  `var(--p-shcolor-geom, 0 8px 18px) rgba(${rgb},var(--p-shcolor-a, 0.30))`;

/** Фон/бордер чипа из базы «R,G,B» — темизируется альфа (см. shColor выше). */
export const chip = (rgb: string) => ({
  background: `rgba(${rgb},var(--p-chip-bg-a, 0.13))`,
  borderColor: `rgba(${rgb},var(--p-chip-bd-a, 0.33))`,
});

/* ===== Предметы (§s10) ===== */

export type SubjectKey = "prog" | "robo" | "math" | "eng" | "rus";

/**
 * base и grad общие для тем (и разбираются как hex — см. hexToRgbCsv,
 * `${grad[1]}55`), поэтому остаются литералами. Тёмная тема меняет только
 * accent: он светлее базового, чтобы читаться текстом/глифом на тёмном стекле.
 */
export const subjects: Record<SubjectKey, { base: string; accent: string; grad: [string, string] }> = {
  prog: { base: "#0284C7", accent: "var(--p-subj-prog-accent, #0284C7)", grad: ["#38BDF8", "#0284C7"] },
  robo: { base: "#0D9488", accent: "var(--p-subj-robo-accent, #0D9488)", grad: ["#2DD4BF", "#0D9488"] },
  math: { base: "#CA8A04", accent: "var(--p-subj-math-accent, #CA8A04)", grad: ["#FACC15", "#CA8A04"] },
  eng: { base: "#DB2777", accent: "var(--p-subj-eng-accent, #DB2777)", grad: ["#F472B6", "#DB2777"] },
  rus: { base: "#A21CAF", accent: "var(--p-subj-rus-accent, #A21CAF)", grad: ["#E879F9", "#A21CAF"] },
};

/** Градиент плитки предмета — всегда 135°, как в макете; в темах одинаков. */
export const subjectGrad = (k: SubjectKey) =>
  `linear-gradient(135deg, ${subjects[k].grad[0]}, ${subjects[k].grad[1]})`;

/**
 * Градиент 135° из произвольной пары стопов — та же форма макета, но для
 * плиток вне списка предметов (сервисы, быстрые действия, аватары).
 *
 * Живёт ЗДЕСЬ, а не в `_ui/screen-kit.tsx`, хотя раньше был там: screen-kit
 * помечен "use client", и любой его экспорт для серверного компонента
 * превращается в клиентскую ссылку. Компоненты через такую границу проходят
 * (их рендерят на клиенте), константы — тоже (читается только свойство), а
 * вот ВЫЗОВ функции падает на пререндере:
 *     Attempted to call grad135() from the server but grad135 is on the client
 * Ровно так сборка и легла на /parent/services. tokens.ts клиентским не
 * помечен, поэтому функция доступна обеим сторонам. screen-kit её реэкспортит
 * — прежние клиентские импорты не трогаем.
 */
export function grad135(g: readonly [string, string]): string {
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

/* ===== Статусы (§s10) ===== */

export type StatusKey = "green" | "red" | "violet" | "orange" | "blue" | "gray";

/**
 * rgb — общая для тем база под rgba() (чипы, кольца, тени), темизируется
 * только text: в тёмной все шесть заметно светлее.
 */
export const status: Record<StatusKey, { text: string; rgb: string }> = {
  green: { text: "var(--p-status-green-text, #047857)", rgb: "16,185,129" },
  red: { text: "var(--p-status-red-text, #B91C1C)", rgb: "239,68,68" },
  violet: { text: "var(--p-status-violet-text, #6D28D9)", rgb: "139,92,246" },
  orange: { text: "var(--p-status-orange-text, #C2410C)", rgb: "249,115,22" },
  blue: { text: "var(--p-status-blue-text, #1D4ED8)", rgb: "59,130,246" },
  gray: { text: "var(--p-status-gray-text, #475569)", rgb: "100,116,139" },
};

/* ===== Шрифты =====
 * Макет: Manrope (текст) + Unbounded (акцидентные заголовки). Подключены
 * через next/font в layout родителя — здесь только имена CSS-переменных.
 */
export const fontSans = "var(--font-manrope), 'Segoe UI', sans-serif";
export const fontDisplay = "var(--font-unbounded), var(--font-manrope), sans-serif";
