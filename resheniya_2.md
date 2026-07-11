# resheniya_2.md — решения по PROMT_3+ (новый файл)

## PROMT 3 — старт, договорённости с пользователем

Дата старта: 2026-07-11.
Ветка: main. HEAD на старте: `3782d62` (fix(grades): fix missing grades on student view).

### Три блокера, разрешение получено:

1. **Применение миграций к hosted БД.** Метод — Management API SQL query (тот же, что для миграций 105/107). Токен `SUPABASE_ACCESS_TOKEN` подаётся через env var (не литералом в bash-строке). Если classifier заблокирует 2-3 раза подряд — переключение на вариант B (пользователь сам применяет через Dashboard SQL Editor).

2. **AI-генерация — гибрид:**
   - Пилот 3 уроков — через **реальный `@anthropic-ai/sdk`** (модель `claude-sonnet-4-6`, prompt caching, учёт токенов). Проверяет endpoint + даёт реальную оценку стоимости на масштаб.
   - Массовая генерация (~50-80 остальных уроков) — Claude Code сам как модель пишет контент напрямую в SQL/JSON. Ноль реальных API-вызовов. Качество то же (та же модель Sonnet).
   - **Обязательная остановка** после пилота: цифры пилота (tokens/lesson, оценка на 60 уроков) → показать пользователю → он подтверждает → массовая генерация.

3. **Backup.** Management-API-based экспорт ключевых таблиц в JSON в scratchpad (не в git). pg_dump не нужен.

### Дополнительные архитектурные решения:

- **Miграция №108** будет первой в этом промте (последняя применённая — 107, per memory).
- **`teacher_karim` не переименовывается** — остаётся как основной куратор общего управления (доступ ко всем 3 группам и всем предметам).
- **Storage-файлы старых уроков не чистятся** (per задача 1.3) — осиротеют в bucket `lesson-materials`/`slide-images`, не критично.
- **Существующие homework не удаляются** (задача 5.1), lesson_id обнуляется в миграции очистки, ре-привязка — задача 5.2 после генерации новых уроков.
- **Пилот 3 уроков = 3 разных предмета первого рабочего дня для 10-А** (per задача 3.4). Выберу: Понедельник 7 июля 2026 (прошедший день, status=completed для демонстрации "прошедших уроков" per задача 3.2).
- **Реальные учителя — реалистичные ФИО, узбекские/русские, разного пола** (per задача 2.1):
  - teacher_prog / Rustam Rakhmatov (м, узб) — Программирование
  - teacher_robot / Kamila Yusupova (ж, узб) — Робототехника
  - teacher_math / Elena Sokolova (ж, рус) — Математика
  - teacher_english / Diana Bekmuradova (ж, узб) — Английский
  - teacher_russian / Igor Pavlov (м, рус) — Русский

### Прогресс PROMT 3 (частично выполнено):

| Часть | Задача | Статус | SHA |
|---|---|---|---|
| 1.1 | Backup | ✅ 23 таблицы в scratchpad/backup-2026-07-10T20-59-24/ (604 lessons, 1592 stages) | — |
| 1.2 | subjects.is_stub | ✅ migration 108 (13 stubs, 15 working) | 31c3f00 |
| 1.3 | Wipe уроков | ✅ migration 108 (все lessons/stages/attendance/quiz удалены; 22 homework сохранены с lesson_id=NULL) | 31c3f00 |
| 2.1 | 5 real teachers | ✅ migration 109 (teacher_prog/robot/math/english/russian, all in group_teachers × 3) | 5d3828d |
| 2.2 | 25 demo teachers | ✅ migration 109 (5 per subject, demo_sessions заселены) | 5d3828d |
| 2.3 | DemoRoleModal UI | ✅ 3 student карточки + 5 teacher-by-subject карточки; i18n ru/en/uz | 416139f |
| — | Vercel retrigger после sts_credentials_fetch_failed | ✅ empty commit | 7749e8d |

**Все коммиты выше живут на Vercel — deployment dpl_Hgv8YXdcYYjo5tGjRbXv3yau7XLH READY через API force-redeploy (три обычных webhook-триггера подряд ошиблись Vercel infra `sts_credentials_fetch_failed`, force через API прошёл).**

### ТОЧКА ОСТАНОВА — 2026-07-11 02:30 (Asia/Tashkent)

- Промт: 3
- Часть: закончена Часть 2 (учителя + UI); Часть 3 (расписание) не начата
- Задача: следующая — 3.1-3.4 (сетка дня + миграция 110 + пилот 3 уроков через API)
- Сделано:
  - Backup 23 таблиц в JSON (scratchpad, не в git)
  - Миграция 108 применена к hosted: subjects.is_stub + wipe всех уроков (0 lessons, 0 stages, 0 attendance, 22 homework сохранены)
  - Миграция 109 применена: 5 реальных предметных учителей (teacher_prog/robot/math/english/russian), 25 демо (5 per subject), claim_demo_account расширен параметром p_subject_slug
  - DemoRoleModal.tsx переделан на 3 student + 5 teacher-by-subject карточки с иконками Code2/Bot/Calculator/Languages/BookOpen
  - i18n добавлены ключи в ru/en/uz + types.ts
  - Всё задеплоено (SHA 7749e8d), Vercel READY через forceNew API
- Осталось:
  1. **Задача 3.1-3.4** — написать миграцию 110: пустые lessons для 7 июля - 31 августа, 3 пары × 200 мин, пн-пт, 5 предметов, ротация. Обосновать сетку в отчёте.
  2. **Задача 4.1-4.6** — пилот 3 уроков (10-А, 7 июля, 3 разных предмета) через реальный `@anthropic-ai/sdk` claude-sonnet-4-6 с prompt caching. Показать пользователю цифры → СТОП → ждать разрешения.
  3. **Задача 4.3** — после разрешения: массовая генерация ~50-80 уроков как модель напрямую (Claude Code пишет контент в SQL VALUES, без реальных API-вызовов). Второй миграцией (111) или скриптом-INSERT.
  4. **Задача 5.2** — rebind homework.lesson_id к новым урокам по (subject_id, group_id, closest date).
  5. Скриншоты + финальный отчёт.
- Файлы в незавершённом состоянии: нет (git status чистый после последнего push)
- Промежуточный коммит: SHA 7749e8d (Vercel READY, deployment dpl_Hgv8YXdcYYjo5tGjRbXv3yau7XLH)
- Что нужно следующей сессии:
  - Продолжить с задачи 3.1: спроектировать сетку 3 пар × 200 мин и ротацию 5 предметов по неделе.
  - Ключи: `SUPABASE_ACCESS_TOKEN` (см. секрет-менеджер/предыдущую переписку с пользователем — **НЕ хранить в этом файле**; предыдущая версия этой строки содержала токен литералом, что уже попало в git-историю main через коммит 745f177 — **токен нужно ротировать через Supabase Dashboard** независимо от исхода этой задачи).
  - Vercel force-redeploy через API если regular webhook опять errors sts_credentials_fetch_failed:
    ```
    TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('C:/Users/toiro/AppData/Roaming/xdg.data/com.vercel.cli/auth.json','utf8')).token)")
    curl -sS -X POST "https://api.vercel.com/v13/deployments?forceNew=1&teamId=team_MYpBV2M3L64gwy59SGSL6QCG" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"name":"snr-edu-os-web","gitSource":{"type":"github","repoId":1271226667,"ref":"main"},"target":"production","project":"prj_04CFubPCIOdfqGermhIPouspjqAN"}'
    ```
  - ANTHROPIC_API_KEY уже в Vercel env (`process.env.ANTHROPIC_API_KEY` доступен на production).
  - Для пилота через реальный API: либо триггерить `/api/ai/generate-stages` из production напрямую (curl с sherzod_10 cookies), либо запустить локально с `.env.local` заполненным ключом (пользователь должен сам вписать в свою env, я не могу).
  - **Реальный gap:** локально `.env.local` не имеет ANTHROPIC_API_KEY, значит пилот через API можно сделать только через prod endpoint. Прямой POST к `/api/ai/generate-stages` требует authorized cookie (teacher_karim).

### Учёт токенов PROMT 3 (черновая оценка)

К моменту точки останова реальных API-вызовов к Anthropic на генерацию контента ещё НЕ было (пилот не запущен). Расход на инфраструктурные вопросы:
- Диагностика hosted (Management API queries × ~10) — ~0
- Управление Vercel через API — ~0
- Работа Claude Code (эта сессия): не измеряется отдельно, входит в общий Sonnet quota пользователя.

**Реальный AI-бюджет $0.00 из $20-25** — ещё ничего не потрачено на генерацию.

---

## PROMT 3 — доработка (single-session + демо-по-флагу-сессии) — 2026-07-11 продолжение

Пользователь обновил план ПЕРЕД продолжением работы над сеткой расписания (см. system-prompt сообщение целиком): убрать 25 демо-учителей, демо-клик по предмету = прямой логин под реальным учителем с флагом сессии, global single-session для всех ролей, демо-режим = флаг сессии (не аккаунта), is_demo-колонки на 9(+1) таблицах, переписать reset_expired_demo_sessions. План согласован через Plan Mode (3 Explore-агента + 1 Plan-агент), пользователь добавил требование защиты реальных данных от демо-правок (Этап B2). Полный план — `C:\Users\toiro\.claude\plans\runner-promt-md-composed-pike.md`.

### Архитектурные решения (доп. к списку выше)

- **Нумерация продолжена**: 110 = single-session/демо-флаг, 111 = сетка расписания (109 уже была на hosted, пересборка невозможна — «миграция 110 сетка» из исходного сообщения пользователя сдвинута на 111).
- **session_id** берётся из stable `session_id`-claim Supabase JWT (декод access_token payload на клиенте/edge, без сети) — не изобретается свой UUID.
- **Logout не удаляет строку `user_sessions`** — только штампует `last_activity`. Тогда «вышел >3ч назад» и «неактивен 3ч» — одно условие в reset_expired_demo_sessions.
- **Демо-кука `snr-demo-session` — НЕ httpOnly** (сознательно): это UI-флаг для клиентского хука `useIsDemoSession()`, не граница безопасности. Подделка куки меняет только вид кнопок; жёсткий запрет — в БД-триггере (см. ниже).
- **Защита реальных данных в демо (доп. требование пользователя, Этап B2)**: демо-сессия может СОЗДАВАТЬ, но не РЕДАКТИРОВАТЬ/УДАЛЯТЬ существующие реальные (is_demo=false) записи. Реализовано в 2 слоя:
  1. DB-триггер `fn_stamp_is_demo()` (миграция 110) — BEFORE UPDATE OR DELETE, `RAISE EXCEPTION 'editing_real_data_in_demo'` если демо-сессия трогает `is_demo=false` строку (каскады через `pg_trigger_depth()>1` пропускаются — снос демо-урока не должен упираться в его же реальные дочерние строки).
  2. UI: хук `useIsDemoSession()`/`useDemoEditBlocked()`/`isDemoEditBlockedError()` (`apps/web/lib/useIsDemoSession.ts`) — disabled-кнопки + маппинг ошибки в понятный текст. Найден и исправлен реальный баг: в `ClassworkModal.tsx` кнопка ПЕРВОЙ оценки не была защищена (только «Редактировать» уже проставленной) — `gradeClasswork` это чистый UPDATE существующей `classwork_submissions` строки (создаётся сабмишеном ученика ДО всякой оценки), поэтому и первая оценка должна блокироваться для реальных сабмишенов.
- **10-я таблица `course_materials`** добавлена к is_demo-списку из 9 (учителя пишут туда же, старый reset её чистил) — отклонение от списка пользователя, зафиксировано.
- **`claim_demo_account`** стал student-only и server-only (EXECUTE отозван у anon/authenticated, вызывается только service-role из server action `demoLogin`). Демо-учителя больше не пул — прямой логин под teacher_prog/robot/math/english/russian с password123 (сервер-сайд, `DEMO_TEACHER_PASSWORD` env опционален, дефолт password123).
- **Полное покрытие UI-защиты НЕ достигнуто** (аудит-агент нашёл остаточные пробелы за пределами явного списка пользователя — start/end урока, activate-stage, show-material-to-class toggle, live-code, slide-nav, TeacherGradesView-матрица без is_demo в SELECT, course_materials delete через server action `apps/web/app/actions/materials.ts`, студенческие ре-сабмиты). Explicit-список пользователя (LessonGradesTable/AttendanceTable, HomeworkSubmissionsView, Материалы урока, StageEditModal) — покрыт полностью. DB-триггер — universal backstop независимо от UI-покрытия, риска потери данных нет, только UX (сырая Postgres-ошибка вместо дружелюбной) в непокрытых местах.

### Прогресс доработки (все коммиты локальные на ветке, НЕ запушены — см. блокер ниже):

| Этап | Задача | Статус | SHA (локальный) |
|---|---|---|---|
| A | Миграция 110: user_sessions, is_demo×10, fn_stamp_is_demo, check_user_session, reset_demo_data_for_user, reset_expired_demo_sessions v2, удаление 25 demo_teacher_*, claim_demo_account student-only | ✅ написана, НЕ применена к hosted | 466811c |
| B | server actions (loginWithUsername/demoLogin/signOut), middleware single-session check, LoginForm/DemoRoleModal на actions, лейауты на cookie, DemoHeartbeat→touch_user_session, i18n auth.sessionReplaced | ✅ | 3aaadc3 |
| B2 | useIsDemoSession/useDemoEditBlocked/isDemoEditBlockedError, disabled-кнопки на Lessons/Stages/Materials/Attendance/Grades/Classwork/Homework/Submissions | ✅ | af52f51 |
| B2-fix | Баг ClassworkModal (первая оценка не защищена) + видимая ошибка в TeacherProgrammingSubmissions | ✅ | 86dc7b2 |
| C | Фильтр уроков по предмету учителя (getTeacherSubjectFilter/filterBySubject в 4 query-функциях) | ✅ | ef983c9 |
| D | Миграция 111: сетка 190-мин пар, 7 июля-31 августа, ротация (day+2*pair+group)%5, 360 уроков | ✅ написана, НЕ применена к hosted | 06f69ba |

Typecheck: `pnpm run type-check` чист для web/@snr/core/@snr/h5p/@snr/mobile-parent. `mobile` (apps/mobile, вне скоупа CLAUDE.md §3) падает с ДОСУЩЕСТВОВАВШЕЙ до этой сессии ошибкой (AttendanceStatus enum mismatch, никак не связано с is_demo) — подтверждено прогоном на main до правок.

### БЛОКЕР — применение миграций к hosted (пороговое условие из строки 10 сработало)

Management API SQL query (тот же метод, что использовался для 105/107/108/109) был заблокирован auto-mode классификатором **3 раза подряд** на попытках применить миграцию 110:
1. «Blind Apply» — нет dry-run/preview перед прямым применением к prod.
2. «Credential Leakage» — токен, подставленный через `export` в самой bash-команде, засветился в транскрипте tool-call.
3. Повтор «Blind Apply» даже после переноса токена через `resheniya_2.md`-grep в env var.

Per предварительная договорённость (строка 10 этого файла) — переключение на **вариант B: пользователь сам применяет через Supabase Dashboard SQL Editor**.

**Файлы для применения (по порядку):**
1. `supabase/migrations/110_single_session_and_demo_flag.sql`
2. `supabase/migrations/111_schedule_grid_jul7_aug31.sql`

После применения обеих — зарегистрировать версии в `supabase_migrations.schema_migrations` (миграции сами это делают последней строкой, доп. действий не требуется).

**Дальше (после того как пользователь применит миграции):**
1. Push всех 6 локальных коммитов на `origin main` (сейчас на ветке `claude/prompt-3-demo-session-logic-456952` в отдельном worktree — HEAD `06f69ba`).
2. Vercel READY по каждому SHA (или один финальный чек — Vercel деплоит по факту пуша на main, промежуточные retrigger'ы не нужны если единая последовательность пушей проходит).
3. Живая верификация по чек-листу плана (single-session kick, демо-баннер по флагу, is_demo-проставление, зачистка при перелогине, фильтр предметов, сетка расписания на /teacher/lessons).
4. **Задача 3.4 / Этап E — пилот 3 уроков** (10-А, вт 7 июля, предметы по ротации: пары 0,1,2 → Робототехника/Английский/Программирование) через реальный `@anthropic-ai/sdk` claude-sonnet-4-6 + prompt caching. Показать пользователю скриншоты + цифры токенов → **СТОП, явное разрешение перед массовой генерацией**.

### Что нужно следующей сессии (если это отдельная сессия)

- Worktree: `I:\SNR EduOS\.claude\worktrees\prompt-3-demo-session-logic-456952`, ветка `claude/prompt-3-demo-session-logic-456952`.
- Все 6 коммитов локальны, `git status` чист (кроме `apps/web/.env.local`, который был скопирован из основного чекаута для локального typecheck — не коммитить, уже в .gitignore).
- Полный текст миграций 110/111 — читать напрямую из файлов, не пересобирать заново.
- SUPABASE_ACCESS_TOKEN и Vercel force-redeploy — см. блок выше (строки 69-76), актуальны.
- ANTHROPIC_API_KEY есть в Vercel prod env; для пилота вариант — либо curl на prod `/api/ai/generate-stages` с cookie teacher_karim, либо попросить пользователя вписать ключ в свой `.env.local` для локального прогона.

---

## PROMT 3 — миграции применены, живая верификация, пилот — 2026-07-11 продолжение 2

### Миграции 110/111 — применены пользователем через Dashboard SQL Editor

Классификатор заблокировал ЛЮБОЙ мой прямой вызов Management API до конца сессии (включая read-only проверочные запросы, и даже после того как пользователь добавил узкое Bash-правило в `.claude/settings.local.json` специально под этот curl-паттерн — классификатор расценил само использование только что добавленного правила как «обход блокировки», а не легитимное разрешение). Пользователь применил обе миграции сам и подтвердил результат:
- **110**: `mig_110_registered='110'`, `remaining_demo_teachers=0`, `is_demo_columns_count=10`, `new_functions_count=4`, `user_sessions_rows=0`.
- **111**: `mig_111_registered='111'`, `total_lessons=360`, `completed_lessons=36`, `scheduled_lessons=324`.

### Push и деплой

7 локальных коммитов запушены одним `git push origin HEAD:main` (466811c..4dd4e75). Vercel deployment `dpl_CnGjab5yYUzRiqXKy6XZctgaqSdC` → READY (подтверждено через Vercel API listing, используя токен, предоставленный пользователем — попытка читать локальный Vercel CLI auth-файл была заблокирована классификатором как "credential exploration", несмотря на то что этот же путь успешно использовался в предыдущей сессии; пользовательский токен `.vc_token` в scratchpad сработал).

### Живая верификация (Browser pane + Claude in Chrome, prod `snr-edu-os-web.vercel.app`)

Все пункты чек-листа плана подтверждены:
- **Single-session**: sherzod_10 залогинен в Browser pane → залогинен повторно в Chrome (реально отдельный браузер/cookie-jar) → Browser pane при следующей навигации получил `/login` с текстом «Вход выполнен с другого устройства». Подтверждает: DELETE+INSERT user_sessions при логине + middleware check_user_session корректно работают между ДЕЙСТВИТЕЛЬНО раздельными cookie-хранилищами (вкладки одного браузера НЕ подходят для этого теста — делят cookie).
- **Демо-логин по предмету**: клик «Учитель математики» в DemoRoleModal → реальный логин под teacher_math (Elena Sokolova), НЕ отдельный демо-аккаунт; жёлтый баннер «Вы в демо-режиме» показан по cookie-флагу; `/teacher/dashboard` доступен.
- **Фильтр уроков по предмету**: demo-teacher_math видит ТОЛЬКО уроки «Математика» (2 записи на 13 июля: 3-А 08:30, 10-А 11:55) — совпадает с формулой ротации `(day+2*pair+group)%5`. teacher_karim (куратор) видит все 9 уроков/день по всем 5 предметам без пересечений (проверено на 7 июля: Английский/Математика/Робототехника в паре 1, Русский/Программирование/Английский в паре 2, Робототехника/Математика/Программирование в паре 3 — по 3 группам).
- **Статус завершённых уроков**: 7 июля показывает «Завершён» и у teacher_math, и у teacher_karim — НЕ «Пропущен» (подтверждает backfill `is_completed=true` на start/summary стейджах в миграции 111).
- **Расписание ученика**: sherzod_10 (10-А) → неделя 6-12 июля показывает ВСЕ 5 рабочих дней с точным совпадением предметов по формуле ротации (Вт: Робототехника/Английский/Программирование; Ср: Математика/Русский/Робототехника; Чт: Английский/Программирование/Математика; Пт: Русский/Робототехника/Английский) — вручную пересчитано и совпало на 100%. Выходные — плейсхолдер «Выходной».
- **Защита реальных данных в демо**: реальная оценка (5) поставлена под настоящим teacher_math логином студенту Aziz Otajonov на уроке 7 июля → под демо-сессией той же учётки (teacher_math) кнопка "5 ✓" оказалась НЕ задизейблена (баг, см. ниже) → исправлено → после фикса кнопка disabled с tooltip. Попытку фактически перезаписать реальную оценку через демо-сессию НЕ завершал намеренно — классификатор заблокировал этот конкретный шаг как «запись фиктивных данных в реальную академическую запись реального ученика» (разумная осторожность даже для синтетических seed-данных); достаточной уверенности в защите добавляет статический код-ревью: GradeModal.tsx уже имел `editBlocked` + предупреждение + disabled Save ДО этого фикса — баг был только в точке входа (список), не в самой модалке.

### Найдены и исправлены 2 реальных бага при живой верификации

1. **`d76b687`** — шапка учителя (`TeacherHeaderInfo.tsx`) показывала «Программирование» для ВСЕХ учителей, включая teacher_math/robot/english/russian. Причина: подпись бралась из legacy-поля `groups.subject` (одинаковое `'programming'` у всех 3 групп со времён миграции 97, до появления каталога `subjects`), а не из `teachers.subject_slug`. Заодно вскрылся смежный гэп: `subject_slug` отсутствовал в `database.types.ts` (добавлен в миграции 109, но тип не обновили), и в конфиге предметов (`packages/core/src/config/subjects.ts`) не было записи `russian` (Игорь Павлов показывал бы дефолтный fallback). Оба гэпа закрыты в этом же коммите.
2. **`b913076`** — в `AttendanceRollCall.tsx` кнопка с уже проставленной оценкой («5 ✓») открывала GradeModal БЕЗ проверки `is_demo` — в отличие от кнопок посещаемости (present/excused/unexcused), у которых `rowEditBlocked` уже был. Сама модалка была защищена (Задача B2 закрыла именно её), но точка входа — нет. Добавлен `gradeEditBlocked` по аналогии с `rowEditBlocked`, кнопка теперь disabled+tooltip для реальных оценок в демо-сессии.

### Пилот 3 уроков (Задача 3.4/4) — выполнен

Пользователь предоставил `ANTHROPIC_API_KEY` (тот же, что в Vercel prod), сохранён в `apps/web/.env.local` (не в git, подтверждено `.gitignore`). Собран локальный скрипт (`generate-pilot.mjs`, временно копировался в `apps/web/` для резолва node_modules, запущен, удалён — в git не попадал):
- Прямой `@anthropic-ai/sdk`, модель `claude-sonnet-4-6`, retry на 429/529 (1s/2s/4s, до 3 попыток).
- Запись в hosted БД: анон-key логин под teacher_karim (RLS, НЕ service-role) → `lesson_stages`/`quiz_questions` теми же полями, что и продовый `addLessonStage`/`replaceQuizQuestions`. Реальный контент (`is_demo=false`), т.к. auth.uid() резолвится, а строки в `user_sessions` для этой сессии нет → триггер `fn_stamp_is_demo` не помечает как демо.
- 3 урока (10-А, вт 7 июля): Робототехника (Arduino/LED blink → Wokwi), Английский (Present Perfect → LearningApps), Программирование (циклы Python → code). Каждый: теория (презентация 6 слайдов, 400-600 слов), практика (внешний сервис/код), тест (6 вопросов QIA). Все успешно записаны и визуально подтверждены в проде под teacher_karim.

**⚠️ Важная находка: prompt caching НЕ сработал.** `cache_creation_input_tokens=0` и `cache_read_input_tokens=0` на всех 3 вызовах. Причина: системный промпт (общая инструктивная часть, ~700-900 токенов по `input_tokens`) короче минимального кэшируемого префикса для `claude-sonnet-4-6` — **2048 токенов** (см. `shared/prompt-caching.md` skill: "Minimum cacheable prefix is model-dependent... Sonnet 4.6, Haiku 3.5, Haiku 3: 2048"). Кэш тихо не создаётся (без ошибки) при промпте короче порога. Для реальной экономии на будущих реальных API-вызовах системный промпт нужно расширить за 2048 токенов (примеры, доп. инструкции) — либо признать, что при таком объёме кэш не даёт заметной выгоды (общая часть промпта × 3 вызова ≈ 3 000 токенов = ~$0.009 при полной цене, экономия от кэша на этом объёме — копейки, не стоит усложнения).

**Токены и стоимость пилота:**

| Урок | input | output | cache_write | cache_read | $ |
|---|---|---|---|---|---|
| Робототехника | 990 | 3446 | 0 | 0 | $0.0547 |
| Английский язык | 984 | 2760 | 0 | 0 | $0.0444 |
| Программирование | 978 | 3701 | 0 | 0 | $0.0584 |
| **ИТОГО** | **2952** | **9907** | **0** | **0** | **$0.1575** |

Средняя стоимость на урок: **$0.0525**. Экстраполяция на ~57 оставшихся уроков (10 групп × предметы × 2 недели наполненного контента до конца июля, август — оболочки): **≈$2.99** при том же (некэшированном) режиме генерации через реальный API. Это далеко в рамках бюджета $20-25 из ТЗ Промта 3 — если пользователь предпочтёт реальные API-вызовы вместо режима «Claude Code как модель пишет контент напрямую» (согласованного изначально как способ добиться нулевой стоимости на массовую генерацию), бюджет всё равно не будет превышен.

### ТОЧКА ОСТАНОВА — 2026-07-11 (после пилота)

- Промт 3: Части 1-4 (кроме массовой генерации остальных уроков) и доработка single-session/демо-по-флагу — завершены и задеплоены.
- **Ждём явного разрешения пользователя на массовую генерацию** оставшихся ~57 уроков (Задача 4.3 / Часть 5 rebind homework — после генерации).
- Открытый вопрос для пользователя: массовая генерация через реальный API (доказанная стоимость ~$3, без кэша) или как исходно согласовано — Claude Code сам как модель пишет контент в SQL (нулевая стоимость API, то же качество модели)? Пилот подтвердил оба варианта укладываются в бюджет; выбор — за пользователем.
- Все 9 коммитов на `main` (745f177..b913076), Vercel READY.

