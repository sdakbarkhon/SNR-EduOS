-- =====================================================================
-- Migration 111 — PROMT 3, Задача 3.1-3.4: сетка расписания.
--
-- Пустая сетка уроков на 7 июля – 31 августа 2026, только 5 рабочих
-- предметов (миграция 108 отфильтровала заглушки, 108 же вычистила все
-- старые lessons — на момент этой миграции их 0).
--
-- Сетка дня: 3 пары по 190 минут, пн-пт, 08:30–18:30 (+05 Asia/Tashkent):
--   08:30–11:40, 11:55–15:05, 15:20–18:30 (перемены по 15 мин).
--   3×190 + 2×15 = 600 мин = ровно 08:30→18:30. Из ТЗ "~200 минут" —
--   190 выбрано как единственное точное решение для равномерных пар.
--
-- Ротация предметов: subject_idx(day, pair, group) = (day+2*pair+group) mod 5,
-- day = ISODOW-1 (0=пн..4=пт), pair=0..2, group=0..2 (10-А,7-А,3-А).
-- Свойства (проверено): при фикс. (day,pair) три группы получают разные
-- offset'ы (0,1,2) → разные предметы → учитель никогда не задвоен в одном
-- слоте; при фикс. (group,day) три пары дают offset'ы (0,2,4) → 3 разных
-- предмета в день; при фикс. group каждый предмет выпадает ровно 3 раза в
-- неделю (5 предметов × 3 пары × 5 дней / 5 = 15 слотов/группу/неделю,
-- каждый предмет — 15/5=3). Учитель = 9 пар/неделю (3 группы × 3).
--
-- Период: 40 рабочих дней (вт 7 июля – пн 31 августа) × 3 пары × 3 группы
-- = 360 уроков. 7-10 июля (до "сегодня" 2026-07-11) — status='completed'
-- (+ started_at/ended_at, стейджи start/summary is_completed=true — иначе
-- teacher-UI покажет "Пропущен", getEffectiveStatus status-first). Остальные
-- 324 — 'scheduled'. Контент (стейджи/тесты) НЕ наполняется здесь — это
-- Задача 3.4 "пилот" отдельным шагом после разрешения пользователя.
--
-- Идемпотентность: NOT EXISTS по (group_id, starts_at), как в миграции 100.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';
  v_group_names CONSTANT text[3] := ARRAY['10-А класс', '7-А класс', '3-А класс'];
  v_subject_names CONSTANT text[5] := ARRAY[
    'Программирование', 'Робототехника', 'Математика', 'Английский язык', 'Русский язык'
  ];
  v_pair_times CONSTANT text[3] := ARRAY['08:30:00', '11:55:00', '15:20:00'];
  v_group_ids uuid[];
  v_date date;
  v_dow int;      -- ISODOW: 1=пн..7=вс
  v_day int;      -- 0=пн..4=пт
  v_p int;
  v_g int;
  v_subject_idx int;
  v_subject_id uuid;
  v_starts_at timestamptz;
  v_status text;
  v_room text;
  v_lesson_id uuid;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  v_group_ids := ARRAY[
    (SELECT id FROM public.groups WHERE name = v_group_names[1]),
    (SELECT id FROM public.groups WHERE name = v_group_names[2]),
    (SELECT id FROM public.groups WHERE name = v_group_names[3])
  ];
  IF v_group_ids[1] IS NULL OR v_group_ids[2] IS NULL OR v_group_ids[3] IS NULL THEN
    RAISE EXCEPTION 'schedule grid: one of the 3 groups not found by name';
  END IF;

  v_date := DATE '2026-07-07';
  WHILE v_date <= DATE '2026-08-31' LOOP
    v_dow := EXTRACT(ISODOW FROM v_date)::int;

    IF v_dow BETWEEN 1 AND 5 THEN
      v_day := v_dow - 1;
      v_status := CASE WHEN v_date < DATE '2026-07-11' THEN 'completed' ELSE 'scheduled' END;

      FOR v_p IN 0..2 LOOP
        FOR v_g IN 0..2 LOOP
          v_subject_idx := (v_day + 2 * v_p + v_g) % 5;
          v_starts_at := (v_date::text || ' ' || v_pair_times[v_p + 1] || '+05')::timestamptz;

          IF NOT EXISTS (
            SELECT 1 FROM public.lessons
            WHERE group_id = v_group_ids[v_g + 1] AND starts_at = v_starts_at
          ) THEN
            SELECT id INTO v_subject_id
            FROM public.subjects
            WHERE group_id = v_group_ids[v_g + 1] AND name = v_subject_names[v_subject_idx + 1];

            IF v_subject_id IS NULL THEN
              RAISE EXCEPTION 'schedule grid: subject % not found for group %',
                v_subject_names[v_subject_idx + 1], v_group_names[v_g + 1];
            END IF;

            v_room := 'Ауд. ' || (101 + floor(random() * 10))::int;

            INSERT INTO public.lessons (
              group_id, subject_id, topic, title, status,
              starts_at, duration_minutes, room, school_id,
              started_at, ended_at
            ) VALUES (
              v_group_ids[v_g + 1], v_subject_id,
              v_subject_names[v_subject_idx + 1], v_subject_names[v_subject_idx + 1],
              v_status, v_starts_at, 190, v_room, v_school_id,
              CASE WHEN v_status = 'completed' THEN v_starts_at ELSE NULL END,
              CASE WHEN v_status = 'completed' THEN v_starts_at + interval '190 minutes' ELSE NULL END
            )
            RETURNING id INTO v_lesson_id;

            -- trg_lesson_default_stages (AFTER INSERT, миграция 35) уже создал
            -- start+summary к этому моменту — для "прошедших" уроков сразу
            -- помечаем их пройденными (как fn_auto_start/end_lessons делают
            -- для реальных in_progress→completed переходов).
            IF v_status = 'completed' THEN
              UPDATE public.lesson_stages
              SET is_completed = true, completed_at = v_starts_at + interval '190 minutes'
              WHERE lesson_id = v_lesson_id AND stage_role IN ('start', 'summary');
            END IF;

            v_inserted := v_inserted + 1;
          ELSE
            v_skipped := v_skipped + 1;
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    v_date := v_date + 1;
  END LOOP;

  RAISE NOTICE 'schedule grid: inserted=%, skipped(existing)=%', v_inserted, v_skipped;
END $$;

-- ── Регистрация ───────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('111')
ON CONFLICT (version) DO NOTHING;

COMMIT;
