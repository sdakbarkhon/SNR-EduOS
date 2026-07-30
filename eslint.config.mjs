// Разовая, целевая ESLint-конфигурация под ОДНУ задачу: ловить нарушения
// Rules of Hooks (React error #310 "Rendered fewer hooks than expected").
//
// ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ ТОЛЬКО СЕЙЧАС (важно для истории):
// React #310 всплывал ТРИ раза, и каждый предыдущий заход искал причину
// вручную/агентами, читая файлы глазами — это принципиально не даёт
// гарантии полноты. Разведка третьего захода нашла настоящую причину
// рецидивов: **ESLint в этом монорепо не был установлен вообще** — ни
// конфига, ни зависимости, ни бинарника, а "lint"-скрипт в
// apps/web/package.json был просто `tsc --noEmit` (проверка типов, которая
// про хуки не знает НИЧЕГО). То есть правило react-hooks/rules-of-hooks —
// созданное ровно для этого класса багов и дающее ИСЧЕРПЫВАЮЩИЙ,
// детерминированный ответ — ни разу не запускалось на этой кодовой базе.
//
// Конфиг намеренно УЗКИЙ: включены только правила react-hooks, всё
// остальное выключено. Причина — не завалить проект тысячами
// стилистических замечаний на существующем коде: цель не "навести
// красоту", а закрыть конкретный класс продовых крэшей и не дать ему
// вернуться. Расширять при желании можно позже, отдельной задачей.

import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Заглушки под плагины, которые в этом репозитории НЕ установлены, но чьи
// имена уже встречаются в существующих "// eslint-disable-next-line ..."
// комментариях (наследие скаффолда с eslint-config-next). Без них ESLint
// на каждый такой комментарий выдаёт ошибку "Definition for rule ... was
// not found", и скрипт линта падает даже когда с хуками всё в порядке.
// Правила объявлены пустыми (никогда ничего не сообщают) — цель только в
// том, чтобы имя разрешалось. Список получен автоматически: grep по всем
// eslint-disable в apps/web, packages/core и apps/mobile-parent.
const noop = { create: () => ({}) };
const stubPlugin = (names) => ({ rules: Object.fromEntries(names.map((n) => [n, noop])) });

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/*.config.js",
      "**/*.config.mjs",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    // @typescript-eslint регистрируется, но НИ ОДНО его правило не
    // включается. Он нужен только чтобы уже существующие в коде
    // комментарии "// eslint-disable-next-line @typescript-eslint/..."
    // разрешались в известное имя правила — без плагина ESLint валит
    // ошибку "Definition for rule ... was not found" на каждый такой
    // комментарий (их в кодовой базе сотни) и настоящие находки тонут
    // в шуме.
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint.plugin,
      "@next/next": stubPlugin(["no-img-element"]),
      "jsx-a11y": stubPlugin(["media-has-caption"]),
      react: stubPlugin(["no-unknown-property"]),
      "@definitelytyped": stubPlugin(["export-just-namespace", "no-single-element-tuple-type"]),
    },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      // Единственное, ради чего всё затевалось: хук, вызванный условно/
      // после раннего return/в цикле/в callback'е — ошибка сборки, а не
      // сюрприз в проде у ученика.
      "react-hooks/rules-of-hooks": "error",
      // Пропущенные зависимости — предупреждение, не ошибка: это другой
      // класс багов (устаревшее замыкание), в кодовой базе есть осознанные
      // отступления с eslint-disable-комментариями, и делать их блокирующими
      // в этом заходе — выход за рамки задачи.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
