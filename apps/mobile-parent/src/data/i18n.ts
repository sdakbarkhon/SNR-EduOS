/**
 * Перевод содержимого демо на узбекский и английский.
 *
 * ЗАЧЕМ. Заготовки демо написаны по-русски: названия блюд, остановок, прививок,
 * работ в портфолио, заявлений, документов, реплики в переписке. Даты и подписи
 * интерфейса уже собираются на языке интерфейса (заходы 2–3), а само содержимое
 * оставалось русским и на узбекском, и на английском. Заказчик показывает демо
 * на трёх языках — значит и содержимое должно быть на трёх.
 *
 * ПОЧЕМУ НЕ В ОБЩИЙ СЛОВАРЬ `packages/core/src/i18n`. Тот словарь обслуживает
 * весь продукт — веб ученика, учителя, админа, суперадмина. Демо-контент
 * родительского приложения там никому не нужен, а строк у него полторы сотни:
 * они раздули бы файл, в котором и так больше четырёх тысяч строк на язык.
 * Здесь перевод лежит рядом с заготовками, которые он обслуживает.
 *
 * ПОЧЕМУ ТАБЛИЦА ПО РУССКОЙ СТРОКЕ, А НЕ КЛЮЧИ. Ключ пришлось бы придумать
 * каждой из полутора сотен строк и держать связь «строка ↔ ключ» в двух
 * местах. Здесь заготовки не тронуты вовсе: русский текст в них и есть ключ.
 * Цена — правка русского текста в заготовке обрывает перевод. Поэтому
 * непереведённая строка не молчит, а честно остаётся русской: пустая строка
 * на экране читается как поломка, русская — как непереведённое.
 *
 * ГДЕ РАСПАКОВЫВАЕТСЯ. В аксессорах `src/data/index.ts` — они и так собирают
 * данные для экрана. Экран получает готовые строки и про языки не знает.
 */
import type { Locale } from "@snr/core";

/** [узбекский, английский]. Русский — сам ключ. */
type Pair = readonly [uz: string, en: string];

/**
 * Перевод демо-содержимого. Только то, что видно на экране: служебные поля,
 * ключи и неотрисовываемые заготовки сюда не попадают намеренно.
 */
export const DEMO_TR: Record<string, Pair> = {
  // ── Питание: блюда ────────────────────────────────────────────────────────
  "Суп мастава": ["Mastava sho'rva", "Mastava soup"],
  "Котлета с пюре": ["Kotlet va kartoshka pyuresi", "Cutlet with mashed potato"],
  "Салат витаминный": ["Vitaminli salat", "Vitamin salad"],
  "Чай с лимоном": ["Limonli choy", "Tea with lemon"],
  "Борщ": ["Borsh", "Borscht"],
  "Макароны с курицей": ["Tovuqli makaron", "Pasta with chicken"],
  "Салат из капусты": ["Karam salati", "Cabbage salad"],
  "Морс ягодный": ["Rezavor mevali mors", "Berry drink"],
  "Суп лагман": ["Lagmon", "Lagman soup"],
  "Плов с говядиной": ["Mol go'shtli osh", "Pilaf with beef"],
  "Салат из свежих овощей": ["Yangi sabzavot salati", "Fresh vegetable salad"],
  "Компот из сухофруктов": ["Quruq meva kompoti", "Dried fruit compote"],
  "Суп куриный": ["Tovuqli sho'rva", "Chicken soup"],
  "Рыба с рисом": ["Baliq va guruch", "Fish with rice"],
  "Салат греческий": ["Grek salati", "Greek salad"],
  "Кисель": ["Kisel", "Kissel"],
  "Шурпа": ["Sho'rva", "Shurpa"],
  "Манты с тыквой": ["Qovoqli manti", "Pumpkin manti"],
  "Салат морковный": ["Sabzi salati", "Carrot salad"],
  "Чай зелёный": ["Ko'k choy", "Green tea"],
  "Суп овощной": ["Sabzavotli sho'rva", "Vegetable soup"],
  "Жаркое по-домашнему": ["Uyda pishirilgan qovurma", "Home-style roast"],
  "Салат свекольный": ["Lavlagi salati", "Beetroot salad"],
  "Компот": ["Kompot", "Compote"],
  // ── Питание: разряды блюд ────────────────────────────────────────────────
  "первое": ["birinchi taom", "first course"],
  "второе": ["ikkinchi taom", "main course"],
  "салат": ["salat", "salad"],
  "напиток": ["ichimlik", "drink"],

  // ── Транспорт: остановки ─────────────────────────────────────────────────
  "Депо «Юнусабад»": ["«Yunusobod» deposi", "Yunusabad depot"],
  "Массив Юнусабад-4": ["Yunusobod-4 mavzesi", "Yunusabad-4 district"],
  "Метро «Юнусабад»": ["«Yunusobod» metrosi", "Yunusabad metro station"],
  "Ул. Амира Темура": ["Amir Temur ko'chasi", "Amir Temur street"],
  "Сквер Дружбы": ["Do'stlik xiyoboni", "Friendship square"],

  // ── Медкарта: показатели ─────────────────────────────────────────────────
  "РОСТ": ["BO'Y", "HEIGHT"],
  "ВЕС": ["VAZN", "WEIGHT"],
  "ГРУППА КРОВИ": ["QON GURUHI", "BLOOD TYPE"],
  "ЗРЕНИЕ": ["KO'RISH", "VISION"],
  "128 см": ["128 sm", "128 cm"],
  "158 см": ["158 sm", "158 cm"],
  "174 см": ["174 sm", "174 cm"],
  "130 см": ["130 sm", "130 cm"],
  "156 см": ["156 sm", "156 cm"],
  "176 см": ["176 sm", "176 cm"],
  "26 кг": ["26 kg", "26 kg"],
  "46 кг": ["46 kg", "46 kg"],
  "63 кг": ["63 kg", "63 kg"],
  "27 кг": ["27 kg", "27 kg"],
  "44 кг": ["44 kg", "44 kg"],
  "65 кг": ["65 kg", "65 kg"],
  // ── Медкарта: аллергии и оговорки ────────────────────────────────────────
  "Не выявлено": ["Aniqlanmagan", "None found"],
  "Аллергий и особых ограничений нет": [
    "Allergiya va maxsus cheklovlar yo'q",
    "No allergies or special restrictions",
  ],
  "Пыльца (сезонная аллергия)": ["Gulchang (mavsumiy allergiya)", "Pollen (seasonal allergy)"],
  "Апрель–июнь · антигистаминные при обострении": [
    "Aprel–iyun · kuchayganda antigistamin vositalar",
    "April–June · antihistamines during flare-ups",
  ],
  "Очки для чтения": ["O'qish uchun ko'zoynak", "Reading glasses"],
  "Рекомендация офтальмолога от 12.02.2026": [
    "Oftalmolog tavsiyasi, 12.02.2026",
    "Ophthalmologist's recommendation, 12.02.2026",
  ],
  "Орехи (пищевая)": ["Yong'oq (oziq-ovqat allergiyasi)", "Nuts (food allergy)"],
  "Строго исключить · при контакте — антигистаминные": [
    "Butunlay istisno qilish · tegib ketsa — antigistamin vositalar",
    "Strictly avoid · antihistamines on contact",
  ],
  // ── Медкарта: прививки ───────────────────────────────────────────────────
  "АКДС (ревакцинация)": ["AKDS (revaksinatsiya)", "DTP (booster)"],
  "Корь · краснуха · паротит": ["Qizamiq · qizilcha · parotit", "Measles · rubella · mumps"],
  "Гепатит B (курс)": ["Gepatit B (kurs)", "Hepatitis B (course)"],
  "Грипп (сезонная)": ["Gripp (mavsumiy)", "Influenza (seasonal)"],
  "АДС-М (ревакцинация)": ["ADS-M (revaksinatsiya)", "Td (booster)"],

  // ── Портфолио: работы ────────────────────────────────────────────────────
  "Проект «Калькулятор»": ["«Kalkulyator» loyihasi", "“Calculator” project"],
  "Манипулятор: сборка": ["Manipulyator: yig'ish", "Manipulator: assembly"],
  "Проценты в жизни": ["Hayotda foizlar", "Percentages in real life"],
  "Постер «My Summer»": ["«My Summer» posteri", "“My Summer” poster"],
  // ── Портфолио: награды ───────────────────────────────────────────────────
  "Победитель олимпиады по математике": [
    "Matematika olimpiadasi g'olibi",
    "Mathematics olympiad winner",
  ],
  "Городской этап · 1 место": ["Shahar bosqichi · 1-o'rin", "City round · 1st place"],
  "Лучший проект четверти": ["Chorakning eng yaxshi loyihasi", "Best project of the term"],
  "Программирование · «Калькулятор»": [
    "Dasturlash · «Kalkulyator»",
    "Programming · “Calculator”",
  ],
  "100% посещаемость": ["100% davomat", "100% attendance"],
  "Июнь без единого пропуска": [
    "Iyun — bironta ham dars qoldirilmagan",
    "June without a single absence",
  ],
  "Активный участник дебатов": ["Debat faol ishtirokchisi", "Active debate participant"],
  "Школьный клуб дебатов": ["Maktab debat klubi", "School debate club"],
  // ── Портфолио: сертификаты ───────────────────────────────────────────────
  "Диплом олимпиады по математике": [
    "Matematika olimpiadasi diplomi",
    "Mathematics olympiad diploma",
  ],
  "Управление образования г. Ташкента": [
    "Toshkent shahar xalq ta'limi boshqarmasi",
    "Tashkent city education department",
  ],
  "Сертификат «Python Basics»": ["«Python Basics» sertifikati", "“Python Basics” certificate"],
  "Сертификат English A2": ["English A2 sertifikati", "English A2 certificate"],
  "Экзаменационный центр": ["Imtihon markazi", "Examination centre"],
  "Сертификат «Робототехника: старт»": [
    "«Robototexnika: start» sertifikati",
    "“Robotics: start” certificate",
  ],

  // ── Заявления ────────────────────────────────────────────────────────────
  "Справка для спортивной секции": [
    "Sport to'garagi uchun ma'lumotnoma",
    "Certificate for a sports club",
  ],
  "Справка об обучении": ["O'qish haqida ma'lumotnoma", "Proof of enrolment"],
  "Отсутствие по семейным обстоятельствам": [
    "Oilaviy sabablarga ko'ra darsda bo'lmaslik",
    "Absence for family reasons",
  ],
  "Перевод в другой класс": ["Boshqa sinfga o'tkazish", "Transfer to another class"],
  "Академический отпуск (лето)": ["Akademik ta'til (yoz)", "Academic leave (summer)"],

  // ── Переписка с учителем ─────────────────────────────────────────────────
  "Добрый день! Напоминаю: домашнее задание сдаём до конца недели.": [
    "Xayrli kun! Eslatib o'taman: uy vazifasi hafta oxirigacha topshiriladi.",
    "Good afternoon! A reminder: homework is due by the end of the week.",
  ],
  "Добрый день! Спасибо, посмотрим сегодня.": [
    "Xayrli kun! Rahmat, bugun ko'rib chiqamiz.",
    "Good afternoon! Thank you, we'll look at it today.",
  ],
  "Если будут вопросы по заданию — пишите, я на связи.": [
    "Vazifa bo'yicha savol bo'lsa — yozing, aloqadaman.",
    "If you have questions about the task, write to me — I'm available.",
  ],
  "Хорошо. Нужно ли приносить тетрадь на следующий урок?": [
    "Yaxshi. Keyingi darsga daftar olib kelish kerakmi?",
    "All right. Should we bring the exercise book to the next lesson?",
  ],
  "Да, тетрадь понадобится. Остальное выдам на уроке.": [
    "Ha, daftar kerak bo'ladi. Qolganini darsda beraman.",
    "Yes, the exercise book will be needed. I'll hand out the rest in class.",
  ],
  "Спасибо!": ["Rahmat!", "Thank you!"],
  "Напоминаю: домашнее задание сдаём до конца недели": [
    "Eslatma: uy vazifasi hafta oxirigacha topshiriladi",
    "Reminder: homework is due by the end of the week",
  ],

  // ── Поддержка ────────────────────────────────────────────────────────────
  "Здравствуйте! Вопрос по оплате за август: почему сумма больше, чем в прошлом месяце?": [
    "Assalomu alaykum! Avgust to'lovi bo'yicha savol: nega summa o'tgan oydagidan ko'p?",
    "Hello! A question about the August payment: why is the amount higher than last month?",
  ],
  "Здравствуйте! Давайте проверим счёт. Уточните, пожалуйста, класс ребёнка.": [
    "Assalomu alaykum! Hisobni tekshiramiz. Iltimos, bolangizning sinfini ayting.",
    "Hello! Let's check the invoice. Please tell us the child's class.",
  ],
  "Спасибо, всё понятно.": ["Rahmat, tushunarli.", "Thank you, that's clear."],
  "Информация по счёту": ["Hisob bo'yicha ma'lumot", "Invoice details"],
  "Поддержка": ["Qo'llab-quvvatlash", "Support"],
  "Бухгалтерия": ["Buxgalteriya", "Accounting"],
  "Онлайн": ["Onlayn", "Online"],
  "Поддержка SNR EduOS": ["SNR EduOS qo'llab-quvvatlash", "SNR EduOS support"],
  "Мы отвечаем быстро": ["Tez javob beramiz", "We reply quickly"],
  "Оплата обучения": ["O'qish to'lovi", "Tuition payment"],
  "Здравствуйте! Вопрос по оплате обучения.": [
    "Assalomu alaykum! O'qish to'lovi bo'yicha savol.",
    "Hello! A question about tuition payment.",
  ],
  "Питание": ["Ovqatlanish", "Meals"],
  "Здравствуйте! Вопрос по питанию.": [
    "Assalomu alaykum! Ovqatlanish bo'yicha savol.",
    "Hello! A question about meals.",
  ],
  "Чеки и документы": ["Cheklar va hujjatlar", "Receipts and documents"],
  "Здравствуйте! Нужны чеки и документы об оплате.": [
    "Assalomu alaykum! To'lov cheklari va hujjatlari kerak.",
    "Hello! I need payment receipts and documents.",
  ],
  "Возврат средств": ["Mablag'ni qaytarish", "Refund"],
  "Здравствуйте! Как оформить возврат средств?": [
    "Assalomu alaykum! Mablag'ni qanday qaytarish mumkin?",
    "Hello! How do I request a refund?",
  ],

  // ── Оплаты: счета и операции ─────────────────────────────────────────────
  "Обучение · август": ["O'qish · avgust", "Tuition · August"],
  "Питание · август": ["Ovqatlanish · avgust", "Meals · August"],
  "Школьная форма": ["Maktab formasi", "School uniform"],
  "Экскурсия в музей": ["Muzeyga ekskursiya", "Museum trip"],
  "ежемесячный платёж": ["oylik to'lov", "monthly payment"],
  "обеды в столовой": ["oshxonada tushlik", "canteen lunches"],
  "комплект на осень": ["kuzgi to'plam", "autumn set"],
  "выезд класса": ["sinf sayohati", "class outing"],
  "Обучение · июль": ["O'qish · iyul", "Tuition · July"],
  "Питание · июль": ["Ovqatlanish · iyul", "Meals · July"],
  "Питание · перерасчёт": ["Ovqatlanish · qayta hisob", "Meals · recalculation"],
  "возврат за 3 дня отсутствия": [
    "3 kun kelmagani uchun qaytarish",
    "refund for 3 days of absence",
  ],
  "Обучение · июнь": ["O'qish · iyun", "Tuition · June"],
  "Питание · июнь": ["Ovqatlanish · iyun", "Meals · June"],
  "Столовая · обед": ["Oshxona · tushlik", "Canteen · lunch"],
  "Комплекс «Стандарт»": ["«Standart» to'plami", "“Standard” set"],
  "Школьный магазин": ["Maktab do'koni", "School shop"],
  "Канцелярия · тетради": ["Kanselyariya · daftarlar", "Stationery · exercise books"],
  "Тетради и ручки": ["Daftar va ruchkalar", "Exercise books and pens"],
  "Пополнение с карты": ["Kartadan to'ldirish", "Top-up from card"],
  "Буфет": ["Bufet", "Snack bar"],
  "Сок и булочка": ["Sharbat va bulochka", "Juice and a bun"],
  "Вода": ["Suv", "Water"],
  "Канцелярия": ["Kanselyariya", "Stationery"],
  "Альбом для рисования": ["Rasm albomi", "Drawing album"],

  // ── Документы ────────────────────────────────────────────────────────────
  "Свидетельство о рождении": ["Tug'ilganlik haqidagi guvohnoma", "Birth certificate"],
  "Паспорт / ID карта": ["Pasport / ID karta", "Passport / ID card"],
  "Медицинская справка": ["Tibbiy ma'lumotnoma", "Medical certificate"],
  "Прививки": ["Emlashlar", "Vaccinations"],
  "Фото ребёнка": ["Bolaning surati", "Child's photo"],
  "Доверенность": ["Ishonchnoma", "Power of attorney"],
  "Добавлен 12.01.2026": ["Qo'shilgan 12.01.2026", "Added 12.01.2026"],
  "Добавлен 03.02.2026": ["Qo'shilgan 03.02.2026", "Added 03.02.2026"],
  "Добавлен 15.03.2026": ["Qo'shilgan 15.03.2026", "Added 15.03.2026"],

  // ── Вложения в переписке ─────────────────────────────────────────────────
  "Фото": ["Surat", "Photo"],
  "Файл": ["Fayl", "File"],

  // ── Поддержка: время ответа ──────────────────────────────────────────────
  "5 мин": ["5 daq", "5 min"],

  // ── Дни недели в питании ─────────────────────────────────────────────────
  "Пн": ["Du", "Mon"],
  "Вт": ["Se", "Tue"],
  "Ср": ["Ch", "Wed"],
  "Чт": ["Pa", "Thu"],
  "Пт": ["Ju", "Fri"],
  "Сб": ["Sh", "Sat"],

  // ── Посещаемость: месяцы календаря ───────────────────────────────────────
  "Июнь 2026": ["2026-yil iyun", "June 2026"],
  "Июль 2026": ["2026-yil iyul", "July 2026"],

  // ── Посещаемость: последние дни ──────────────────────────────────────────
  "Сегодня, 23 июля": ["Bugun, 23-iyul", "Today, 23 July"],
  "Вчера, 22 июля": ["Kecha, 22-iyul", "Yesterday, 22 July"],
  "Вторник, 21 июля": ["Seshanba, 21-iyul", "Tuesday, 21 July"],
  "Вторник, 14 июля": ["Seshanba, 14-iyul", "Tuesday, 14 July"],
  // Плейсхолдера {suf} в переводах нет намеренно: род в узбекском и
  // английском не выражается, и подстановка суффикса просто не находит
  // ничего. Порядок «сначала перевод, потом подстановка» — в аксессоре.
  "Присутствует": ["Maktabda", "At school"],
  "Присутствовал{suf}": ["Maktabda bo'lgan", "Was at school"],
  "Отсутствовал{suf} без уважительной причины": ["Sababsiz kelmagan", "Absent without a valid reason"],
  "Уважительная причина · справка врача": ["Uzrli sabab · shifokor ma'lumotnomasi", "Excused · doctor's note"],

  // ── Успехи: вкладка «Навыки» ─────────────────────────────────────────────
  "Знания": ["Bilim", "Knowledge"],
  "Мышление": ["Tafakkur", "Thinking"],
  "Творчество": ["Ijodkorlik", "Creativity"],
  "Коммуникация": ["Muloqot", "Communication"],
  "Логика": ["Mantiq", "Logic"],
  "Дисциплина": ["Intizom", "Discipline"],
  // Не «Creativity» второй раз: «Творчество» выше уже занято, а это другая
  // ось профиля — про способ думать, а не про занятие.
  "Креативность": ["Ijodiy fikrlash", "Creative thinking"],

  // ── Главная: лента «Сегодня» и плитка питания ────────────────────────────
  "Математика — оценка за контрольную": ["Matematika — nazorat ishi bahosi", "Maths — test grade"],
  "Дроби и проценты · 10:42": ["Kasrlar va foizlar · 10:42", "Fractions and percentages · 10:42"],
  "Английский язык — эссе «My Summer»": ["Ingliz tili — «My Summer» inshosi", "English — «My Summer» essay"],
  "Домашнее задание": ["Uyga vazifa", "Homework"],
  "Срок завтра": ["Muddati ertaga", "Due tomorrow"],
  "Питание оплачено": ["Ovqatlanish to'langan", "Meals paid"],
  "Обед получен в 12:40": ["Tushlik 12:40 da olindi", "Lunch collected at 12:40"],
  "Успешно": ["Muvaffaqiyatli", "Done"],
  "Оплачено до 31 июля": ["31-iyulgacha to'langan", "Paid through 31 July"],

  // ── Предметы ─────────────────────────────────────────────────────────────
  // Названия предметов встречаются на всех экранах учёбы и сообщений; до
  // сих пор они оставались русскими и на узбекском, и на английском.
  "Русский язык": ["Rus tili", "Russian"],
  "Английский язык": ["Ingliz tili", "English"],
  "Математика": ["Matematika", "Maths"],
  "Программирование": ["Dasturlash", "Programming"],
  "Робототехника": ["Robototexnika", "Robotics"],
  "Русский язык · факультатив": ["Rus tili · fakultativ", "Russian · elective"],

  // ── Профиль учителя ──────────────────────────────────────────────────────
  // Классы («3-А, 5-Б, 7-А, 10-А») не переводятся намеренно: это
  // обозначения, а не слова.
  "12 лет": ["12 yil", "12 years"],
  "ТГПУ им. Низами": ["Nizomiy nomidagi TDPU", "Nizami TSPU"],

  // ── Объявления: даты и авторы ────────────────────────────────────────────
  "21 июля 2026": ["2026-yil 21-iyul", "21 July 2026"],
  "20 июля 2026": ["2026-yil 20-iyul", "20 July 2026"],
  "19 июля 2026": ["2026-yil 19-iyul", "19 July 2026"],
  "18 июля 2026": ["2026-yil 18-iyul", "18 July 2026"],
  "21 июля 2026, 10:30": ["2026-yil 21-iyul, 10:30", "21 July 2026, 10:30"],
  "Администрация школы": ["Maktab ma'muriyati", "School administration"],
  "Транспортный отдел": ["Transport bo'limi", "Transport department"],
  "Пресс-служба школы": ["Maktab matbuot xizmati", "School press office"],

  // ── Объявления: заголовки и тексты ───────────────────────────────────────
  "Школьная ярмарка": ["Maktab yarmarkasi", "School fair"],
  "24 июля состоится ежегодная школьная ярмарка! Ждём вас и ваших детей — активности, выступления и угощения.": ["24-iyul kuni an'anaviy maktab yarmarkasi bo'lib o'tadi! Sizni va farzandlaringizni kutamiz — mashg'ulotlar, chiqishlar va shirinliklar.", "The annual school fair takes place on 24 July! We look forward to seeing you and your children — activities, performances and treats."],
  "Родительское собрание": ["Ota-onalar yig'ilishi", "Parent meeting"],
  "30 июля в 18:00 состоится родительское собрание для 1–11 классов в актовом зале школы.": ["30-iyul kuni soat 18:00 da maktab yig'ilishlar zalida 1–11-sinflar uchun ota-onalar yig'ilishi bo'lib o'tadi.", "On 30 July at 18:00 there will be a parent meeting for grades 1–11 in the school assembly hall."],
  "Изменение маршрута транспорта": ["Transport marshruti o'zgardi", "Transport route change"],
  "С 28 июля маршрут №3 будет отправляться на 10 минут позже. Проверьте новое расписание в разделе «Транспорт».": ["28-iyuldan boshlab 3-marshrut 10 daqiqa kechroq jo'naydi. Yangi jadvalni «Transport» bo'limida ko'ring.", "From 28 July route 3 departs 10 minutes later. Check the new timetable in the Transport section."],
  "Обновление SNR EduOS": ["SNR EduOS yangilanishi", "SNR EduOS update"],
  "В приложении появились раздел «Все сервисы», обновлённое расписание с темами уроков и уведомления.": ["Ilovada «Barcha xizmatlar» bo'limi, dars mavzulari bilan yangilangan jadval va bildirishnomalar paydo bo'ldi.", "The app now has an All services section, an updated timetable with lesson topics, and notifications."],

  // ── Разворот объявления ──────────────────────────────────────────────────
  "Школьная ярмарка — 24 июля": ["Maktab yarmarkasi — 24-iyul", "School fair — 24 July"],
  "Уважаемые родители! 24 июля в нашей школе состоится ежегодная школьная ярмарка.": ["Hurmatli ota-onalar! 24-iyul kuni maktabimizda an'anaviy maktab yarmarkasi bo'lib o'tadi.", "Dear parents! On 24 July our school holds its annual fair."],
  "Будем рады видеть вас и ваших детей на этом празднике. Вас ждут интересные активности, выступления учеников и вкусные угощения.": ["Sizni va farzandlaringizni ushbu bayramda ko'rishdan mamnun bo'lamiz. Sizni qiziqarli mashg'ulotlar, o'quvchilar chiqishi va mazali taomlar kutmoqda.", "We would be glad to see you and your children at the celebration. Expect activities, student performances and tasty treats."],
  "24 июля (пятница)": ["24-iyul (juma)", "24 July (Friday)"],
  "Школьный двор": ["Maktab hovlisi", "School yard"],
  "Важно! Просим подтвердить участие вашего ребёнка до 23 июля в разделе «Мероприятия».": ["Muhim! Farzandingiz ishtirokini 23-iyulgacha «Tadbirlar» bo'limida tasdiqlashingizni so'raymiz.", "Important: please confirm your child's attendance by 23 July in the Events section."],
  "Программа ярмарки.pdf": ["Yarmarka dasturi.pdf", "Fair programme.pdf"],
  "Плакат ярмарки.png": ["Yarmarka plakati.png", "Fair poster.png"],
  "Список участников.xlsx": ["Ishtirokchilar ro'yxati.xlsx", "Participant list.xlsx"],

  // ── Темы уроков ──────────────────────────────────────────────────────────
  // Общие для «Освоения тем» (заход 3) и дневника (заход 5): одна строка
  // обслуживает оба экрана. Заход 3 оставил их без перевода — закрываем.
  "Части речи": ["So'z turkumlari", "Parts of speech"],
  "Дроби и проценты": ["Kasrlar va foizlar", "Fractions and percentages"],
  "Дроби": ["Kasrlar", "Fractions"],
  "Проценты": ["Foizlar", "Percentages"],
  "Уравнения": ["Tenglamalar", "Equations"],
  "Геометрия: углы": ["Geometriya: burchaklar", "Geometry: angles"],
  "Текстовые задачи": ["Matnli masalalar", "Word problems"],
  "Циклы в Python": ["Python'da sikllar", "Loops in Python"],
  "Циклы": ["Sikllar", "Loops"],
  "Функции": ["Funksiyalar", "Functions"],
  "Списки и словари": ["Ro'yxatlar va lug'atlar", "Lists and dictionaries"],
  "Проект: калькулятор": ["Loyiha: kalkulyator", "Project: calculator"],
  "Механика манипулятора": ["Manipulyator mexanikasi", "Manipulator mechanics"],
  "Сборка манипулятора": ["Manipulyatorni yig'ish", "Assembling the manipulator"],
  "Датчики": ["Sensorlar", "Sensors"],
  "Сборка шасси": ["Shassini yig'ish", "Chassis assembly"],
  "Программирование движения": ["Harakatni dasturlash", "Motion programming"],
  "Пунктуация": ["Tinish belgilari", "Punctuation"],
  "Сочинение-рассуждение": ["Mulohaza-insho", "Argumentative essay"],
  "Диктанты": ["Diktantlar", "Dictations"],
  "Диктант": ["Diktant", "Dictation"],
  "Past Simple: практика": ["Past Simple: amaliyot", "Past Simple: practice"],

  // ── «Освоение тем»: сколько уроков и заданий ─────────────────────────────
  "8 уроков · 6 заданий": ["8 dars · 6 topshiriq", "8 lessons · 6 tasks"],
  "7 уроков · 5 заданий": ["7 dars · 5 topshiriq", "7 lessons · 5 tasks"],
  "6 уроков · 5 заданий": ["6 dars · 5 topshiriq", "6 lessons · 5 tasks"],
  "6 уроков · 4 задания": ["6 dars · 4 topshiriq", "6 lessons · 4 tasks"],
  "5 уроков · 4 задания": ["5 dars · 4 topshiriq", "5 lessons · 4 tasks"],
  "5 уроков · 5 заданий": ["5 dars · 5 topshiriq", "5 lessons · 5 tasks"],
  "5 уроков · 3 задания": ["5 dars · 3 topshiriq", "5 lessons · 3 tasks"],
  "4 урока · 3 задания": ["4 dars · 3 topshiriq", "4 lessons · 3 tasks"],
  "4 урока · 2 задания": ["4 dars · 2 topshiriq", "4 lessons · 2 tasks"],
  "4 урока · 4 задания": ["4 dars · 4 topshiriq", "4 lessons · 4 tasks"],
  "3 урока · 3 задания": ["3 dars · 3 topshiriq", "3 lessons · 3 tasks"],
  "3 урока · 1 задание": ["3 dars · 1 topshiriq", "3 lessons · 1 task"],

  // ── Дневник: недели и дни ────────────────────────────────────────────────
  "20 – 26 июля": ["20 – 26-iyul", "20–26 July"],
  "13 – 19 июля": ["13 – 19-iyul", "13–19 July"],
  "ПОНЕДЕЛЬНИК · 21 июля": ["DUSHANBA · 21-iyul", "MONDAY · 21 July"],
  "ВТОРНИК · 22 июля": ["SESHANBA · 22-iyul", "TUESDAY · 22 July"],
  "СРЕДА · 23 июля": ["CHORSHANBA · 23-iyul", "WEDNESDAY · 23 July"],
  "ЧЕТВЕРГ · 24 июля": ["PAYSHANBA · 24-iyul", "THURSDAY · 24 July"],
  "ПОНЕДЕЛЬНИК · 14 июля": ["DUSHANBA · 14-iyul", "MONDAY · 14 July"],
  "ВТОРНИК · 15 июля": ["SESHANBA · 15-iyul", "TUESDAY · 15 July"],
  "СРЕДА · 16 июля": ["CHORSHANBA · 16-iyul", "WEDNESDAY · 16 July"],
  "ПЯТНИЦА · 18 июля": ["JUMA · 18-iyul", "FRIDAY · 18 July"],

  // ── «N из M» ─────────────────────────────────────────────────────────────
  "8 из 10": ["10 tadan 8", "8 of 10"],
  "9 из 11": ["11 tadan 9", "9 of 11"],
  "9 из 10": ["10 tadan 9", "9 of 10"],
  "7 из 10": ["10 tadan 7", "7 of 10"],
  "10 из 10": ["10 tadan 10", "10 of 10"],

  // ── Дневник: домашние задания ────────────────────────────────────────────
  "Д/З: не задано": ["Uyga vazifa: berilmagan", "Homework: none"],
  "Д/З: упражнения 45–48": ["Uyga vazifa: 45–48-mashqlar", "Homework: exercises 45–48"],
  "Д/З: упражнения 40–44": ["Uyga vazifa: 40–44-mashqlar", "Homework: exercises 40–44"],
  "Д/З: № 140–148": ["Uyga vazifa: № 140–148", "Homework: no. 140–148"],
  "Д/З: № 150–155": ["Uyga vazifa: № 150–155", "Homework: no. 150–155"],
  "Д/З: № 120–126": ["Uyga vazifa: № 120–126", "Homework: no. 120–126"],
  "Д/З: № 130–136": ["Uyga vazifa: № 130–136", "Homework: no. 130–136"],
  "Д/З: № 137–139": ["Uyga vazifa: № 137–139", "Homework: no. 137–139"],
  "Д/З: эссе «My Summer»": ["Uyga vazifa: «My Summer» inshosi", "Homework: «My Summer» essay"],
  "Д/З: проект «Калькулятор»": ["Uyga vazifa: «Kalkulyator» loyihasi", "Homework: «Calculator» project"],
  "Д/З: отчёт по сборке": ["Uyga vazifa: yig'ish hisoboti", "Homework: assembly report"],
  "Д/З: задачи 12–18": ["Uyga vazifa: 12–18-masalalar", "Homework: problems 12–18"],
  "Д/З: задачи 1–5": ["Uyga vazifa: 1–5-masalalar", "Homework: problems 1–5"],
  "Д/З: выучить 20 слов": ["Uyga vazifa: 20 ta so'z yodlash", "Homework: learn 20 words"],
  "Д/З: практика в тетради": ["Uyga vazifa: daftarda amaliyot", "Homework: practice in the notebook"],
  "Д/З: план сочинения": ["Uyga vazifa: insho rejasi", "Homework: essay outline"],
  "Д/З: пересказ текста": ["Uyga vazifa: matnni so'zlab berish", "Homework: retell the text"],
  "Д/З: схема подключения": ["Uyga vazifa: ulanish sxemasi", "Homework: wiring diagram"],
  "Д/З: черновик эссе": ["Uyga vazifa: insho qoralamasi", "Homework: essay draft"],

  // ── Тесты ────────────────────────────────────────────────────────────────
  "Тест «Датчики»": ["«Sensorlar» testi", "«Sensors» test"],
  "Тест «Past Simple»": ["«Past Simple» testi", "«Past Simple» test"],
  "Тест «Дроби и проценты»": ["«Kasrlar va foizlar» testi", "«Fractions and percentages» test"],
  "Тест «Циклы в Python»": ["«Python'da sikllar» testi", "«Loops in Python» test"],
  "Тест «Геометрия. Углы»": ["«Geometriya. Burchaklar» testi", "«Geometry. Angles» test"],
  "Тест «Пунктуация»": ["«Tinish belgilari» testi", "«Punctuation» test"],
  "Робототехника · датчики и схемы": ["Robototexnika · sensorlar va sxemalar", "Robotics · sensors and circuits"],
  "Английский · грамматика": ["Ingliz tili · grammatika", "English · grammar"],
  "Математика · дроби": ["Matematika · kasrlar", "Maths · fractions"],
  "Математика · геометрия": ["Matematika · geometriya", "Maths · geometry"],
  "Программирование · циклы": ["Dasturlash · sikllar", "Programming · loops"],
  "Русский язык · знаки препинания": ["Rus tili · tinish belgilari", "Russian · punctuation"],
  "Пройден 17 июля": ["17-iyulda topshirilgan", "Taken on 17 July"],
  "Пройден 15 июля": ["15-iyulda topshirilgan", "Taken on 15 July"],
  "Пройден 10 июля": ["10-iyulda topshirilgan", "Taken on 10 July"],
  "Пройден 8 июля": ["8-iyulda topshirilgan", "Taken on 8 July"],
  "Проведение: 26 июля, 10:00": ["O'tkaziladi: 26-iyul, 10:00", "Scheduled: 26 July, 10:00"],
  "Проведение: 28 июля, 09:25": ["O'tkaziladi: 28-iyul, 09:25", "Scheduled: 28 July, 09:25"],
  "Через 3 дня": ["3 kundan keyin", "In 3 days"],
  "Через 5 дней": ["5 kundan keyin", "In 5 days"],

  // ── Библиотека ───────────────────────────────────────────────────────────
  // Фамилии авторов не переводятся намеренно — это имена людей.
  "Python для школьников": ["Maktab o'quvchilari uchun Python", "Python for school students"],
  "Сборник задач: дроби": ["Masalalar to'plami: kasrlar", "Problem set: fractions"],
  "Алгоритмы в картинках": ["Rasmlarda algoritmlar", "Algorithms in pictures"],
  "Геометрия: 7 класс": ["Geometriya: 7-sinf", "Geometry: grade 7"],
  "Сборник диктантов": ["Diktantlar to'plami", "Dictation collection"],
  "Основы робототехники": ["Robototexnika asoslari", "Robotics basics"],
  "Разбор сочинений": ["Insholar tahlili", "Essay analysis"],
  "PDF · 4.2 МБ": ["PDF · 4.2 MB", "PDF · 4.2 MB"],
  "PDF · 2.4 МБ": ["PDF · 2.4 MB", "PDF · 2.4 MB"],
  "PDF · 8.1 МБ": ["PDF · 8.1 MB", "PDF · 8.1 MB"],
  "PDF · 6.3 МБ": ["PDF · 6.3 MB", "PDF · 6.3 MB"],
  "PDF · 3.8 МБ": ["PDF · 3.8 MB", "PDF · 3.8 MB"],
  "PDF · 1.9 МБ": ["PDF · 1.9 MB", "PDF · 1.9 MB"],
  "PDF · 5.6 МБ": ["PDF · 5.6 MB", "PDF · 5.6 MB"],
  "PDF · 2.2 МБ": ["PDF · 2.2 MB", "PDF · 2.2 MB"],

  // ── Отзывы учителей: когда ────────────────────────────────────────────────
  "2 ч назад": ["2 soat oldin", "2 hours ago"],
  "4 ч назад": ["4 soat oldin", "4 hours ago"],
  "14 июля": ["14-iyul", "14 July"],
  "10 июля": ["10-iyul", "10 July"],

  // ── «Все предметы»: сколько уроков и заданий за месяц ─────────────────────
  "26 уроков · 20 заданий за месяц": ["Oyiga 26 dars · 20 topshiriq", "26 lessons · 20 tasks this month"],
  "24 урока · 18 заданий за месяц": ["Oyiga 24 dars · 18 topshiriq", "24 lessons · 18 tasks this month"],
  "22 урока · 16 заданий за месяц": ["Oyiga 22 dars · 16 topshiriq", "22 lessons · 16 tasks this month"],
  "20 уроков · 15 заданий за месяц": ["Oyiga 20 dars · 15 topshiriq", "20 lessons · 15 tasks this month"],
  "18 уроков · 12 заданий за месяц": ["Oyiga 18 dars · 12 topshiriq", "18 lessons · 12 tasks this month"],

  // ── Карточка предмета ────────────────────────────────────────────────────
  "Геометрия": ["Geometriya", "Geometry"],
  "Контрольная «Дроби и проценты»": ["«Kasrlar va foizlar» nazorat ishi", "«Fractions and percentages» test"],
  "сегодня, 10:42": ["bugun, 10:42", "today, 10:42"],
  "26 июля, 10:00": ["26-iyul, 10:00", "26 July, 10:00"],
  "2 часа назад": ["2 soat oldin", "2 hours ago"],

  // ── Лента уведомлений ────────────────────────────────────────────────────
  // Плейсхолдеры {name}, {suf} и {sum} остаются в переводах там, где нужны;
  // {suf} в узбекском и английском не ставим — рода там нет.
  "Оценка 5 по математике": ["Matematikadan 5 baho", "Grade 5 in maths"],
  "Контрольная «Дроби и проценты» — отличный результат": ["«Kasrlar va foizlar» nazorat ishi — a'lo natija", "«Fractions and percentages» test — an excellent result"],
  "Новое домашнее задание": ["Yangi uyga vazifa", "New homework"],
  "Английский язык: эссе «My Summer» — срок завтра, 18:00": ["Ingliz tili: «My Summer» inshosi — muddati ertaga, 18:00", "English: «My Summer» essay — due tomorrow, 18:00"],
  "Выставлен счёт за август": ["Avgust uchun hisob chiqarildi", "August invoice issued"],
  "Обучение · {name} — {sum} сум, оплатить до 5 августа": ["O'qish · {name} — {sum} so'm, 5-avgustgacha to'lang", "Tuition · {name} — {sum} UZS, due 5 August"],
  "Объявление школы": ["Maktab e'loni", "School announcement"],
  "Родительское собрание 30 июля в 18:00, актовый зал": ["30-iyul soat 18:00 da ota-onalar yig'ilishi, yig'ilishlar zali", "Parent meeting on 30 July at 18:00, assembly hall"],
  "Обед 22 июля успешно оплачен · баланс 185 000 сум": ["22-iyuldagi tushlik to'landi · balans 185 000 so'm", "Lunch on 22 July paid · balance 185,000 UZS"],
  "Отсутствие 21 июля": ["21-iyulda kelmagan", "Absence on 21 July"],
  "{name} отсутствовал{suf} без уважительной причины": ["{name} sababsiz kelmadi", "{name} was absent without a valid reason"],

  // ── Активные сессии ──────────────────────────────────────────────────────
  "Ташкент · IP 84.54.72.11": ["Toshkent · IP 84.54.72.11", "Tashkent · IP 84.54.72.11"],
  "Вход выполнен: 23 июля, 09:14": ["Kirish: 23-iyul, 09:14", "Signed in: 23 July, 09:14"],
  "Планшет · Ташкент · вчера, 20:15": ["Planshet · Toshkent · kecha, 20:15", "Tablet · Tashkent · yesterday, 20:15"],
  "Браузер · Ташкент · 21 июля, 14:02": ["Brauzer · Toshkent · 21-iyul, 14:02", "Browser · Tashkent · 21 July, 14:02"],
  "Телефон · Ташкент · 18 июля, 08:44": ["Telefon · Toshkent · 18-iyul, 08:44", "Phone · Tashkent · 18 July, 08:44"],

  // ── О приложении ─────────────────────────────────────────────────────────
  "Версия 1.0.0": ["Versiya 1.0.0", "Version 1.0.0"],
  "Версия 0.9.2": ["Versiya 0.9.2", "Version 0.9.2"],
  "Версия 0.9.0": ["Versiya 0.9.0", "Version 0.9.0"],
  "1.0.0 (сборка 214)": ["1.0.0 (build 214)", "1.0.0 (build 214)"],
  "23 июля 2026": ["2026-yil 23-iyul", "23 July 2026"],
  "г. Ташкент, ул. Мирзо-Улугбекская, 21": ["Toshkent sh., Mirzo Ulug'bek ko'chasi, 21", "Tashkent, Mirzo Ulugbek St. 21"],
  "© 2026 SNR International School. Все права защищены.": ["© 2026 SNR International School. Barcha huquqlar himoyalangan.", "© 2026 SNR International School. All rights reserved."],
};

/** Перевести одну строку. Нет перевода — остаётся русская. */
export function tr(value: string, locale: Locale): string {
  if (locale === "ru") return value;
  const pair = DEMO_TR[value];
  if (!pair) return value;
  return (locale === "uz" ? pair[0] : pair[1]) || value;
}

/**
 * Перевести всё содержимое структуры: строки внутри объектов, массивов и
 * кортежей. Переводится только то, что есть в таблице, — идентификаторы,
 * цвета, пути иконок и ключи остаются как были, потому что в таблицу не
 * попадали.
 */
export function trDeep<T>(value: T, locale: Locale): T {
  if (locale === "ru") return value;
  if (typeof value === "string") return tr(value, locale) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => trDeep(v, locale)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trDeep(v, locale);
    return out as unknown as T;
  }
  return value;
}
