# Применение Промта 1 — Очистка БД и засев демо-данных

> **ВАЖНО: Необратимая операция.** Перед применением сделай SQL dump базы данных.

---

## Предварительно: создать backup

В Supabase Dashboard → Settings → Database → Backups  
или через psql:
```
pg_dump <connection_string> > backup_before_iter4.sql
```

---

## Шаг 1: Применить миграцию 57 (очистка данных)

```powershell
$env:SUPABASE_ACCESS_TOKEN="<твой_токен>"
npx supabase db push --linked
```

Миграция удалит ВСЕ данные (учеников, учителей, группы, уроки и т.д.), сохранив:
- Структуру таблиц
- RLS политики
- Триггеры
- Запись в таблице `admins`
- Соответствующего auth.users (admin@admins.snr.local)

---

## Шаг 2: Установить зависимости

```powershell
pnpm install
```

(dotenv теперь добавлен в apps/web/package.json)

---

## Шаг 3: Проверить .env.local в apps/web/

Файл `apps/web/.env.local` должен содержать:
```
NEXT_PUBLIC_SUPABASE_URL=https://qaljcmkkajqyawccxetq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

`SUPABASE_SERVICE_ROLE_KEY` нужен для создания пользователей через admin API  
и вставки данных в обход RLS. Никогда не коммить в git.

---

## Шаг 4: Запустить скрипт засева

```powershell
pnpm --filter web seed:demo-iter4
```

Скрипт создаст:
- 1 учителя (Карим Алишер Botirovich)
- 3 группы (3-А, 7-А, 10-А)
- 3 ученика (по одному на класс)
- 6 предметов (Робототехника + Программирование в каждой группе)
- 6 домашних заданий
- 6 карточек книг

---

## Шаг 5: Проверить на сайте

1. Открой **eduos.snruz.uz**
2. Войди как **teacher_demo / password123** → должен зайти как Карим Алишер, видеть 3 класса
3. Войди как **Aziz_03 / password123** → должен зайти как Aziz, видеть 2 предмета (3-А)
4. Войди как **Nodira_07 / password123** → должен зайти как Nodira (7-А)
5. Войди как **Sherzod_10 / password123** → должен зайти как Sherzod (10-А)
6. Войди как **admin@admins.snr.local / admin123** → должен зайти как раньше

---

## Учётные данные

### Учитель
| Поле | Значение |
|---|---|
| Логин | teacher_demo |
| Пароль | password123 |
| Email | teacher_demo@snr.local |
| ФИО | Карим Алишер Botirovich |

### Ученики
| Логин | Пароль | ФИО | Класс |
|---|---|---|---|
| Aziz_03 | password123 | Aziz Karimov | 3-А |
| Nodira_07 | password123 | Nodira Yusupova | 7-А |
| Sherzod_10 | password123 | Sherzod Tashkenbaev | 10-А |

### Администратор (без изменений)
| Поле | Значение |
|---|---|
| Email | admin@admins.snr.local |
| Пароль | admin123 |

---

## Адаптации относительно промта (что изменено)

### Миграция 57 (сверх списка из промта)
Добавлены таблицы, которых не было в исходном DELETE-списке:
- `quiz_answers`, `quiz_attempts`, `quiz_questions`, `kahoot_sessions` — Kahoot/QIA функционал
- `classwork_submissions`, `classwork_questions`, `classwork` — классная работа
- `lesson_excuse_requests`, `lesson_raised_hands` — функции урока (отпроситься/рука)
- `project_attachments`, `project_stage_progress`, `project_submissions`, `project_stages` — проекты
- `book_favorites` — избранные книги
- `ai_chat_messages` — история ИИ-чата
- `announcement_reads` — прочитанные объявления
- `test_answers`, `test_submissions`, `test_question_options`, `test_questions` — тесты ДЗ
- `grades`, `notification_settings`, `messages`, `payments`, `charges` — через DO block (IF EXISTS)

Таблица `group_materials` из промта **не существует** — пропущена.

### Seed script (адаптации схемы)
- `groups.subject` — поле NOT NULL (миграция 2); добавлено значение `'mixed'`
- `books.uploaded_by` — правильное название (вместо `teacher_id`)
- `books.file_storage_path` — NOT NULL; используется плейсхолдер `'placeholder/not-uploaded-yet'`
- `books.cover_storage_path` — правильное название (вместо `cover_url`)
- `books.subject` — обязательное поле; добавлен subject на каждую книгу
- `books` не имеет `group_id` — книги school-wide; поле убрано

---

## Книги для ручной загрузки PDF

После засева карточки книг созданы с placeholder-путём. Загрузи реальные PDF:

### 3-А класс
- "Scratch для детей" — Маджед Маржи
- "Программирование в Scratch" — Голиков Денис

### 7-А класс
- "Python для детей" — Джейсон Бриггс
- "Простая электроника" — Чарльз Платт

### 10-А класс
- "Изучаем Python" — Марк Лутц (5-е издание)
- "Грокаем алгоритмы" — Адитья Бхаргава
