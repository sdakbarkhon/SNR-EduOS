-- 178, 08.08.2026 — вид материала «видео» в библиотеке.
--
-- teacher_library_materials.material_type — это ВИД материала, который
-- учитель выбирает при добавлении (сборник / конспект / план / учебник /
-- методичка / презентация, миграция 153). Видео-ролика среди них не было,
-- хотя загружать и прикреплять видео библиотека умеет с 92f2c00.
--
-- Значение хранится текстом, но под CHECK-ограничением, поэтому без миграции
-- новый вид просто отклонялся бы базой. Список плоский — как у content_type
-- в миграции 177, дополняем тем же способом.
--
-- Только библиотека и только этот столбец. У материалов группы
-- (course_materials) и урока/кафедры (lesson_materials) колонки material_type
-- нет вовсе — там вид материала не выбирается в принципе, и заводить его
-- заказчик не просил: им достаточно значка видео в списке, а он определяется
-- по content_type и расширению файла и миграции не требует.

ALTER TABLE public.teacher_library_materials
  DROP CONSTRAINT IF EXISTS teacher_library_materials_material_type_check;

ALTER TABLE public.teacher_library_materials
  ADD CONSTRAINT teacher_library_materials_material_type_check
  CHECK (
    material_type IS NULL
    OR material_type = ANY (ARRAY[
      'сборник', 'конспект', 'план', 'учебник', 'методичка', 'презентация', 'видео'
    ]::text[])
  );
