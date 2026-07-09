-- =====================================================================
-- Migration 107 — homework.subject_id
--
-- Student homework/lesson header showed the group's placeholder subject
-- ('groups.subject', a leftover artefact — every group's value is the
-- literal string 'programming' since Этап 1's reset) instead of the real
-- subject. Lessons already resolve their subject correctly via
-- lessons.subject_id → subjects.name (Этап 2, "предметы по классам") —
-- homework never got the equivalent column, so its header always fell
-- back to the broken group placeholder regardless of the homework's
-- actual subject.
--
-- homework.lesson_id exists but is NULL for all 22 current homework rows
-- (AI-generated homework isn't lesson-linked in practice), so a
-- lesson_id → subject_id join isn't a usable fallback. A group also
-- teaches 5 different subjects (Программирование/Робототехника/
-- Математика/Английский язык/Русский язык), so falling back to "any
-- subject row for this group_id" would be arbitrary, not correct.
--
-- Adds a direct subject_id FK and backfills the 22 existing rows by
-- matching each homework's title/content_type against its group's real
-- subjects (verified by hand against the actual title text — see
-- resheniya.md for the full per-row mapping table). New homework created
-- after this migration will have subject_id = NULL until the teacher
-- creation form is extended with a subject picker (out of scope here —
-- teacher-side UI was explicitly excluded from this task).
-- =====================================================================

ALTER TABLE public.homework
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

-- 3-А класс (group 05730827-d2fd-4345-b6e8-7d583456202f)
UPDATE public.homework SET subject_id = 'b58bdc96-9318-4d8c-a457-7fffe6b82c1f' WHERE id = 'ccf6d7f4-420c-43e1-b8c4-99b8627d0d74'; -- Мигающий светофор на Wokwi → Робототехника
UPDATE public.homework SET subject_id = '8acabe59-d7e2-4b9d-8728-eed4fcc5f004' WHERE id = 'c671d01b-82dd-4e70-a17b-d5ae3d4055cc'; -- Мини-проект: веб-страничка и лабиринт → Программирование
UPDATE public.homework SET subject_id = '8acabe59-d7e2-4b9d-8728-eed4fcc5f004' WHERE id = '77264fb4-534b-41c4-a4c6-4c962eb2fbd3'; -- Переменные-помощники (python) → Программирование
UPDATE public.homework SET subject_id = '2ba0f5c3-d577-47f1-a626-5d22dc0a69c2' WHERE id = 'c28fb8d3-db0a-49af-bf44-227aed0b7f9e'; -- Периметр и площадь в GeoGebra → Математика
UPDATE public.homework SET subject_id = 'd5a64b7c-9a4a-4450-afb3-3f4228d8253e' WHERE id = 'faf9e9a8-3645-4d06-a2ca-655aa2b4f03d'; -- Тест: Animals and Numbers → Английский язык
UPDATE public.homework SET subject_id = '8acabe59-d7e2-4b9d-8728-eed4fcc5f004' WHERE id = 'aa827f97-0731-4bd0-ae37-8871cc33bde0'; -- Циклы в JavaScript: лесенка → Программирование
UPDATE public.homework SET subject_id = '7bfa121e-2dae-4f78-a8c8-51351e81f66b' WHERE id = '1483c626-7343-48e6-8f7b-7b7518ce02df'; -- Части речи и словарные слова → Русский язык

-- 7-А класс (group 3ca98359-d4ee-446e-8816-835af6c5dd47)
UPDATE public.homework SET subject_id = '358fe402-7644-4845-a01a-a8dcb070e486' WHERE id = 'c75eaec3-76a1-4aa8-9e15-833f3e02c003'; -- Desmos: графики линейных функций → Математика
UPDATE public.homework SET subject_id = '9dfb3946-b511-47cd-b3cf-c8700428b8da' WHERE id = 'e0198fdf-a220-4ddd-bffc-afed74317d2d'; -- Project: My Summer Holidays → Английский язык
UPDATE public.homework SET subject_id = '16f9acae-0028-4706-bd44-ba2487cc2132' WHERE id = 'c60a703c-59ca-4d1b-b2ee-eefde73a8035'; -- Wokwi: мигающий светодиод на Arduino → Робототехника
UPDATE public.homework SET subject_id = 'e6005282-fd9f-4ca3-8402-e9d43eb8032c' WHERE id = 'd62582bd-7a79-4d78-8090-4649fdc1712d'; -- Переменные в Python → Программирование
UPDATE public.homework SET subject_id = '39f0a708-c48d-46e9-afa8-1d79b67eaea6' WHERE id = '0ea27be6-bd97-46b6-b331-e1544b279eb3'; -- Проект «Лето в моём городе» → Русский язык
UPDATE public.homework SET subject_id = '358fe402-7644-4845-a01a-a8dcb070e486' WHERE id = '7f77e49e-984e-4446-8027-ad2b95fe90d1'; -- Тест: проценты и пропорции → Математика
UPDATE public.homework SET subject_id = 'e6005282-fd9f-4ca3-8402-e9d43eb8032c' WHERE id = '40d13f4d-26da-43b8-9be3-ff5427014b34'; -- Циклы в JavaScript: таблица умножения → Программирование

-- 10-А класс (group 9afc95f3-e5e7-4882-a224-37cf58dc5c3b)
UPDATE public.homework SET subject_id = 'd42b30b1-1b1b-4037-af0f-1e585c2fccee' WHERE id = '79d4fced-b101-4fd0-b7e6-503b7dbd6bd3'; -- "123" (Wokwi) → Робототехника
UPDATE public.homework SET subject_id = '64468022-4af9-4edb-9cdd-cd38fd674271' WHERE id = 'e7a65418-4c73-420a-9ac2-7510e208e628'; -- Present Perfect vs Past Simple → Английский язык
UPDATE public.homework SET subject_id = '9dd3ea29-6681-46b7-a720-ec7f2a184df1' WHERE id = '0e35b152-491e-4a26-9ded-e6543531d88d'; -- График y=A·sin(kx+φ) в GeoGebra → Математика
UPDATE public.homework SET subject_id = 'ee02d23d-0219-4641-b17a-bb04ab990139' WHERE id = '856d30ac-da44-4002-bba9-e9e4e8cf066e'; -- Летнее чтение → Русский язык
UPDATE public.homework SET subject_id = '9dd3ea29-6681-46b7-a720-ec7f2a184df1' WHERE id = '5ad10ad1-09c2-452f-97f7-c6da7355fd73'; -- Прогрессии: арифметическая и геометрическая → Математика
UPDATE public.homework SET subject_id = 'd42b30b1-1b1b-4037-af0f-1e585c2fccee' WHERE id = 'f8af27ba-bf57-4441-83e3-35a01effd8f0'; -- Симуляция светофора на Arduino в Wokwi → Робототехника
UPDATE public.homework SET subject_id = '1ee6d208-8348-4db8-b8bc-f733987203af' WHERE id = 'eb547b38-5aa4-4e6c-8946-a8fe3b0d0771'; -- Сумма и количество чётных чисел (JS) → Программирование
UPDATE public.homework SET subject_id = '1ee6d208-8348-4db8-b8bc-f733987203af' WHERE id = 'cd4a5bc3-01be-421a-bb56-e3b804e40c0a'; -- Таблица умножения циклом for (Python) → Программирование
