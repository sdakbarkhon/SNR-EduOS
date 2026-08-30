/* Промт МОБ-1 — родительские агрегаты, которых не было ни на вебе, ни в
 * мобилке (getMyChildren в apps/mobile-parent дублировал web'овский
 * parent-context; здесь — общая версия для обоих). RLS уже скоупит
 * parents/parent_students/students по auth.uid(), поэтому все функции
 * читают текущего пользователя сами (как getMyNotifications/getMyThreadSummaries),
 * без параметра parentId. */
import type { Db } from "../supabase/factory";
import type { AttendanceStatus, LessonStatus, LessonWithSubject } from "../types";
import { findNextLesson } from "../presenters/lessonNow";
import { countsTowardAverage, testGrade5, type GradeSource } from "../utils/gradeAverage";

// Тот же select, что LESSON_SUBJECT_SELECT в index.ts — не импортируем оттуда
// напрямую, чтобы не создавать циклическую зависимость index.ts <-> parent.ts
// (index.ts делает `export * from "./parent"`).
const DAILY_LESSON_SELECT =
  "id, group_id, title, topic, starts_at, ends_at, duration_minutes, room, status, " +
  "subject:subjects(id, name, icon, color), " +
  "group:groups!inner(id, name, teacher:teachers!groups_teacher_id_fkey(id, full_name, avatar_url))";

export type ParentChildSummary = {
  id: string;
  fullName: string;
  className: string | null;
  groupId: string | null;
  /**
   * Дата рождения, YYYY-MM-DD, или null.
   *
   * 27.08.2026: колонка students.birth_date в схеме ЕСТЬ и заполнена у части
   * учеников — её просто никто не запрашивал. Мобильный профиль ребёнка из-за
   * этого подставлял дату из фикстуры, и настоящий родитель видел чужой день
   * рождения как день рождения своего ребёнка. Пусто — значит школа её не
   * заполнила, и показывать строку на экране нечем.
   */
  birthDate: string | null;
  // ПОЛЯ curatorName ЗДЕСЬ БОЛЬШЕ НЕТ (30.08.2026).
  //
  // Оно прожило один день: 29.08 переехало со students.curator_id на
  // groups.teacher_id, 30.08 роль куратора убрана из продукта целиком.
  // Миграция 242 обнулила обе колонки и удалила единственного куратора,
  // 243 снимет правила доступа и триггеры.
  //
  // Колонку students.curator_id мы не удаляли: её читает замороженное
  // ученическое приложение (apps/mobile). Оно покажет прочерк — ожидаемо.
  /**
   * Пол ученика: students.gender, миграция 232. Значения «male»/«female»
   * или null, если школа не заполнила.
   *
   * Сужается здесь, а не у читателя: в базе это text с CHECK, и типы
   * знают о нём только как о строке. Всё, что не «male»/«female», —
   * null: показывать «пол: xyz» хуже, чем не показывать строку вовсе.
   */
  gender: "male" | "female" | null;
  /** Номер личного дела: students.file_no, миграция 232. */
  fileNo: string | null;
  /** Телефон самого ученика: students.phone. Колонка была всегда. */
  phone: string | null;
  /**
   * Аллергия и медицинские особенности — public.student_medical,
   * миграция 232, ОТДЕЛЬНАЯ таблица.
   *
   * Почему не колонки в students: их видят только админ школы и родитель
   * этого ребёнка. Учитель читает students целиком, а построчные правила
   * Postgres пускают строку со ВСЕМИ колонками — спрятать две из них от
   * одной роли в Supabase нечем (все вошедшие делят роль authenticated).
   * Поэтому отдельная таблица со своим правилом чтения.
   *
   * Запрос ниже ходит под ключом родителя, не служебным, — правило
   * доступа обойти он не может: чужому ребёнку вернётся ноль строк.
   */
  allergies: string | null;
  medicalNotes: string | null;
};

export type ParentContext = {
  parentId: string;
  parentName: string;
  parentPhone: string | null;
  /**
   * Почта родителя или null.
   *
   * 28.08.2026: в public.parents НЕТ колонки email — есть google_email и
   * apple_email, обе заводит администратор для входа вместо кода из SMS
   * (миграция 201). Экран «Данные родителя» в мобильном показывал вместо
   * них выдуманный адрес из заготовки. Берём ту, что заполнена: Google
   * первой, потому что вход через Apple ещё не сделан.
   */
  parentEmail: string | null;
  /**
   * Название школы родителя (schools.name) или null.
   *
   * 27.08.2026: профиль ребёнка в мобильном показывал строку «Школа» с
   * зашитым в вёрстку «SNR International School» — названием из макета.
   * Настоящая школа называется иначе, и родитель читал подпись как правду.
   * Читается ОТДЕЛЬНЫМ запросом, а не вложением в students: вложение с
   * неверно угаданным именем связи роняет весь контекст родителя разом,
   * а отдельный запрос в худшем случае вернёт пусто, и строки просто не
   * будет. Правило доступа своё: политика «authenticated reads own school»
   * (миграция 190) пускает по current_school_id(), а туда родитель входит
   * с миграции 82.
   */
  schoolName: string | null;
  /**
   * Контакты школы — schools.phone / email / address.
   *
   * 29.08.2026: в профиле ребёнка эти три строки были вписаны в вёрстку
   * («+998 71 200-40-40», «info@snr-school.uz», «г. Ташкент, ул.
   * Мустакиллик, 45») — значения из макета, а не из базы. Колонки есть
   * давно; заполняет их суперадмин в карточке школы. Пусто — строки нет.
   *
   * Едут тем же запросом, что название и признак демо: лишнего похода
   * в базу за тремя подписями не заводим.
   */
  schoolPhone: string | null;
  schoolEmail: string | null;
  schoolAddress: string | null;
  /**
   * Школа помечена как демонстрационная (schools.is_demo).
   *
   * Нужен мобильному приложению, чтобы НЕ восстанавливать демо-вход при
   * запуске. Демо-гость получает место в аренду на час; если после
   * перезапуска молча вернуть его в приложение по сохранённой сессии,
   * аренда уже может быть отдана другому, а человек будет считать, что он
   * всё ещё в демо. Настоящий родитель восстанавливается всегда.
   */
  schoolIsDemo: boolean;
  children: ParentChildSummary[];
};

type StudentGroupsRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  file_no: string | null;
  phone: string | null;
  student_groups: {
    group_id: string;
    groups: { name: string } | null;
  }[] | null;
};

/** Пол из базы — только два принимаемых значения, всё прочее null. */
function readGender(raw: string | null | undefined): "male" | "female" | null {
  return raw === "male" || raw === "female" ? raw : null;
}

/** Пустая строка — это отсутствие значения, а не значение. Иначе на
 *  экране появляется графа с пустотой, а её быть не должно. */
function textOrNull(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return v.length > 0 ? v : null;
}

/** Родитель (текущая сессия) + его дети, в порядке привязки (parent_students.created_at ASC). */
export async function getParentContext(db: Db): Promise<ParentContext | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data: parent, error: parentErr } = await db
    .from("parents")
    .select("id, full_name, phone, school_id, google_email, apple_email")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (!parent) return null;

  // Название школы. Ошибку НЕ бросаем: если правило доступа не пустит или
  // школа не проставлена, профиль ребёнка просто не покажет строку «Школа»
  // — это лучше, чем уронить весь экран из-за подписи.
  const parentEmail = parent.google_email ?? parent.apple_email ?? null;

  let schoolName: string | null = null;
  let schoolIsDemo = false;
  let schoolPhone: string | null = null;
  let schoolEmail: string | null = null;
  let schoolAddress: string | null = null;
  if (parent.school_id) {
    const { data: school } = await db
      .from("schools")
      .select("name, is_demo, phone, email, address")
      .eq("id", parent.school_id)
      .maybeSingle();
    const row = school as {
      name: string; is_demo: boolean | null;
      phone: string | null; email: string | null; address: string | null;
    } | null;
    schoolName = row?.name ?? null;
    schoolIsDemo = row?.is_demo === true;
    schoolPhone = textOrNull(row?.phone);
    schoolEmail = textOrNull(row?.email);
    schoolAddress = textOrNull(row?.address);
  }

  const { data: links, error: linksErr } = await db
    .from("parent_students")
    .select("student_id, created_at")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (linksErr) throw linksErr;

  const studentIds = ((links ?? []) as { student_id: string }[]).map((l) => l.student_id);
  if (studentIds.length === 0) {
    return {
      parentId: parent.id,
      parentName: parent.full_name,
      parentPhone: parent.phone,
      parentEmail,
      schoolName,
      schoolPhone,
      schoolEmail,
      schoolAddress,
      schoolIsDemo,
      children: [],
    };
  }

  const { data: students, error: studentsErr } = await db
    .from("students")
    // 30.08.2026 — из выборки убрана связь
    // teacher:teachers!groups_teacher_id_fkey: она тянулась ради строки
    // «Классный руководитель», а роль куратора убрана из продукта.
    .select(
      "id, full_name, birth_date, gender, file_no, phone,"
      + " student_groups(group_id, groups(name))",
    )
    .in("id", studentIds);
  if (studentsErr) throw studentsErr;

  // Медкарта — отдельным запросом к отдельной таблице (см. пояснение у
  // полей allergies/medicalNotes). Ошибку НЕ бросаем: если правило
  // доступа не пустит, профиль просто не покажет две строки, а весь
  // контекст родителя из-за них падать не должен.
  const { data: medical } = await db
    .from("student_medical")
    .select("student_id, allergies, medical_notes")
    .in("student_id", studentIds);
  const medById = new Map<string, { allergies: string | null; medical_notes: string | null }>(
    ((medical ?? []) as unknown as Array<{
      student_id: string; allergies: string | null; medical_notes: string | null;
    }>).map((m) => [m.student_id, m]),
  );

  const byId = new Map<string, ParentChildSummary>(
    // Через unknown: сгенерированный Database-тип не знает про алиас связи
    // teacher:teachers!groups_teacher_id_fkey, и supabase-js типизирует ответ
    // как ошибку строкой.
    ((students ?? []) as unknown as StudentGroupsRow[]).map((s) => {
      const sg = (s.student_groups ?? [])[0] ?? null;
      const className = sg?.groups?.name ?? null;
      const med = medById.get(s.id);
      return [s.id, {
        id: s.id,
        fullName: s.full_name,
        className,
        groupId: sg?.group_id ?? null,
        birthDate: s.birth_date ?? null,
        gender: readGender(s.gender),
        fileNo: textOrNull(s.file_no),
        phone: textOrNull(s.phone),
        allergies: textOrNull(med?.allergies),
        medicalNotes: textOrNull(med?.medical_notes),
      }];
    }),
  );

  return {
    parentId: parent.id,
    parentName: parent.full_name,
    parentPhone: parent.phone,
    parentEmail,
    schoolName,
    schoolPhone,
    schoolEmail,
    schoolAddress,
    schoolIsDemo,
    children: studentIds.map((id) => byId.get(id)).filter((c): c is ParentChildSummary => Boolean(c)),
  };
}

export type ChildDailyStats = {
  arrivalTime: string | null; // ISO marked_at первой отметки "присутствовал" за день
  lessonsTotal: number;
  lessonsAttended: number;
  nextLesson: { subjectName: string; startsAt: string } | null;
};

/** Статистика ребёнка "на сегодня" (главный экран): во сколько пришёл,
 *  сколько уроков всего/посещено, следующий урок. dateStr — YYYY-MM-DD. */
export async function getChildDailyStats(db: Db, studentId: string, dateStr: string): Promise<ChildDailyStats> {
  const { data: groupRows, error: groupErr } = await db
    .from("student_groups")
    .select("group_id")
    .eq("student_id", studentId);
  if (groupErr) throw groupErr;
  const groupIds = ((groupRows ?? []) as { group_id: string }[]).map((r) => r.group_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: lessonsErr } = await (db as any)
    .from("lessons")
    .select(DAILY_LESSON_SELECT)
    .gte("starts_at", `${dateStr}T00:00:00+05:00`)
    .lte("starts_at", `${dateStr}T23:59:59+05:00`)
    .in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("starts_at");
  if (lessonsErr) throw lessonsErr;
  const lessons = (data ?? []) as LessonWithSubject[];
  const lessonIds = lessons.map((l) => l.id);

  let attendanceRows: Array<{ lesson_id: string; status: AttendanceStatus; marked_at: string | null }> = [];
  if (lessonIds.length > 0) {
    const { data, error } = await db
      .from("attendance")
      .select("lesson_id, status, marked_at")
      .eq("student_id", studentId)
      .in("lesson_id", lessonIds);
    if (error) throw error;
    attendanceRows = (data ?? []) as typeof attendanceRows;
  }

  const attended = attendanceRows.filter((r) => r.status === "present");
  const arrivalTime = attended
    .filter((r) => r.marked_at)
    .sort((a, b) => (a.marked_at! < b.marked_at! ? -1 : 1))[0]?.marked_at ?? null;

  // 07.08.2026: было `lessons.find(l => l.starts_at > new Date().toISOString())`
  // — РЕАЛЬНЫЕ часы, поэтому под заморозкой (29.07) родитель видел не тот урок,
  // что ученик и учитель. Плюс сравнение по времени само по себе неверно: в
  // проекте единственный источник истины для «сейчас/далее» — статус урока,
  // см. presenters/lessonNow.ts (там же объяснение, почему сравнение по
  // времени приводило к «Сейчас» сразу на нескольких уроках). Переходим на
  // тот же презентер — заодно исчезает нужда в параметре момента.
  const next = findNextLesson(lessons) ?? null;

  return {
    arrivalTime,
    lessonsTotal: lessons.length,
    lessonsAttended: attended.length,
    nextLesson: next ? { subjectName: next.subject?.name ?? next.title ?? "", startsAt: next.starts_at } : null,
  };
}

// Промт МОБ-7 (v7 "Статус дня") — та же основа, что DAILY_LESSON_SELECT, но
// с реальным учителем ПРЕДМЕТА (subjects.teacher_id), а не только куратором
// группы: разные предметы в один день у разных учителей, куратор — только
// fallback, если у предмета учитель не назначен.
const DAILY_STATUS_LESSON_SELECT =
  "id, group_id, title, topic, starts_at, ends_at, duration_minutes, room, status, " +
  "subject:subjects(id, name, icon, color, teacher:teachers!subjects_teacher_id_fkey(id, full_name)), " +
  "group:groups!inner(id, name, teacher:teachers!groups_teacher_id_fkey(id, full_name))";

export type DailyStatusLesson = {
  id: string;
  title: string;
  subjectName: string | null;
  startsAt: string;
  endsAt: string | null;
  room: string | null;
  teacherName: string | null;
  attendanceStatus: AttendanceStatus | null; // null = ещё не отмечено
  /** 07.08.2026 — статус САМОГО урока (scheduled/in_progress/completed).
   *  Запрос его и раньше выбирал, но маппинг терял, из-за чего родительские
   *  страницы вынужденно определяли «сейчас/далее» сравнением по времени —
   *  и расходились с учеником и учителем, которые идут по статусу
   *  (presenters/lessonNow.ts). Поле добавлено, чтобы все трое считали
   *  одинаково. Не путать с attendanceStatus выше — это посещаемость. */
  status: LessonStatus;
};

export type ChildDailyStatus = {
  isDayOff: boolean; // сегодня нет уроков у группы ребёнка
  lessons: DailyStatusLesson[];
  totalLessons: number;
  attendedCount: number;
  missedCount: number;
  gradesToday: { subjectName: string; grade: number }[];
  homeworkAssignedToday: number;
};

type DailyStatusLessonRow = {
  id: string; title: string | null; starts_at: string; ends_at: string | null; room: string | null; group_id: string;
  status: LessonStatus;
  subject: { id: string; name: string; teacher: { id: string; full_name: string } | null } | null;
  group: { id: string; name: string; teacher: { id: string; full_name: string } | null } | null;
};

/** Полный "Статус дня" ребёнка (v7): timeline уроков сегодня с посещаемостью
 *  + итоги дня (оценки, ДЗ). dateStr — YYYY-MM-DD, Asia/Tashkent. Клиент сам
 *  вычисляет "идёт сейчас / перемена / прошёл / впереди" по starts_at/ends_at
 *  и текущему времени (обновляется раз в 60с) — здесь только сырые данные. */
export async function getChildDailyStatus(db: Db, studentId: string, dateStr: string): Promise<ChildDailyStatus> {
  const { data: groupRows, error: groupErr } = await db
    .from("student_groups")
    .select("group_id")
    .eq("student_id", studentId);
  if (groupErr) throw groupErr;
  const groupIds = ((groupRows ?? []) as { group_id: string }[]).map((r) => r.group_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lessonRows, error: lessonsErr } = await (db as any)
    .from("lessons")
    .select(DAILY_STATUS_LESSON_SELECT)
    .gte("starts_at", `${dateStr}T00:00:00+05:00`)
    .lte("starts_at", `${dateStr}T23:59:59+05:00`)
    .in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("starts_at");
  if (lessonsErr) throw lessonsErr;
  const rawLessons = (lessonRows ?? []) as unknown as DailyStatusLessonRow[];
  const lessonIds = rawLessons.map((l) => l.id);

  let attendanceRows: Array<{ lesson_id: string; status: AttendanceStatus }> = [];
  if (lessonIds.length > 0) {
    const { data, error } = await db
      .from("attendance")
      .select("lesson_id, status")
      .eq("student_id", studentId)
      .in("lesson_id", lessonIds);
    if (error) throw error;
    attendanceRows = (data ?? []) as typeof attendanceRows;
  }
  const attendanceByLesson = new Map(attendanceRows.map((r) => [r.lesson_id, r.status]));

  const lessons: DailyStatusLesson[] = rawLessons.map((l) => ({
    id: l.id,
    title: l.title ?? l.subject?.name ?? "",
    subjectName: l.subject?.name ?? null,
    startsAt: l.starts_at,
    endsAt: l.ends_at,
    room: l.room,
    teacherName: l.subject?.teacher?.full_name ?? l.group?.teacher?.full_name ?? null,
    attendanceStatus: attendanceByLesson.get(l.id) ?? null,
    status: l.status,
  }));

  const attendedCount = lessons.filter((l) => l.attendanceStatus === "present").length;
  const missedCount = lessons.filter((l) => l.attendanceStatus === "absent_excused" || l.attendanceStatus === "absent_unexcused").length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gradeRows, error: gradesErr } = await (db as any)
    .from("lesson_grades")
    .select("grade, lesson:lessons!inner(subject:subjects(name))")
    .eq("student_id", studentId)
    .gte("graded_at", `${dateStr}T00:00:00+05:00`)
    .lte("graded_at", `${dateStr}T23:59:59+05:00`);
  if (gradesErr) throw gradesErr;
  const gradesToday = ((gradeRows ?? []) as unknown as Array<{ grade: number; lesson: { subject: { name: string } | null } | null }>)
    .map((r) => ({ subjectName: r.lesson?.subject?.name ?? "—", grade: r.grade }));

  let homeworkAssignedToday = 0;
  if (groupIds.length > 0) {
    const { count, error: hwErr } = await db
      .from("homework")
      .select("id", { count: "exact", head: true })
      .in("group_id", groupIds)
      .gte("created_at", `${dateStr}T00:00:00+05:00`)
      .lte("created_at", `${dateStr}T23:59:59+05:00`);
    if (hwErr) throw hwErr;
    homeworkAssignedToday = count ?? 0;
  }

  return {
    isDayOff: lessons.length === 0,
    lessons,
    totalLessons: lessons.length,
    attendedCount,
    missedCount,
    gradesToday,
    homeworkAssignedToday,
  };
}

export type ChildSubjectGrade = {
  subjectId: string;
  subjectName: string;
  icon: string | null;
  color: string | null;
  average: number;
  count: number;
};

export type ChildGradesSummary = {
  average: number | null;
  subjects: ChildSubjectGrade[];
  strengths: string[];
  growthAreas: string[];
};

/** Одна оценка ребёнка, приведённая к пятибалльной, с предметом и датой. */
export type ChildCountedGrade = {
  grade5: number;
  source: GradeSource;
  /** null у проектов: своего предмета у них нет, только сломанный текстовый слаг. */
  subjectId: string | null;
  subjectName: string | null;
  icon: string | null;
  color: string | null;
  /** День, к которому относится оценка. См. правило выбора даты ниже. */
  date: string | null;
};

type SubjectJoin = { id: string; name: string; icon: string | null; color: string | null } | null;

/**
 * ВСЕ оценки ребёнка, идущие в средний балл. 25.08.2026, заход 2.
 *
 * ЗАЧЕМ ОДИН СБОРЩИК. До этого захода родительские экраны читали ТОЛЬКО
 * `lesson_grades`: главная показывала 3.5, тогда как по всем работам того же
 * ребёнка выходило 4.2, а плитка «Знания» — 72 % вместо 83 %. Родитель не
 * видел двух третей оценок своего ребёнка. Собирать источники по месту в
 * каждой из трёх функций значило бы развести их снова, поэтому сбор один, и
 * зовут его сводка, экран предмета и дневник.
 *
 * ЧТО ВХОДИТ — решает `countsTowardAverage` из utils/gradeAverage, ЕДИНСТВЕННОЕ
 * место со списком источников. Оценки за этапы урока сюда не приходят вовсе:
 * их таблица не запрашивается.
 *
 * КАКАЯ ДАТА У ОЦЕНКИ. Дневник раскладывает оценки по дням, и дата нужна
 * каждой. Порядок: дата урока → дата выставления оценки → дата сдачи.
 * Первая ветвь сегодня не срабатывает никогда: `homework.lesson_id` заполнен
 * у НОЛЯ из 59 заданий, привязать работу к уроку нечем. Вторая закрывает
 * 310 сдач ДЗ из 440 и 104 теста из 120. Третья нужна оставшимся 146 строкам:
 * без неё 30 % оценок за работы молча выпали бы из дневника, и сумма по дням
 * перестала бы сходиться с суммой за неделю. `submitted_at` заполнен у всех
 * 560 строк, и ровно эту цепочку уже использует getStudentGrades.
 */
export async function getChildCountedGrades(db: Db, studentId: string): Promise<ChildCountedGrade[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const out: ChildCountedGrade[] = [];

  const [lgRes, hwRes, tsRes, prRes] = await Promise.all([
    db2.from("lesson_grades")
      .select("grade, graded_at, lesson:lessons!inner(starts_at, subject:subjects(id, name, icon, color))")
      .eq("student_id", studentId),
    db2.from("homework_submissions")
      .select("grade, graded_at, submitted_at, homework:homework!inner(lesson_id, subject:subjects(id, name, icon, color))")
      .eq("student_id", studentId).not("grade", "is", null),
    db2.from("test_submissions")
      .select("score, max_score, grade, graded_at, submitted_at, homework:homework!inner(lesson_id, subject:subjects(id, name, icon, color))")
      .eq("student_id", studentId).not("score", "is", null),
    db2.from("project_submissions")
      .select("grade, graded_at, submitted_at")
      .eq("student_id", studentId).not("grade", "is", null),
  ]);
  for (const res of [lgRes, hwRes, tsRes, prRes]) if (res.error) throw res.error;

  const push = (grade5: number | null, source: GradeSource, s: SubjectJoin, date: string | null) => {
    if (grade5 == null || !countsTowardAverage(source)) return;
    out.push({
      grade5,
      source,
      subjectId: s?.id ?? null,
      subjectName: s?.name ?? null,
      icon: s?.icon ?? null,
      color: s?.color ?? null,
      date,
    });
  };

  type LgRow = { grade: number; graded_at: string | null; lesson: { starts_at: string | null; subject: SubjectJoin } | null };
  for (const r of (lgRes.data ?? []) as LgRow[]) {
    push(r.grade, "lesson_grades", r.lesson?.subject ?? null, r.lesson?.starts_at ?? r.graded_at);
  }

  type HwRow = { grade: number | null; graded_at: string | null; submitted_at: string | null; homework: { subject: SubjectJoin } | null };
  for (const r of (hwRes.data ?? []) as HwRow[]) {
    push(r.grade, "homework_submissions", r.homework?.subject ?? null, r.graded_at ?? r.submitted_at);
  }

  type TsRow = { score: number | null; max_score: number | null; grade: number | null; graded_at: string | null; submitted_at: string | null; homework: { subject: SubjectJoin } | null };
  for (const r of (tsRes.data ?? []) as TsRow[]) {
    push(testGrade5(r), "test_submissions", r.homework?.subject ?? null, r.graded_at ?? r.submitted_at);
  }

  type PrRow = { grade: number | null; graded_at: string | null; submitted_at: string | null };
  for (const r of (prRes.data ?? []) as PrRow[]) {
    // Предмета у проекта нет — в разбивку по предметам он не попадёт, только
    // в общее среднее. Решение заказчика: пропускать молча, без «Прочего».
    push(r.grade, "project_submissions", null, r.graded_at ?? r.submitted_at);
  }

  return out;
}

/**
 * Оценки ребёнка по предметам.
 *
 * 25.08.2026 — читала ТОЛЬКО `lesson_grades`, теперь все четыре источника
 * (см. getChildCountedGrades). Предмет по-прежнему разрешается через
 * `subjects`, а не через устаревшее `groups.subject` (миграция 107).
 *
 * Проекты в разбивку по предметам не попадают — предмета у них нет; в общее
 * среднее идут. Поэтому сумма `count` по предметам может быть меньше числа
 * оценок, из которых сложилось `average`.
 */
export async function getChildGradesSummary(db: Db, studentId: string): Promise<ChildGradesSummary> {
  const rows = await getChildCountedGrades(db, studentId);
  const bySubject = new Map<string, { name: string; icon: string | null; color: string | null; sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;

  for (const r of rows) {
    overallSum += r.grade5;
    overallCount += 1;
    if (!r.subjectId || !r.subjectName) continue;
    const cur = bySubject.get(r.subjectId) ?? { name: r.subjectName, icon: r.icon, color: r.color, sum: 0, count: 0 };
    cur.sum += r.grade5;
    cur.count += 1;
    bySubject.set(r.subjectId, cur);
  }

  const subjects: ChildSubjectGrade[] = Array.from(bySubject.entries())
    .map(([id, v]) => ({ subjectId: id, subjectName: v.name, icon: v.icon, color: v.color, average: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.average - a.average);

  const average = overallCount > 0 ? overallSum / overallCount : null;
  const strengths = average != null ? subjects.filter((s) => s.average >= average).slice(0, 3).map((s) => s.subjectName) : [];
  const growthAreas = average != null ? subjects.filter((s) => s.average < average).slice(-3).map((s) => s.subjectName) : [];

  return { average, subjects, strengths, growthAreas };
}

export type GroupSubjectTeacher = {
  subjectId: string;
  subjectName: string;
  icon: string | null;
  color: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

/** Промт МОБ-6 — все предметы группы ребёнка со своими учителями (для блока
 *  "Предметы и учителя" в полном профиле ребёнка). Один запрос на всю группу,
 *  а не по одному на предмет (в отличие от getChildSubjectDetail, который
 *  резолвит ровно один предмет для экрана деталей). */
export async function getGroupSubjectTeachers(db: Db, groupId: string): Promise<GroupSubjectTeacher[]> {
  const { data, error } = await db
    .from("subjects")
    .select("id, name, icon, color, is_active, teacher:teachers!subjects_teacher_id_fkey(id, full_name)")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  type Row = { id: string; name: string; icon: string | null; color: string | null; teacher: { id: string; full_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    icon: s.icon,
    color: s.color,
    teacherId: s.teacher?.id ?? null,
    teacherName: s.teacher?.full_name ?? null,
  }));
}
