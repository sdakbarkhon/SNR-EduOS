-- =====================================================================
-- Migration 103 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.6: домашние задания — 7 на
-- группу (21 всего), разнообразие форматов (programming/test/external/
-- bundle), дедлайны распределены 10-25 июля. teacher_karim — автор всех.
-- Дефолтные ссылки сервисов подставлены из того же SERVICE_CONFIG, что и
-- этапы уроков (§5.6/§9).
-- =====================================================================
DO $$
DECLARE
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';
  v_teacher_id uuid;
  v_group_id uuid;
  v_hw_id uuid;
  v_q_id uuid;
  hw_data jsonb;
  q_item jsonb;
  opt_item jsonb;
  sub_item jsonb;
  idx int;
  opt_idx int;
BEGIN
  SELECT id INTO v_teacher_id FROM public.teachers WHERE username = 'teacher_karim';

  -- === 10-А класс (7 заданий) ===
  SELECT id INTO v_group_id FROM public.groups WHERE name = '10-А класс';
  IF NOT EXISTS (SELECT 1 FROM public.homework WHERE group_id = v_group_id AND source = 'curriculum') THEN
    FOR hw_data IN SELECT * FROM jsonb_array_elements('[{"title":"Таблица умножения с помощью цикла for","description":"Напиши программу на Python, которая с помощью цикла for выводит таблицу умножения для числа 7 (от 1 до 10) в формате «7 x 1 = 7». Закрепляем тему первой недели курса: переменные и цикл for.","subject":"Программирование","format":"programming","programmingLanguage":"python","starterCode":"n = 7  # число, для которого строим таблицу умножения\n\nfor i in range(1, 11):\n    # допиши вывод строки вида \"7 x 1 = 7\"\n    pass\n","expectedOutput":"7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70","due_date":"2026-07-10T18:00:00+05:00"},{"title":"Сумма и количество чётных чисел от 1 до 50","description":"Напиши программу на JavaScript, которая с помощью цикла while, переменных-счётчиков и условного оператора if находит сумму всех чётных чисел от 1 до 50 и их количество, а затем выводит оба результата в консоль.","subject":"Программирование","format":"programming","programmingLanguage":"javascript","starterCode":"let sum = 0;\nlet count = 0;\nlet i = 1;\n\nwhile (i <= 50) {\n  // допиши проверку чётности числа i и накопление суммы/счётчика\n  i++;\n}\n\nconsole.log(\"Сумма:\", sum);\nconsole.log(\"Количество:\", count);\n","expectedOutput":"Сумма: 650\nКоличество: 25","due_date":"2026-07-12T18:00:00+05:00"},{"title":"Прогрессии: арифметическая и геометрическая","description":"Проверь себя по теме «Арифметическая и геометрическая прогрессии»: 5 вопросов на формулу n-го члена, сумму первых n членов и сумму бесконечно убывающей геометрической прогрессии.","subject":"Математика","format":"test","testQuestions":[{"question":"Дана арифметическая прогрессия: a1 = 3, d = 4. Чему равен a5?","options":["15","19","23","17"],"correctIndex":1},{"question":"По какой формуле вычисляется сумма первых n членов арифметической прогрессии?","options":["Sn = n/2 · (a1 + an)","Sn = a1 · q^(n-1)","Sn = (a1 + an) · n","Sn = a1 + d · n"],"correctIndex":0},{"question":"В геометрической прогрессии b1 = 2, q = 3. Чему равен b4?","options":["24","54","18","162"],"correctIndex":1},{"question":"Как называется число q в геометрической прогрессии?","options":["разность","знаменатель","коэффициент","показатель"],"correctIndex":1},{"question":"По какой формуле вычисляется сумма бесконечно убывающей геометрической прогрессии при |q| < 1?","options":["S = a1 / (1 - q)","S = a1 · q","S = n/2 · (2a1 + (n-1)d)","S = a1 · (q^n - 1) / (q - 1)"],"correctIndex":0}],"due_date":"2026-07-15T18:00:00+05:00"},{"title":"Симуляция светофора на Arduino в Wokwi","description":"В онлайн-симуляторе Wokwi собери схему на Arduino Uno с тремя светодиодами (красный, жёлтый, зелёный) и напиши скетч, который циклично включает их в порядке работы светофора: красный — 5 секунд, жёлтый — 2 секунды, зелёный — 5 секунд. Ссылку на проект (Share → Copy link) прикрепи в качестве ответа.","subject":"Робототехника","format":"external","externalServiceType":"wokwi","due_date":"2026-07-17T18:00:00+05:00"},{"title":"Исследование графика y = A·sin(kx + φ) в GeoGebra","description":"В GeoGebra построй график функции y = A·sin(kx + φ) и добавь ползунки (sliders) для параметров A, k и φ. Меняя значения ползунков, определи, как каждый параметр влияет на амплитуду, период и сдвиг графика вдоль оси X. Сохрани минимум 3 скриншота с разными наборами параметров и подпиши свои выводы.","subject":"Математика","format":"external","externalServiceType":"geogebra","due_date":"2026-07-20T18:00:00+05:00"},{"title":"Present Perfect vs Past Simple: летние каникулы","description":"Комплексное задание на закрепление разницы между Present Perfect и Past Simple на примере рассказа о летних каникулах.","subject":"Английский язык","format":"bundle","bundleSubtasks":[{"type":"h5p","title":"Интерактивное упражнение на грамматику","description":"Пройди интерактивное упражнение H5P: выбери правильную форму глагола (Present Perfect или Past Simple) в 15 предложениях о летних событиях."},{"type":"file","title":"Эссе «My Summer So Far»","description":"Напиши эссе на 120-150 слов о том, как проходит твоё лето. Используй минимум 5 предложений в Past Simple и 3 предложения в Present Perfect. Прикрепи файл в формате .docx или .pdf."},{"type":"file","title":"Аудиозапись устного рассказа","description":"Запиши аудио на 1-2 минуты: расскажи, что ты уже успел сделать этим летом (Present Perfect) и что планируешь сделать до конца каникул. Прикрепи аудиофайл."}],"due_date":"2026-07-22T18:00:00+05:00"},{"title":"Летнее чтение: работа с произведением из списка на лето","description":"Комплексное задание по одному произведению из списка летнего чтения для 10 класса (на выбор ученика из списка, выданного в конце учебного года).","subject":"Русский язык","format":"bundle","bundleSubtasks":[{"type":"file","title":"Читательский дневник","description":"Заполни читательский дневник по прочитанному произведению: автор, год издания, главные герои, краткое содержание по главам/частям. Прикрепи файл в формате .docx или .pdf."},{"type":"h5p","title":"Тест на знание текста","description":"Пройди интерактивный тест H5P на знание сюжета, персонажей и ключевых эпизодов произведения."},{"type":"file","title":"Письменный анализ эпизода","description":"Напиши письменный анализ (200-250 слов) одного ключевого эпизода произведения: опиши его роль в сюжете и в раскрытии характера главного героя. Прикрепи файл."}],"due_date":"2026-07-25T18:00:00+05:00"}]'::jsonb)
    LOOP
      idx := 0;
      INSERT INTO public.homework (
        group_id, title, description, due_date, content_type, source, teacher_id, school_id,
        programming_language, starter_code, expected_output, external_url
      ) VALUES (
        v_group_id, hw_data->>'title', hw_data->>'description', (hw_data->>'due_date')::timestamptz,
        CASE hw_data->>'format'
          WHEN 'programming' THEN 'programming'
          WHEN 'test' THEN 'test'
          WHEN 'bundle' THEN 'bundle'
          WHEN 'external' THEN hw_data->>'externalServiceType'
          ELSE 'file'
        END,
        'curriculum', v_teacher_id, v_school_id,
        NULLIF(hw_data->>'programmingLanguage',''), NULLIF(hw_data->>'starterCode',''), NULLIF(hw_data->>'expectedOutput',''),
        CASE hw_data->>'format' WHEN 'external' THEN
          CASE hw_data->>'externalServiceType'
            WHEN 'wokwi' THEN 'https://wokwi.com/projects/new/arduino-uno'
            WHEN 'codesandbox' THEN 'https://codesandbox.io/p/sandbox/vanilla'
            WHEN 'geogebra' THEN 'https://www.geogebra.org/classic'
            WHEN 'phet' THEN 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html'
            WHEN 'desmos' THEN 'https://www.desmos.com/calculator'
            WHEN 'blockly_games' THEN 'https://blockly.games/'
            WHEN 'visualgo' THEN 'https://visualgo.net/en'
            WHEN 'p5js' THEN 'https://editor.p5js.org/'
            WHEN 'excalidraw' THEN 'https://excalidraw.com/'
            WHEN 'learningapps' THEN 'https://learningapps.org/'
            WHEN 'sqlonline' THEN 'https://sqlime.org/'
            WHEN 'h5p' THEN 'https://h5p.eduos.snruz.uz/library'
            ELSE NULL
          END
        ELSE NULL END
      )
      RETURNING id INTO v_hw_id;

      IF hw_data->>'format' = 'test' THEN
        FOR q_item IN SELECT * FROM jsonb_array_elements(hw_data->'testQuestions')
        LOOP
          idx := idx + 1;
          INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index, school_id)
          VALUES (v_hw_id, q_item->>'question', 'single_choice', idx, v_school_id)
          RETURNING id INTO v_q_id;

          opt_idx := 0;
          FOR opt_item IN SELECT * FROM jsonb_array_elements(q_item->'options')
          LOOP
            INSERT INTO public.test_question_options (question_id, option_text, is_correct, order_index, school_id)
            VALUES (v_q_id, opt_item#>>'{}', opt_idx = (q_item->>'correctIndex')::int, opt_idx, v_school_id);
            opt_idx := opt_idx + 1;
          END LOOP;
        END LOOP;
      END IF;

      IF hw_data->>'format' = 'bundle' THEN
        idx := 0;
        FOR sub_item IN SELECT * FROM jsonb_array_elements(hw_data->'bundleSubtasks')
        LOOP
          INSERT INTO public.homework_subtasks (homework_id, title, description, type, order_index, school_id)
          VALUES (v_hw_id, sub_item->>'title', sub_item->>'description', sub_item->>'type', idx, v_school_id);
          idx := idx + 1;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- === 7-А класс (7 заданий) ===
  SELECT id INTO v_group_id FROM public.groups WHERE name = '7-А класс';
  IF NOT EXISTS (SELECT 1 FROM public.homework WHERE group_id = v_group_id AND source = 'curriculum') THEN
    FOR hw_data IN SELECT * FROM jsonb_array_elements('[{"title":"Переменные в Python: периметр и площадь","description":"Допиши программу на Python, используя переменные, чтобы она вычисляла периметр и площадь прямоугольника по заданным сторонам и выводила результат в консоль. Закрепляем тему «Переменные». Сдать до 10 июля.","subject":"Программирование","format":"programming","programmingLanguage":"python","starterCode":"# Дано: стороны прямоугольника\nwidth = 8\nheight = 5\n\n# TODO: вычисли периметр и площадь, используя переменные width и height\nperimeter = 0  # замени на правильную формулу\narea = 0       # замени на правильную формулу\n\nprint(\"Периметр:\", perimeter)\nprint(\"Площадь:\", area)","expectedOutput":"Периметр: 26\nПлощадь: 40","due_date":"2026-07-10T18:00:00+05:00"},{"title":"Циклы в JavaScript: таблица умножения","description":"Напиши программу на JavaScript, которая с помощью цикла for выводит таблицу умножения числа 7 (от 1 до 10) в формате «7 x 1 = 7». Закрепляем тему «Циклы». Сдать до 12 июля.","subject":"Программирование","format":"programming","programmingLanguage":"javascript","starterCode":"// Выведи таблицу умножения числа 7 (от 1 до 10)\nlet number = 7;\n\n// TODO: напиши цикл for, который выводит строки вида \"7 x 1 = 7\"\nfor (let i = 1; i <= 10; i++) {\n  // допиши тело цикла\n}","expectedOutput":"7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70","due_date":"2026-07-12T18:00:00+05:00"},{"title":"Тест: проценты и пропорции","description":"Пройди тест из 5 вопросов по теме «Проценты и пропорции» — повторение перед началом учебного года: нахождение процента от числа, изменение цены на процент, решение пропорций. Сдать до 14 июля.","subject":"Математика","format":"test","testQuestions":[{"question":"Найди 15% от числа 200.","options":["30","20","15","185"],"correctIndex":0},{"question":"В классе 25 учеников, из них 40% — мальчики. Сколько мальчиков в классе?","options":["12","10","8","15"],"correctIndex":1},{"question":"Товар стоил 4000 сум и подорожал на 20%. Какова новая цена?","options":["4800","4400","4200","5000"],"correctIndex":0},{"question":"Реши пропорцию: x/6 = 8/12. Чему равен x?","options":["6","3","4","5"],"correctIndex":2},{"question":"В магазине скидка 25% на куртку, которая стоила 160000 сум. Сколько нужно заплатить со скидкой?","options":["140000","100000","120000","40000"],"correctIndex":2}],"due_date":"2026-07-15T18:00:00+05:00"},{"title":"Wokwi: мигающий светодиод на Arduino","description":"Собери в симуляторе Wokwi схему с Arduino Uno, светодиодом и резистором 220 Ом, затем напиши скетч так, чтобы светодиод мигал с интервалом 1 секунда (используй digitalWrite() и delay()). Пришли ссылку на свой проект Wokwi. Сдать до 17 июля.","subject":"Робототехника","format":"external","externalServiceType":"wokwi","due_date":"2026-07-17T18:00:00+05:00"},{"title":"Desmos: графики линейных функций","description":"В графическом калькуляторе Desmos построй графики функций y = 2x + 1 и y = -x + 4. Определи по графику координаты точки их пересечения и укажи её в комментарии к сданной ссылке. Сдать до 19 июля.","subject":"Математика","format":"external","externalServiceType":"desmos","due_date":"2026-07-20T18:00:00+05:00"},{"title":"Project: My Summer Holidays","description":"Выполни мини-проект о летних каникулах на английском языке из трёх частей: напиши короткое сочинение, потренируй лексику по теме «Путешествия» и пройди интерактивный квиз на грамматику Present Simple / Past Simple. Сдать до 22 июля.","subject":"Английский язык","format":"bundle","bundleSubtasks":[{"title":"Essay: My Summer Holidays","description":"Write a short paragraph (80-100 words) about your summer holidays: where you went, what you did, how you felt. Use at least 5 Past Simple verbs. Upload your text as a file.","type":"file"},{"title":"Vocabulary practice","description":"Complete the interactive vocabulary matching exercise on LearningApps: travel and summer-themed words (beach, journey, suitcase, luggage, etc.).","type":"learningapps"},{"title":"Grammar quiz: Present Simple vs Past Simple","description":"Pass the interactive H5P quiz on choosing the correct verb form (Present Simple or Past Simple) in sentences about daily routines and past events.","type":"h5p"}],"due_date":"2026-07-22T18:00:00+05:00"},{"title":"Проект «Лето в моём городе»","description":"Выполни мини-проект из трёх частей о лете: напиши сочинение-описание, выполни тренировочное упражнение по орфографии и пройди интерактивный квиз по пунктуации. Сдать до 26 июля.","subject":"Русский язык","format":"bundle","bundleSubtasks":[{"title":"Сочинение-описание «Лето в моём городе»","description":"Напиши сочинение-описание объёмом 100-120 слов о любимом месте твоего города летом. Используй не менее 3 эпитетов и 2 сложных предложений. Загрузи файл с текстом.","type":"file"},{"title":"Тренажёр по орфографии","description":"Выполни интерактивное упражнение на LearningApps на повторение правописания безударных гласных и непроизносимых согласных в корне слова.","type":"learningapps"},{"title":"Квиз по пунктуации","description":"Пройди интерактивный квиз H5P на расстановку знаков препинания в простых и сложных предложениях.","type":"h5p"}],"due_date":"2026-07-25T18:00:00+05:00"}]'::jsonb)
    LOOP
      idx := 0;
      INSERT INTO public.homework (
        group_id, title, description, due_date, content_type, source, teacher_id, school_id,
        programming_language, starter_code, expected_output, external_url
      ) VALUES (
        v_group_id, hw_data->>'title', hw_data->>'description', (hw_data->>'due_date')::timestamptz,
        CASE hw_data->>'format'
          WHEN 'programming' THEN 'programming'
          WHEN 'test' THEN 'test'
          WHEN 'bundle' THEN 'bundle'
          WHEN 'external' THEN hw_data->>'externalServiceType'
          ELSE 'file'
        END,
        'curriculum', v_teacher_id, v_school_id,
        NULLIF(hw_data->>'programmingLanguage',''), NULLIF(hw_data->>'starterCode',''), NULLIF(hw_data->>'expectedOutput',''),
        CASE hw_data->>'format' WHEN 'external' THEN
          CASE hw_data->>'externalServiceType'
            WHEN 'wokwi' THEN 'https://wokwi.com/projects/new/arduino-uno'
            WHEN 'codesandbox' THEN 'https://codesandbox.io/p/sandbox/vanilla'
            WHEN 'geogebra' THEN 'https://www.geogebra.org/classic'
            WHEN 'phet' THEN 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html'
            WHEN 'desmos' THEN 'https://www.desmos.com/calculator'
            WHEN 'blockly_games' THEN 'https://blockly.games/'
            WHEN 'visualgo' THEN 'https://visualgo.net/en'
            WHEN 'p5js' THEN 'https://editor.p5js.org/'
            WHEN 'excalidraw' THEN 'https://excalidraw.com/'
            WHEN 'learningapps' THEN 'https://learningapps.org/'
            WHEN 'sqlonline' THEN 'https://sqlime.org/'
            WHEN 'h5p' THEN 'https://h5p.eduos.snruz.uz/library'
            ELSE NULL
          END
        ELSE NULL END
      )
      RETURNING id INTO v_hw_id;

      IF hw_data->>'format' = 'test' THEN
        FOR q_item IN SELECT * FROM jsonb_array_elements(hw_data->'testQuestions')
        LOOP
          idx := idx + 1;
          INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index, school_id)
          VALUES (v_hw_id, q_item->>'question', 'single_choice', idx, v_school_id)
          RETURNING id INTO v_q_id;

          opt_idx := 0;
          FOR opt_item IN SELECT * FROM jsonb_array_elements(q_item->'options')
          LOOP
            INSERT INTO public.test_question_options (question_id, option_text, is_correct, order_index, school_id)
            VALUES (v_q_id, opt_item#>>'{}', opt_idx = (q_item->>'correctIndex')::int, opt_idx, v_school_id);
            opt_idx := opt_idx + 1;
          END LOOP;
        END LOOP;
      END IF;

      IF hw_data->>'format' = 'bundle' THEN
        idx := 0;
        FOR sub_item IN SELECT * FROM jsonb_array_elements(hw_data->'bundleSubtasks')
        LOOP
          INSERT INTO public.homework_subtasks (homework_id, title, description, type, order_index, school_id)
          VALUES (v_hw_id, sub_item->>'title', sub_item->>'description', sub_item->>'type', idx, v_school_id);
          idx := idx + 1;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- === 3-А класс (7 заданий) ===
  SELECT id INTO v_group_id FROM public.groups WHERE name = '3-А класс';
  IF NOT EXISTS (SELECT 1 FROM public.homework WHERE group_id = v_group_id AND source = 'curriculum') THEN
    FOR hw_data IN SELECT * FROM jsonb_array_elements('[{"title":"Переменные-помощники: посчитай свой возраст через 5 лет","description":"Научись создавать переменные в Python и выполнять с ними простые вычисления. Допиши программу так, чтобы она посчитала возраст через 5 лет и вывела результат ровно в том виде, как в примере.","subject":"Программирование","format":"programming","programmingLanguage":"python","starterCode":"# Переменные-помощники: посчитай свой возраст через 5 лет\nname = \"Аня\"\nage = 9\nyears_to_add = 5\n\n# TODO 1: создай переменную future_age — сумму age и years_to_add\n# TODO 2: выведи через print() строку вида:\n# Привет, Аня! Через 5 лет тебе будет 14 лет.\n","expectedOutput":"Привет, Аня! Через 5 лет тебе будет 14 лет.","due_date":"2026-07-10T18:00:00+05:00"},{"title":"Циклы в JavaScript: лесенка из звёздочек","description":"Закрепи тему циклов: с помощью цикла for и console.log() выведи на экран лесенку из звёздочек, где в каждой следующей строке звёздочек на одну больше, чем в предыдущей.","subject":"Программирование","format":"programming","programmingLanguage":"javascript","starterCode":"// Лесенка из звёздочек от 1 до 5\nfor (let i = 1; i <= 5; i++) {\n  // TODO: допиши строку, которая печатает i звёздочек подряд (без пробелов)\n}\n","expectedOutput":"*\n**\n***\n****\n*****","due_date":"2026-07-12T18:00:00+05:00"},{"title":"Тест: Animals and Numbers","description":"Проверь себя по теме «Животные и числа от 1 до 20»: выбери один правильный вариант ответа в каждом из 5 вопросов.","subject":"Английский язык","format":"test","testQuestions":[{"question":"How many legs does a cat have?","options":["Two","Four","Six","Eight"],"correctIndex":1},{"question":"Choose the correct plural form: one mouse — two ___","options":["mouses","mice","mouse","mices"],"correctIndex":1},{"question":"What is the English word for the number 15?","options":["five","fifty","fifteen","fifteenth"],"correctIndex":2},{"question":"Which animal says ''moo''?","options":["Dog","Cow","Cat","Duck"],"correctIndex":1},{"question":"Choose the correct sentence:","options":["She go to school every day.","She goes to school every day.","She going to school every day.","She gone to school every day."],"correctIndex":1}],"due_date":"2026-07-15T18:00:00+05:00"},{"title":"Мигающий светофор на Wokwi","description":"Собери в симуляторе Wokwi схему светофора на Arduino Uno с тремя светодиодами (красный, жёлтый, зелёный) и напиши программу, которая зажигает их по очереди с задержкой в 1 секунду, как настоящий светофор.","subject":"Робототехника","format":"external","externalServiceType":"wokwi","due_date":"2026-07-17T18:00:00+05:00"},{"title":"Периметр и площадь прямоугольника в GeoGebra","description":"В приложении GeoGebra построй прямоугольник со сторонами 6 см и 4 см, подпиши все стороны, а в поле ввода запиши формулы и вычисли периметр и площадь фигуры.","subject":"Математика","format":"external","externalServiceType":"geogebra","due_date":"2026-07-20T18:00:00+05:00"},{"title":"Мини-проект: моя первая веб-страничка и лабиринт","description":"Выполни три части задания: напиши простой HTML-код странички о себе, пройди уровни лабиринта на Blockly Games с использованием циклов и ответь на вопросы про переменные.","subject":"Программирование","format":"bundle","bundleSubtasks":[{"title":"HTML-страница «Обо мне»","type":"code","description":"Напиши HTML-код странички: заголовок с твоим именем (тег h1), абзац о твоём хобби (тег p) и список из 3 увлечений (тег ul с li)."},{"title":"Лабиринт с циклами на Blockly Games","type":"blockly_games","description":"Пройди уровень «Лабиринт» на Blockly Games минимум до 6 уровня, используя блок «повторить» (цикл) там, где путь состоит из одинаковых повторяющихся шагов."},{"title":"Вопросы про переменные","type":"file","description":"Ответь в тетради на 3 вопроса: что такое переменная, приведи пример числовой и текстовой переменной, зачем переменные нужны в программах. Сфотографируй ответ и прикрепи фото."}],"due_date":"2026-07-22T18:00:00+05:00"},{"title":"Части речи и словарные слова","description":"Выполни три части комплексного задания: спиши словарные слова, распредели слова по частям речи и собери пословицы из перепутанных слов.","subject":"Русский язык","format":"bundle","bundleSubtasks":[{"title":"Словарный диктант","type":"file","description":"Спиши 10 словарных слов из учебника (стр. 45), подчеркни непроверяемые гласные, сфотографируй тетрадь и прикрепи фото."},{"title":"Определи часть речи","type":"learningapps","description":"Пройди упражнение на LearningApps: распредели 15 слов по трём группам — имя существительное, имя прилагательное, глагол."},{"title":"Собери пословицу","type":"h5p","description":"Реши интерактивное упражнение H5P: собери 5 пословиц из перепутанных слов и письменно объясни смысл одной из них."}],"due_date":"2026-07-25T18:00:00+05:00"}]'::jsonb)
    LOOP
      idx := 0;
      INSERT INTO public.homework (
        group_id, title, description, due_date, content_type, source, teacher_id, school_id,
        programming_language, starter_code, expected_output, external_url
      ) VALUES (
        v_group_id, hw_data->>'title', hw_data->>'description', (hw_data->>'due_date')::timestamptz,
        CASE hw_data->>'format'
          WHEN 'programming' THEN 'programming'
          WHEN 'test' THEN 'test'
          WHEN 'bundle' THEN 'bundle'
          WHEN 'external' THEN hw_data->>'externalServiceType'
          ELSE 'file'
        END,
        'curriculum', v_teacher_id, v_school_id,
        NULLIF(hw_data->>'programmingLanguage',''), NULLIF(hw_data->>'starterCode',''), NULLIF(hw_data->>'expectedOutput',''),
        CASE hw_data->>'format' WHEN 'external' THEN
          CASE hw_data->>'externalServiceType'
            WHEN 'wokwi' THEN 'https://wokwi.com/projects/new/arduino-uno'
            WHEN 'codesandbox' THEN 'https://codesandbox.io/p/sandbox/vanilla'
            WHEN 'geogebra' THEN 'https://www.geogebra.org/classic'
            WHEN 'phet' THEN 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html'
            WHEN 'desmos' THEN 'https://www.desmos.com/calculator'
            WHEN 'blockly_games' THEN 'https://blockly.games/'
            WHEN 'visualgo' THEN 'https://visualgo.net/en'
            WHEN 'p5js' THEN 'https://editor.p5js.org/'
            WHEN 'excalidraw' THEN 'https://excalidraw.com/'
            WHEN 'learningapps' THEN 'https://learningapps.org/'
            WHEN 'sqlonline' THEN 'https://sqlime.org/'
            WHEN 'h5p' THEN 'https://h5p.eduos.snruz.uz/library'
            ELSE NULL
          END
        ELSE NULL END
      )
      RETURNING id INTO v_hw_id;

      IF hw_data->>'format' = 'test' THEN
        FOR q_item IN SELECT * FROM jsonb_array_elements(hw_data->'testQuestions')
        LOOP
          idx := idx + 1;
          INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index, school_id)
          VALUES (v_hw_id, q_item->>'question', 'single_choice', idx, v_school_id)
          RETURNING id INTO v_q_id;

          opt_idx := 0;
          FOR opt_item IN SELECT * FROM jsonb_array_elements(q_item->'options')
          LOOP
            INSERT INTO public.test_question_options (question_id, option_text, is_correct, order_index, school_id)
            VALUES (v_q_id, opt_item#>>'{}', opt_idx = (q_item->>'correctIndex')::int, opt_idx, v_school_id);
            opt_idx := opt_idx + 1;
          END LOOP;
        END LOOP;
      END IF;

      IF hw_data->>'format' = 'bundle' THEN
        idx := 0;
        FOR sub_item IN SELECT * FROM jsonb_array_elements(hw_data->'bundleSubtasks')
        LOOP
          INSERT INTO public.homework_subtasks (homework_id, title, description, type, order_index, school_id)
          VALUES (v_hw_id, sub_item->>'title', sub_item->>'description', sub_item->>'type', idx, v_school_id);
          idx := idx + 1;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

END $$;
