# SNR EduOS — Student Portal

Образовательная платформа для ученика: **Web (Next.js + PWA)** и **iOS (Expo / React Native)**
на едином backend **Supabase** (Postgres + Auth + Storage + Realtime).

Источники правды:
- [`tz.md`](tz.md) — функционал, роли, схема БД, приоритеты.
- [`design_spec.md`](design_spec.md) — внешний вид, экраны, дизайн-токены.
- [`CLAUDE.md`](CLAUDE.md) — рабочий протокол и scope.

## Структура (монорепо: pnpm workspaces + Turborepo)

```
apps/
  web/        Next.js (App Router) + Tailwind + PWA
  mobile/     Expo (React Native) — iOS
packages/
  core/       общий TS-слой: supabase-клиент, queries, zod-схемы, auth, i18n, config, utils
  ui-tokens/  дизайн-токены (цвета/радиусы/тени) для web и mobile
supabase/
  migrations/ SQL-миграции (источник правды по схеме)
  seed.sql    тестовые данные (RLS-проверка)
```

## Команды

```bash
pnpm install          # установить зависимости всего workspace
pnpm dev              # запустить все приложения (turbo)
pnpm build            # сборка всех пакетов
pnpm lint             # линт
pnpm type-check       # проверка типов
pnpm db:start         # локальный Supabase (нужен Docker)
pnpm db:reset         # применить миграции + seed к локальной БД
pnpm gen:types        # сгенерировать packages/core/src/database.types.ts
```

## Требуется от заказчика (ручные шаги)

1. Создать Supabase-проект, заполнить `.env` по [`.env.example`](.env.example).
2. Для локального запуска БД и RLS-тестов — установить **Docker Desktop**
   (либо предоставить доступ к hosted-проекту для применения миграций).
3. Завести тестовые аккаунты учеников (синтетический email + username + пароль).
4. Для iOS: Apple Developer аккаунт, APNs-ключ, App Store Connect (на этапе публикации).

Требования: Node ≥ 20, pnpm 9 (через `npm i -g pnpm@9` или corepack).
