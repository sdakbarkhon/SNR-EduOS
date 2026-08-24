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
