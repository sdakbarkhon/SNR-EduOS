-- =====================================================================
-- Migration 114 — отдельный промт "выходные": заполнить 4 выходных дня,
-- пропущенных миграцией 111 (skip ISODOW 6/7): 11, 12, 18, 19 июля 2026.
--
-- Та же сетка/ротация, что 111_schedule_grid_jul7_aug31.sql:
--   3 пары по 190 мин (08:30–11:40, 11:55–15:05, 15:20–18:30, +05),
--   subject_idx(day, pair, group) = (d + 2*pair + group) mod 5,
--   d = ISODOW-1 (суббота ISODOW=6 → d=5; воскресенье ISODOW=7 → d=6).
--
-- 11-12 июля — status='completed' (+ started_at/ended_at, стейджи
-- start/summary is_completed=true); 18-19 июля — 'scheduled'. Все
-- is_demo=false (auth.uid() NULL в контексте миграции — тот же путь,
-- что 111). Идемпотентность: NOT EXISTS по (group_id, starts_at).
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
  v_dates CONSTANT date[4] := ARRAY[
    DATE '2026-07-11', DATE '2026-07-12', DATE '2026-07-18', DATE '2026-07-19'
  ];
  v_group_ids uuid[];
  v_date date;
  v_dow int;
  v_day int;
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
    RAISE EXCEPTION 'weekend lessons: one of the 3 groups not found by name';
  END IF;

  FOREACH v_date IN ARRAY v_dates LOOP
    v_dow := EXTRACT(ISODOW FROM v_date)::int;
    IF v_dow NOT IN (6, 7) THEN
      RAISE EXCEPTION 'weekend lessons: % is not a Saturday/Sunday (ISODOW=%)', v_date, v_dow;
    END IF;
    v_day := v_dow - 1; -- суббота=5, воскресенье=6
    v_status := CASE WHEN v_date <= DATE '2026-07-12' THEN 'completed' ELSE 'scheduled' END;

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
            RAISE EXCEPTION 'weekend lessons: subject % not found for group %',
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
  END LOOP;

  RAISE NOTICE 'weekend lessons: inserted=%, skipped(existing)=%', v_inserted, v_skipped;
END $$;

-- ── Регистрация ───────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('114')
ON CONFLICT (version) DO NOTHING;

COMMIT;
