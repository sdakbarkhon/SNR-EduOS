-- 179, 08.08.2026 — снимок эталона демо-школы.
--
-- Зачем. Демо-посетители за день добавляют уроки, этапы и материалы через
-- интерфейс, к утру демо выглядит захламлённым. Ночной откат теперь должен
-- удалять добавленное, а не только чинить форму уроков (крон
-- restore-demo-lesson-shape).
--
-- ПОЧЕМУ СНИМОК, А НЕ ДАТА СОЗДАНИЯ. Отличать добавленное по created_at
-- нельзя, проверено на живых данных: эталон создавался ДВУМЯ заходами
-- (29.07 и 30.07), а в окне 05-08.08 вперемешку лежат и ручные проверки
-- посетителей, и наша плановая работа (этапы «Визуализация алгоритма» и
-- Kahoot из коммита 856f445). По метке времени они неотличимы — отсечка по
-- дате снесла бы плановое вместе с мусором.
--
-- Флаг-колонку на каждой таблице тоже не заводим: это четыре ALTER TABLE на
-- живых таблицах ради вспомогательного признака, который нужен ровно одной
-- школе. Отдельная таблица идентификаторов ничего не весит и не трогает
-- существующие схемы.
--
-- Наполняется скриптом scripts/snapshot-demo-baseline.mjs с уже вычищенного
-- состояния. Пересниматься должна после каждого планового пополнения демо —
-- иначе ночной откат сотрёт новое как чужое.

BEGIN;

CREATE TABLE IF NOT EXISTS public.demo_baseline (
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  taken_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_baseline_pkey PRIMARY KEY (entity_type, entity_id),
  CONSTRAINT demo_baseline_entity_type_check CHECK (
    entity_type = ANY (ARRAY['lesson', 'lesson_stage', 'lesson_material', 'homework']::text[])
  )
);

-- Поиск идёт «что из школы НЕ входит в снимок» — индекс по школе и типу.
CREATE INDEX IF NOT EXISTS demo_baseline_school_type_idx
  ON public.demo_baseline (school_id, entity_type);

-- Таблица служебная: читает и пишет только service-role (ночной откат и
-- скрипт снятия снимка). RLS включён без единой политики — значит для
-- обычных ролей она закрыта полностью, а service-role RLS обходит.
ALTER TABLE public.demo_baseline ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── После применения — наполнить снимок: ────────────────────────────────
--   node scripts/snapshot-demo-baseline.mjs --apply
--   Ожидание на 08.08.2026: 126 уроков, 772 этапа, 261 материал, 61 ДЗ.
