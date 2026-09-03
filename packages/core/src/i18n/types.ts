import type { StatusKey } from "../presenters/status";

export type Locale = "ru" | "uz" | "en";

/**
 * Структура словаря. Переводы наполняются постепенно; структура — сразу (ru приоритет).
 * Все три языка обязаны реализовать этот интерфейс целиком.
 */
export interface Dictionary {
  common: {
    appName: string;
    save: string;
    cancel: string;
    loading: string;
    error: string;
    retry: string;
    back: string;
    none: string;
    today: string;
    week: string;
    minutes: string;
    seconds: string;
    download: string;
    loggingOut: string; // "Выход из системы..." — полноэкранный оверлей при клике "Выйти"
    /** «+ ещё {n}» — хвост перечисления, когда всё не влезает. */
    andMore: string;
  };
  status: Record<StatusKey, string>;
  nav: {
    home: string;
    lessons: string;
    homework: string;
    attendance: string;
    materials: string;
    books: string;
    projects: string;
    aiAssistant: string;
    payments: string;
    grades: string;
    profile: string;
    settings: string;
    notifications: string;
    achievements: string; // stub — Iter5 P4
    clubs: string;        // stub — Iter5 P4
    messages: string;     // stub — Iter5 P5
    myLevel: string;      // sidebar level-card stub — Iter5 P5
    knowledgeBase: string; // "База знаний" — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1, replaces materials+books in the sidebar
  };
  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3 — merged "Материалы" + "Библиотека" page and the
  // Windows-explorer-style file picker used to attach an existing file to a
  // lesson/assignment instead of uploading a fresh copy.
  knowledgeBase: {
    title: string;            // "База знаний"
    tabLibrary: string;       // "Библиотека" (books)
    tabGroupMaterials: string; // "Материалы группы" (course_materials)
    // 6А, Заход C — третья вкладка пикера: teacher_library_materials
    // (migration 147). Отдельная от tabLibrary (та — books), чтобы не
    // повторять один и тот же ярлык "Библиотека" дважды в одном пикере.
    tabTeacherLibrary: string; // "Библиотека учителей"
    pickerTitle: string;       // "Выбор файла"
    searchPlaceholder: string; // "Поиск по названию"
    select: string;            // "Выбрать"
    selectCount: string;       // "Выбрать ({n})"
    cancel: string;
    noResults: string;
    loadError: string;         // "Не удалось загрузить список" — per-tab, не путать с noResults
    browse: string;            // "Выбрать из базы знаний" — button that opens the picker
  };
  // Промт 4 — учебные планы (curriculum_plans, migration 116).
  curriculum: {
    replaceConfirm: string;
    fromBookBtn: string;
    fromBookTitle: string;
    fromBookSubtitle: string;
    fromBookPick: string;
    fromBookNoBooks: string;
    fromBookNoFile: string;
    fromBookStart: string;
    fromBookStarting: string;
    fromBookBadge: string;
    fromBookCost: string;
    stageQueued: string;
    stageDownload: string;
    stageExtract: string;
    stageOutline: string;
    stageModel: string;
    stageSave: string;
    previewTitle: string;
    previewHint: string;
    previewAccept: string;
    previewAccepting: string;
    previewReject: string;
    previewRejecting: string;
    previewRejectConfirm: string;
    previewTopicCount: string;
    title: string;              // "Учебные планы"
    uploadPlan: string;         // "Загрузить учебный план"
    parseWithAi: string;        // "Распарсить AI"
    topicFromPlan: string;      // "Тема из плана"
    enterCustomTopic: string;   // "Ввести свою тему"
    planExistsWarning: string;  // "План уже существует. Заменить?"
    errorPdfDocxOnly: string;   // "Разрешены только PDF и DOCX файлы"
    errorFileTooLarge: string;  // "Файл больше 20 МБ"
    errorParseFailed: string;   // "Не удалось распарсить план"
    // 19.08.2026 — подписи экранов учебного плана, вынесенные из кода.
    cancel: string;
    confirmFailed: string;
    createLessonFailed: string;
    // Три шага работы с планом (02.09.2026, пункты 13 и 14).
    stepsHeading: string;
    step1Title: string;
    step1Hint: string;
    step1From: string;
    step1NoTopics: string;
    step1Done: string;
    step2Title: string;
    step2Locked: string;
    step2Hint: string;
    step2Empty: string;
    step2Filled: string;
    step2Counts: string;
    step2Open: string;
    // Очередь наполнения (миграция 247, заход Q1).
    step2Queued: string;
    step2Running: string;
    step2Failed: string;
    step2Enqueue: string;
    step2PickFirst: string;
    step2BatchLine: string;
    step2Drain: string;              // «Разобрать очередь» (заход Q2)
    step2Draining: string;
    step2DrainHint: string;
    step2DrainDone: string;          // «Наполнен урок: … (осталось N)»
    step2DrainEmpty: string;
    step2DrainFailed: string;
    // Отмена, повтор и причина отказа (миграция 248, заход Q4).
    step2BatchCanceled: string;
    step2Canceled: string;
    step2Cancel: string;
    step2Canceling: string;
    step2CancelDone: string;
    step2CancelRunning: string;
    step2CancelNone: string;
    step2Retry: string;
    step2Retrying: string;
    step2RetryDone: string;
    step2RetryNone: string;
    step2ErrorLabel: string;
    step2Enqueued: string;
    step2Skipped: string;
    step2RefillTitle: string;
    step2RefillBody: string;
    step2RefillNone: string;
    step2Enqueuing: string;
    step3Title: string;
    step3Hint: string;
    step3PickFirst: string;
    step3Delete: string;
    step3SelectAll: string;
    step3ClearAll: string;
    step3ConfirmTitle: string;
    step3ConfirmLessons: string;
    step3ConfirmNoLessons: string;
    step3Partial: string;
    deleteTopicFailed: string;
    deleteTopicSubmit: string;
    deleteTopicTitle: string;
    deleteTopicUsedNote: string;
    deleting: string;
    errorTitle: string;
    fieldGroup: string;
    fieldPlanFile: string;
    fieldSubject: string;
    fromBookFailed: string;
    fromBookNetworkError: string;
    fromBookSizeMb: string;
    listEmpty: string;
    networkError: string;
    noResults: string;
    pickFileBtn: string;
    processingHint: string;
    processingTitle: string;
    readOnlyOtherTeacher: string;
    readyClose: string;
    readyDescError: string;
    readyDescOk: string;
    readyErrorTitle: string;
    readyFallbackTitle: string;
    readyOpen: string;
    readyTitle: string;
    renameFailed: string;
    reorderFailed: string;
    replace: string;
    replaceNote: string;
    replacing: string;
    retry: string;
    retryFailed: string;
    retrying: string;
    saveError: string;
    searchPlaceholder: string;
    selectGroupPlaceholder: string;
    selectSubjectPlaceholder: string;
    topicLessonCreated: string;
    topicLessonNotCreated: string;
    topicWordFew: string;
    topicWordMany: string;
    topicWordOne: string;
    uploadHint: string;
    uploading: string;
  };
  auth: {
    googleDemoSchool: string;
    googleNotLinked: string;
    googleNoAccount: string;
    googleSchoolArchived: string;
    googleWrongSchool: string;
    googleFailed: string;
    withGoogle: string;
    chooseSchoolSearch: string;
    chooseSchoolNotFound: string;
    chooseSchoolTitle: string;
    chooseSchoolSubtitle: string;
    chooseSchoolLoading: string;
    chooseSchoolNone: string;
    chooseSchoolSkip: string;
    chooseSchoolSkipHint: string;
    chooseSchoolChange: string;
    chooseSchoolLabel: string;
    wrongSchool: string;
    wrongSchoolNamed: string;
    title: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    rememberMe: string;
    submit: string;
    forgot: string;
    invalid: string;
    sessionReplaced: string;
    /** Z.2.10 — выбор школы при совпадении логина. */
    pickSchoolTitle: string;
    backBtn: string; // single-session: «Вход выполнен с другого устройства»
    tagline: string;
    // Iter5 P1 — Stitch login redesign
    signingIn: string;    // "Вход..."
    // Iter5 hotfix P14.1 — phase-2 button text while router transition is pending (after auth succeeds, before navigation completes)
    enteringApp: string;  // "Входим..."
    orLoginWith: string;  // "Или войдите через"
    comingSoon: string;   // placeholder toast for OAuth/forgot-password
    rightsReserved: string; // "Все права защищены."
    showPassword: string; // aria-label
    hidePassword: string; // aria-label
    features: {
      learn: string; learnDesc: string;
      grow: string; growDesc: string;
      connect: string; connectDesc: string;
      create: string; createDesc: string;
    };
    security: {
      title: string;    // "Безопасно. Надёжно. Современное."
      subtitle: string; // "Ваши данные под защитой."
    };
    // Компактные кнопки «Скачать приложение» в футере /login — сторов ещё нет,
    // кнопки активны, клик показывает notice (см. LoginForm.showNotice паттерн),
    // никаких переходов по ссылкам.
    mobileApps: {
      android: string;           // "Скачать из Google Play"
      ios: string;                // "Скачать из App Store"
      androidComingSoon: string; // "Приложение скоро появится в Google Play"
      iosComingSoon: string;     // "Приложение скоро появится в App Store"
    };
  };
  dashboard: {
    greeting: string; // "Привет, {name}! 👋"
    nextLesson: string;
    noNextLesson: string;
    myTasks: string;
    activeTasks: string; // "{count} активных"
    weekProgress: string;
    factOfDay: string;
    mySubjects: string;
    recentMaterials: string;
    room: string;
    // Iter5 P4 — Stitch dashboard redesign
    greetings: string[];       // 10 rotating subtitle phrases, one per day-of-year
    learnMore: string;         // "Узнать больше" (fact-of-day card)
    quickActions: string;      // "Быстрые действия"
    qaHomework: string;        // "Моё задание"
    qaFiles: string;           // "База знаний" (ведёт на /knowledge-base, тот же раздел, что nav.knowledgeBase)
    qaTeacher: string;         // "Связь с учителем" (stub)
    qaAI: string;              // "Спросить AI"
    myProgress: string;        // "Мой прогресс"
    progressStatDone: string;      // "Сдано" — подпись цифры сдано/всего у кольца
    progressStatRemaining: string; // "Осталось" — подпись цифры несданных заданий
    streakEmpty: string;           // "Пока нет данных о посещаемости" — пустое состояние серии успехов
    progressAllTime: string;   // "Выполнено заданий" — доля сдано/выдано за всё время (было "Всего за неделю", считалось по lesson_stages — заменено на homework-based расчёт)
    progressModalDoneOf: string;  // "{done} из {total}"
    progressModalAvgGrade: string; // "Средний балл"
    progressModalNoGrades: string; // "—" когда нет оценённых сдач
    progressModalTotal: string;    // "Итого"
    progressModalEmpty: string;    // "Нет заданий" (0 assigned for this subject)
    seeAll: string;            // "Смотреть все" (subjects card)
    todaySchedule: string;     // "Расписание на сегодня"
    noLessonsToday: string;
    fullSchedule: string;      // "Всё расписание"
    now: string;               // "Сейчас" (active-lesson chip)
    next: string;              // "Скоро" (upcoming within 15 min)
    finished: string;          // "Завершён" (past lesson today)
    myAchievements: string;    // "Мои достижения"
    allAchievements: string;   // "Все" (stub)
    nextReward: string;        // "До следующей награды"
    // Iter5 P9 — CD dashboard v2 redesign
    streakTitle: string;       // "Серия успехов"
    streakDays: string;
    /** Подпись под числом серии — «не разорви цепочку». */
    streakKeepGoing: string;        // "{n} дней подряд!"
    goalsTitle: string;        // "Ты на пути к новым вершинам!"
    goalsSubtitle: string;     // "Ещё немного, и ты получишь новую награду 🏆"
    viewGoals: string;         // "Смотреть цели" (stub)
    // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 2.4 — full per-class subject catalog section
    classSubjectsTitle: string; // "Предметы класса"
    subjectComingSoon: string;  // "Скоро появится" (toast on stub subject click)
    subjectModalTeacher: string; // "Учитель" (SubjectDetailModal field label)
    subjectModalClass: string;   // "Класс" (SubjectDetailModal field label)
  };
  schedule: {
    title: string;
    today: string;
    week: string;
    allSubjects: string;
    upcomingEvents: string;
    room: string;
    teacher: string;
    online: string;
    noLessons: string;
    // new in iter3-p2b
    tabToday: string;
    tabWeek: string;
    todayNoLessons: string;
    nextLessons: string;
    scheduleEmpty: string;
    scheduleEmptyHint: string;
    prevWeek: string;
    nextWeek: string;
    thisWeek: string;
    dayNoLessons: string;
    statusScheduled: string;
    statusInProgress: string;
    statusCompleted: string;
    // Iter5 P5 — Stitch lessons page redesign
    greetingSub: string;      // "Готов к новым знаниям?"
    weekHeading: string;      // "Расписание на неделю"
    weekSub: string;          // "Будь в ритме и всё успевай!"
    next: string;             // "Далее" (upcoming-lesson badge)
    weekend: string;          // "Выходной"
    viewWeek: string;         // "Посмотреть неделю" (empty-today CTA)
    nextLessonIn: string;     // "Не пропусти! Твой следующий урок через {time}."
    allDoneToday: string;     // "На сегодня всё! Отличная работа 👏"
    myAssignments: string;    // "Мои задания" (banner button)
    planLearnAchieve: string; // week-mode banner motto
    minShort: string;         // "мин"
    hourShort: string;        // "ч"
  };
  attendance: {
    title: string;
    overall: string;
    bySubject: string;
    lowWarning: string;
    prevMonth: string;
    nextMonth: string;
    kpiOverall: string;
    kpiDays: string;
    kpiMissed: string;
    kpiPresent: string;
    kpiExcused: string;
    kpiUnexcused: string;
    kpiTotal: string;
    daysUnit: string;
    lessonsUnit: string;
    calendarTitle: string;
    legendPresent: string;
    legendAbsent: string;
    legendLate: string;
    legendExcused: string;
    legendUnexcused: string;
    statusPresent: string;
    statusExcused: string;
    statusUnexcused: string;
    periodMonth: string;
    periodSemester: string;
    periodYear: string;
    lessonListTitle: string;
    bySubjectTitle: string;
    empty: string;
    // new keys for redesigned UI
    kpiAbsent: string;
    kpiPercentage: string;
    filterSubject: string;
    filterAllSubjects: string;
    filterMonth: string;
    calendarLegendPresent: string;
    calendarLegendExcused: string;
    calendarLegendAbsent: string;
    calendarLegendNone: string;
    // teacher attendance
    teacherTitle: string;
    teacherGroupLabel: string;
    teacherAllGroups: string;
    teacherAvgPct: string;
    teacherMatrixEmpty: string;
    teacherLegendPresent: string;
    teacherLegendAbsent: string;
    teacherLegendNone: string;
  };
  admin: {
    googleBlockTitle: string;
    googleBlockHint: string;
    fieldGoogleEmailAny: string;
    fieldGoogleEmailHint: string;
    anAiTitle: string;
    anAiHint: string;
    anAiLoading: string;
    anAiRefresh: string;
    anAiGenerated: string;
    anAiFailed: string;
    anAiLittle: string;
    anAiShow: string;
    navAnalytics: string;
    anTitle: string;
    anSubtitle: string;
    anOverall: string;
    anAvgGrade: string;
    anAttendance: string;
    anSubmitted: string;
    anOverdue: string;
    anVsPrev: string;
    anNoPrev: string;
    anGradesCount: string;
    anStudents: string;
    anExcellent: string;
    anAtRisk: string;
    anMoved: string;
    anRiskGrades: string;
    anRiskAttendance: string;
    anRiskOverdue: string;
    anTooLittle: string;
    anTooLittleHint: string;
    anImproved: string;
    anWorsened: string;
    anGroups: string;
    anSubjects: string;
    anColName: string;
    anColGroup: string;
    anColAvg: string;
    anColAttendance: string;
    anColGrades: string;
    anColStudents: string;
    anColRisks: string;
    anColTrend: string;
    anFilterPeriod: string;
    anFilterGroup: string;
    anFilterSubject: string;
    anAllGroups: string;
    anAllSubjects: string;
    anPeriod30: string;
    anPeriod90: string;
    anPeriodAll: string;
    anExport: string;
    anEmpty: string;
    anNoData: string;
    anFormulaTitle: string;
    anFormulaAvg: string;
    anFormulaAttendance: string;
    anFormulaOverdue: string;
    anFormulaRisk: string;
    anFormulaTrend: string;
    anFormulaToday: string;
    greeting: string;
    profileSchoolLogo: string;
    hints: {
      dashboard: string;
      subjects: string;
      teachers: string;
      groups: string;
      assignments: string;
      students: string;
      parents: string;
      announcements: string;
      marks: string;
      profile: string;
      chats: string;
      support: string;
    };
    title: string;
    navDashboard: string;
    navStudents: string;
    navTeachers: string;
    navGroups: string;
    navSubjects: string;
    navAssignments: string;
    navAnnouncements: string;
    navParents: string;
    navProfile: string;
    navChats: string;
    navRag: string;
    navSupport: string;
    // Раздел «Поддержка» — рабочий ящик админа, обращения родителей.
    supportTitle: string;
    supportSubtitle: string;
    supportEmptyTitle: string;
    supportEmptyText: string;
    supportNoMessages: string;
    supportPickThread: string;
    supportReplyPlaceholder: string;
    supportSendBtn: string;
    supportSending: string;
    supportRoleAdmin: string;
    supportRoleParent: string;
    ragTitle: string;
    ragSubtitle: string;
    ragQueued: string;
    ragIndexed: string;
    ragStuck: string;
    ragStuckNote: string;
    ragRun: string;
    ragRunning: string;
    ragProgress: string;
    ragDone: string;
    ragFailed: string;
    ragEmpty: string;
    ragNote: string;
    navMarks: string;
    // Заход «замок 15 минут» — правка запертых оценок администратором
    marks: {
      title: string;
      subtitle: string;
      search: string;
      allGroups: string;
      allSubjects: string;
      allKinds: string;
      kindLessonGrade: string;
      kindAttendance: string;
      kindHomework: string;
      kindTest: string;
      colStudent: string;
      colKind: string;
      colClass: string;
      colSubject: string;
      colDate: string;
      colValue: string;
      colAction: string;
      edit: string;
      empty: string;
      nothingFound: string;
      shown: string;
      editTitle: string;
      newValue: string;
      save: string;
      cancel: string;
      saved: string;
      failed: string;
      clear: string;
      attPresent: string;
      attExcused: string;
      attUnexcused: string;
    };
    // Пачка 7.20 — read-only chat viewer
    chats: {
      title: string;
      readOnly: string;
      filters: {
        type: string;
        teacher: string;
        group: string;
        dateRange: string;
      };
      types: {
        all: string;
        parentTeacher: string;
        teacherStudent: string;
        classGroup: string;
        lessonAiHelper: string;
      };
      emptyList: string;
      selectPrompt: string;
      messageCount: string; // "{count} сообщений"
    };
    // subjects
    subjectsTitle: string;
    subjectsSelectGroup: string;
    subjectsAdd: string;
    subjectsEdit: string;
    subjectsDeleteConfirm: string;
    subjectsDeleteWarning: string;
    subjectsName: string;
    subjectsTeacher: string;
    subjectsNotAssigned: string;
    subjectsEmpty: string;
    subjectsIcon: string;
    subjectsColor: string;
    // Z.2.2 — справочник предметов + назначения
    subjectsCatalogHint: string;
    subjectsCatalogEmpty: string;
    subjectsHiddenBadge: string;
    subjectsHide: string;
    subjectsShow: string;
    subjectsUsageCount: string;
    subjectsUsageNone: string;
    subjectsRenameHint: string;
    groupsNoSubjectsYet: string;
    assignmentsTitle: string;
    assignmentsHint: string;
    assignmentsAdd: string;
    assignmentsEdit: string;
    assignmentsEmpty: string;
    assignmentsSubject: string;
    assignmentsPickSubject: string;
    assignmentsPickGroup: string;
    assignmentsCreateSubject: string;
    assignmentsCreateSubjectHint: string;
    assignmentsTeacherChatsHint: string;
    assignmentsAllGroups: string;
    assignmentsAllSubjects: string;
    assignmentsAllTeachers: string;
    assignmentsDeleteTitle: string;
    assignmentsDeleteConfirm: string;
    assignmentsDeleteWarning: string;
    // Массовое назначение: предмет(ы) × группы × один учитель. 03.09.2026.
    assignmentsBulk: string;
    assignmentsBulkTitle: string;
    assignmentsBulkHint: string;
    assignmentsBulkTeacher: string;
    assignmentsBulkSubjects: string;
    assignmentsBulkGroups: string;
    assignmentsBulkSelectAll: string;
    assignmentsBulkClear: string;
    assignmentsBulkNeedPick: string;
    assignmentsBulkCounting: string;
    assignmentsBulkRecount: string;
    assignmentsBulkPlanTitle: string;
    assignmentsBulkPlanCreate: string;
    assignmentsBulkPlanAssign: string;
    assignmentsBulkPlanNothing: string;
    assignmentsBulkPlanChats: string;
    assignmentsBulkPlanNoChats: string;
    assignmentsBulkPlanSilent: string;
    assignmentsBulkPlanNoAccount: string;
    assignmentsBulkOccupied: string;
    assignmentsBulkOccupiedBy: string;
    assignmentsBulkAlready: string;
    assignmentsBulkApply: string;
    assignmentsBulkApplying: string;
    assignmentsBulkDone: string;
    assignmentsBulkFailedTitle: string;
    assignmentsBulkFailedRow: string;
    role: string;
    profileSchool: string;
    // dashboard
    statStudents: string;
    statTeachers: string;
    statGroups: string;
    statLessons: string;
    quickActions: string;
    addStudent: string;
    addTeacher: string;
    addGroup: string;
    recentActivity: string;
    noActivity: string;
    // students
    studentsTitle: string;
    searchPlaceholder: string;
    tableFullName: string;
    tableUsername: string;
    tableGroup: string;
    tableCreated: string;
    tableActions: string;
    editBtn: string;
    resetPasswordBtn: string;
    deleteBtn: string;
    addStudentTitle: string;
    editStudentTitle: string;
    // Окно ученика: личные и медицинские сведения (миграция 232).
    sectionPersonalData: string;
    sectionMedical: string;
    optionalBlockHint: string;
    fieldBirthDate: string;
    fieldGender: string;
    genderUnset: string;
    genderMale: string;
    genderFemale: string;
    fieldStudentPhone: string;
    fieldFileNo: string;
    fieldAllergies: string;
    fieldMedicalNotes: string;
    medicalWhoSees: string;
    fieldFullName: string;
    fieldUsername: string;
    fieldPassword: string;
    fieldGroup: string;
    generatePassword: string;
    createBtn: string;
    saveBtn: string;
    cancelBtn: string;
    usernameExists: string;
    createdMsg: string;
    resetPasswordTitle: string;
    resetPasswordConfirm: string;
    newPasswordLabel: string;
    resetBtn: string;
    passwordResetMsg: string;
    deleteStudentTitle: string;
    deleteStudentConfirm: string;
    deleteWarning: string;
    confirmDeleteBtn: string;
    deletedMsg: string;
    // teachers
    teachersTitle: string;
    addTeacherTitle: string;
    editTeacherTitle: string;
    deleteTeacherTitle: string;
    deleteTeacherConfirm: string;
    deleteTeacherBlocked: string;
    /** Z.2.3 — честное подтверждение удаления: что мешает и что уйдёт следом. */
    impactLoading: string;
    teacherHasLessonsShort: string;   // "{count}"
    teacherHasGradesShort: string;    // "{count}"
    teacherDeleteBindings: string;    // "{assignments} {groups}"
    teacherDeleteCascade: string;     // "{plans} {announcements}"
    teacherDeleteAccount: string;
    teacherDeleteClean: string;
    /** Z.2.4 — вкладка «Предметы и группы» на карточке учителя. */
    subjectsAndGroupsTitle: string;
    subjectsAndGroupsEmpty: string;
    subjectsAndGroupsHint: string;
    seesGroupNo: string;
    unassignBtn: string;
    unassignedMsg: string;           // «Снято: предмет — группа» (пункт 103)
    unassignedLostGroupMsg: string;  // то же + учитель потерял доступ к группе
    lessonsCount: string;             // "{n}"
    /** Z.2.6 — куратор только в демо-школе, поле необязательное. */
    /** Z.2.7 — класс ученика в списке, выводится из группы. */
    tableGrade: string;
    gradeFromGroupUnknown: string;
    catalogSubjectDeleteTitle: string;
    catalogSubjectDeleteClean: string;
    catalogSubjectInUseHint: string;  // "{assignments} {lessons} {homework} {plans}"
    hideInsteadBtn: string;
    // groups
    groupsTitle: string;
    addGroupTitle: string;
    editGroupTitle: string;
    deleteGroupTitle: string;
    deleteGroupConfirm: string;
    fieldGroupName: string;
    fieldSubject: string;
    fieldCoursePrice: string;
    coursePriceHint: string;
    coursePriceManagerNote: string;
    tableCoursePrice: string;
    coursePriceNotSet: string;
    tableBalance: string;
    navPayments: string;
    paymentsReadOnlyNote: string;
    paymentsTitle: string;
    paymentsInvoicesCap: string;
    paymentsBlockersCap: string;
    paymentsIssueBtn: string;
    paymentsIssuing: string;
    paymentsIssueTitle: string;
    paymentsIssueBody: string;
    paymentsIssueNothing: string;
    paymentsIssuedMsg: string;
    paymentsEmptyInvoices: string;
    paymentsEmptyInvoicesHint: string;
    paymentsEmptyBlockers: string;
    paymentsAllBilled: string;
    tableStudent: string;
    tableMonth: string;
    tableAmount: string;
    tableInvoiceStatus: string;
    tableReason: string;
    invoiceOpen: string;
    invoicePaid: string;
    invoiceCanceled: string;
    invoiceAdjusted: string;
    reasonNoPrice: string;
    reasonManyGroups: string;
    reasonNoGroup: string;
    adjustInvoiceBtn: string;
    adjustInvoiceTitle: string;
    fieldInvoiceAmount: string;
    fieldInvoiceReason: string;
    invoiceReasonPlaceholder: string;
    adjustInvoiceHint: string;
    adjustInvoiceSave: string;
    invoiceAdjustedMsg: string;
    cancelInvoiceBtn: string;
    cancelInvoiceTitle: string;
    cancelInvoiceHint: string;
    invoiceCanceledMsg: string;
    restoreInvoiceBtn: string;
    invoiceRestoredMsg: string;
    topUpBalanceBtn: string;
    topUpBalanceTitle: string;
    fieldTopUpAmount: string;
    fieldTopUpReason: string;
    topUpReasonPlaceholder: string;
    topUpHint: string;
    topUpBtn: string;
    balanceToppedUpMsg: string;
    sumUnit: string;
    fieldDescription: string;
    tableStudentCount: string;
    loading: string;
    // П.3 Заход 2 — добавлено при i18n-переводе students/teachers/groups/dashboard
    noResults: string;
    selectGroupPlaceholder: string;
    noGroupOption: string;
    resetPasswordHint: string;
    teachersSearchPlaceholder: string;
    groupsSearchPlaceholder: string;
    selectSubjectPlaceholder: string;
    selectTeacherPlaceholder: string;
    groupCreatedMsg: string;   // "Группа «{name}» создана"
    groupUpdatedMsg: string;
    groupDeletedMsg: string;
    teacherUpdatedMsg: string;
    teacherDeletedMsg: string;
    teacherCreatedMsg: string;
    // Окно учителя: телефон, описание и блок «Предметы».
    fieldTeacherPhone: string;
    fieldTeacherBio: string;
    sectionSubjects: string;
    subjectsHint: string;
    addSubjectRow: string;
    removeSubjectRow: string;
    noSubjectWarning: string;
    assignedCountMsg: string;
    assignFailedMsg: string;
    studentUpdatedMsg: string;
    dashboardTitle: string;
    dashboardSubtitle: string;
    recentStudentsTitle: string;
    creating: string;
    saving: string;
    resetting: string;
    deleting: string;
    subjectsEnterName: string;
    subjectsDeleteTitle: string;
    subjectsIconSelected: string;  // "Выбрано: {icon}"
    emptyStudents: string;
    emptyStudentsNeedGroup: string;
    emptyTeachers: string;
    emptyGroups: string;
    emptyGroupsNeedSubject: string;
    assignmentsEmptyNeedBasics: string;
    needGroupFirst: string;
    needSubjectFirst: string;
    // Массовое создание групп. Пункт 227, 03.09.2026.
    groupsBulk: string;
    groupsBulkTitle: string;
    groupsBulkHint: string;
    groupsBulkTemplate: string;
    groupsBulkTemplateHint: string;
    groupsBulkFrom: string;
    groupsBulkTo: string;
    groupsBulkLetters: string;
    groupsBulkLettersPlaceholder: string;
    groupsBulkFill: string;
    groupsBulkOverwrite: string;
    groupsBulkNames: string;
    groupsBulkNamesPlaceholder: string;
    groupsBulkTooMany: string;
    groupsBulkWillCreate: string;
    groupsBulkThreads: string;
    groupsBulkTaken: string;
    groupsBulkDuplicated: string;
    groupsBulkNothing: string;
    groupsBulkCreate: string;
    groupsBulkCreating: string;
    groupsBulkDone: string;
    groupsBulkSkipped: string;
    groupsBulkFailedTitle: string;
    groupsBulkFailedRow: string;
    groupsBulkPriceHint: string;
    groupsBulkZeroPrice: string;
    needBasicsFirst: string;
    // Единое окно создания. Пункт 228, 03.09.2026.
    quickStart: string;
    quickStartTitle: string;
    quickStartHint: string;
    quickStartStepGroup: string;
    quickStartStepSubjects: string;
    quickStartStepTeacher: string;
    quickStartGroupName: string;
    quickStartGroupNamePlaceholder: string;
    quickStartNameTaken: string;
    quickStartNameEmpty: string;
    quickStartPriceHint: string;
    quickStartPriceManager: string;
    quickStartFromCatalog: string;
    quickStartCatalogEmpty: string;
    quickStartNewSubjects: string;
    quickStartNewSubjectsPlaceholder: string;
    quickStartNewHint: string;
    quickStartAlreadyInCatalog: string;
    quickStartTeacherHint: string;
    quickStartPlanTitle: string;
    quickStartPlanGroup: string;
    quickStartPlanSubjectsNew: string;
    quickStartPlanAssignments: string;
    quickStartPlanThreads: string;
    quickStartPlanNoSubjects: string;
    quickStartCreate: string;
    quickStartCreating: string;
    quickStartDone: string;
    quickStartFailedSubjects: string;
    quickStartFailedAssignments: string;
    quickStartOpenGroup: string;
    quickStartClose: string;
    setupTitle: string;
    setupSubtitle: string;
    setupDone: string;
    setupNow: string;
    setupOpen: string;
    setupSubjects: string;
    setupSubjectsHint: string;
    setupTeachers: string;
    setupTeachersHint: string;
    setupGroups: string;
    setupGroupsHint: string;
    setupAssignments: string;
    setupAssignmentsHint: string;
    setupStudents: string;
    setupStudentsHint: string;
    setupParents: string;
    setupParentsHint: string;
    subjectsAndGroupsEmptyCta: string;
    subjectsPickKnown: string;
    subjectsOwnName: string;
    subjectsOwnNameWarning: string;
  };
  superadmin: {
    googleEmailSavedMsg: string;
    googleBlockTitle: string;
    googleBlockHint: string;
    fieldGoogleEmailAny: string;
    schoolCardTitle: string;
    schoolEditBtn: string;
    schoolSaveBtn: string;
    schoolSaving: string;
    fieldLogo: string;
    logoHint: string;
    logoChoose: string;
    logoReplace: string;
    logoRemove: string;
    logoNone: string;
    fieldAddress: string;
    fieldPhone: string;
    fieldEmail: string;
    fieldDirector: string;
    fieldWebsite: string;
    fieldLegalDetails: string;
    legalDetailsHint: string;
    fieldLessonDuration: string;    // длительность урока у школы (миграция 246)
    lessonDurationHint: string;
    lessonDurationBad: string;      // отказ, когда число вне границ
    sectionOrg: string;
    schoolUpdatedMsg: string;
    title: string;
    role: string;
    navDashboard: string;
    navSchools: string;
    navAdmins: string;
    // Роль менеджера. Заход 1, миграция 250.
    navManagers: string;
    mgrTitle: string;
    mgrHint: string;
    mgrAdd: string;
    mgrEdit: string;
    mgrDelete: string;
    mgrReset: string;
    mgrSave: string;
    mgrCreate: string;
    mgrCancel: string;
    mgrClose: string;
    mgrSearchPlaceholder: string;
    mgrColName: string;
    mgrColLogin: string;
    mgrColCreated: string;
    mgrEmpty: string;
    mgrNoResults: string;
    mgrFieldName: string;
    mgrFieldLogin: string;
    mgrFieldPassword: string;
    mgrLoginHint: string;
    mgrPasswordHint: string;
    mgrRegenerate: string;
    mgrCreatedMsg: string;
    mgrUpdatedMsg: string;
    mgrDeletedMsg: string;
    mgrDeleteTitle: string;
    mgrDeleteConfirm: string;
    mgrResetTitle: string;
    mgrResetConfirm: string;
    mgrResetDone: string;
    mgrResetOnce: string;
    mgrLoginTaken: string;
    mgrHomeLogout: string;
    // Заход 2: менеджер ходит в любую школу.
    mgrSchoolsTitle: string;
    mgrSchoolsSearch: string;
    mgrSchoolsEmpty: string;
    mgrSchoolsNoResults: string;
    mgrSchoolsReadOnly: string;
    // Заход 3: менеджер правит карточку школы.
    mgrCardTitle: string;
    mgrCardHint: string;
    mgrCardSave: string;
    mgrCardSaved: string;
    mgrCardTab: string;
    mgrMoneyTab: string;
    jActionManagerCreate: string;
    jActionManagerUpdate: string;
    jActionManagerDelete: string;
    jActionManagerReset: string;
    navSettings: string;
    navAiCosts: string;
    navJournal: string;

    // ── ЖУРНАЛ ДЕЙСТВИЙ СУПЕРАДМИНА (миграция 220) ─────────────────────
    // Экран /superadmin/journal. Читает только суперадмин.
    jTitle: string;
    jSubtitle: string;
    jNotice: string;
    jEmpty: string;
    jEmptyFiltered: string;
    jColWhen: string;
    jColWho: string;
    jColWhat: string;
    jColTarget: string;
    jColResult: string;
    jOutcomeOk: string;
    jOutcomeFailed: string;
    jOutcomeDenied: string;
    jFilterAction: string;
    jFilterAll: string;
    jFilterFrom: string;
    jFilterTo: string;
    jSearch: string;
    jSearchHint: string;
    jApply: string;
    jReset: string;
    jDetails: string;
    jReason: string;
    jShown: string;
    jTargetSchool: string;
    jTargetAdmin: string;
    jTargetSelf: string;
    jTargetNone: string;
    jActSchoolCreate: string;
    jActSchoolUpdate: string;
    jActSchoolArchive: string;
    jActSchoolDelete: string;
    jActAdminCreate: string;
    jActAdminUpdate: string;
    jActAdminDelete: string;
    jActAdminResetPassword: string;
    jActSelfGoogleEmail: string;
    jActSelfPassword: string;
    jActAccessDenied: string;

    // ── СУПЕРАДМИН СМОТРИТ ШКОЛУ (миграция 221) ───────────────────────
    // Экраны /superadmin/schools/[id]/view. Только чтение.
    jActSchoolVisit: string;
    svEnterBtn: string;
    svReadOnly: string;
    svExit: string;
    svDemoMark: string;
    svTabOverview: string;
    svTabGroups: string;
    svTabStudents: string;
    svTabTeachers: string;
    svTabParents: string;
    svTabSubjects: string;
    svTabAssignments: string;
    svTabMarks: string;
    svTabAnnouncements: string;
    svTabAnalytics: string;
    svRows: string;
    svEmpty: string;
    svColName: string;
    svColSubject: string;
    svColTeacher: string;
    svColStudents: string;
    svColDays: string;
    svColLogin: string;
    svColGrade: string;
    svColGroups: string;
    svColStatus: string;
    svColMainSubject: string;
    svColTeaches: string;
    svColPhone: string;
    svColChildren: string;
    svColRegistered: string;
    svColActive: string;
    svColGroup: string;
    svColStudent: string;
    svColLesson: string;
    svColMark: string;
    svColDate: string;
    svColTitle: string;
    svColScope: string;
    svColCategory: string;
    svColPinned: string;
    svParentsNote: string;
    svMarksNote: string;
    svOverviewCounts: string;
    svOverviewCard: string;
    svCountStudents: string;
    svCountTeachers: string;
    svCountGroups: string;
    svCountParents: string;
    svCountSubjects: string;
    svCountLessons: string;
    svCountAnnouncements: string;
    svCardCode: string;
    svCardAddress: string;
    svCardPhone: string;
    svCardEmail: string;
    svCardDirector: string;
    svCardWebsite: string;
    svCardLegal: string;
    svAnLessons: string;
    svAnLessonsDone: string;
    svAnGrades: string;
    svAnAvgGrade: string;
    svAnAttendance: string;
    svAnHomeworkGraded: string;
    svAnAvgHomework: string;
    svAnBySource: string;
    svAnBySourceNote: string;
    aiTitle: string;
    aiSubtitle: string;
    aiFreshNotice: string;
    aiOldCounter: string;
    aiOldCounterHint: string;
    aiFreeLeft: string;
    aiFreeLeftHint: string;
    aiTotalSpend: string;
    aiPeriodSpend: string;
    aiRequests: string;
    aiTokensIn: string;
    aiTokensOut: string;
    aiThisMonth: string;
    aiLastMonth: string;
    aiBySchool: string;
    aiByTask: string;
    aiShare: string;
    aiAvgPerCall: string;
    aiColSchool: string;
    aiColTask: string;
    aiColRequests: string;
    aiColTokens: string;
    aiColCost: string;
    aiColAvg: string;
    aiFilterPeriod: string;
    aiFilterSchool: string;
    aiFilterTask: string;
    aiAllSchools: string;
    aiAllTasks: string;
    aiPeriod7: string;
    aiPeriod30: string;
    aiPeriodMonth: string;
    aiPeriodAll: string;
    aiExport: string;
    aiEmpty: string;
    aiNoSchool: string;
    aiFailures: string;
    aiFailuresHint: string;
    aiPriceNote: string;
    task_assistant_chat: string;
    task_generate_stages: string;
    task_generate_homework: string;
    task_lesson_content: string;
    task_curriculum_parse: string;
    task_homework_review: string;
    task_stage_image: string;
    task_daily_fact: string;
    task_parent_insight: string;
    task_embeddings: string;
    task_study_tip: string;
    task_grades_advice: string;
    task_analytics_review: string;
    task_book_to_plan: string;
    task_other: string;
    statSchools: string;
    statAdmins: string;
    statStudents: string;
    statTeachers: string;
    schoolsTitle: string;
    schoolsTableName: string;
    schoolsTableCode: string;
    schoolsTableCreated: string;
    adminsTitle: string;
    addAdmin: string;
    addAdminTitle: string;
    fieldFullName: string;
    fieldUsername: string;
    fieldPassword: string;
    fieldSchool: string;
    generatePassword: string;
    createBtn: string;
    cancelBtn: string;
    createdMsg: string;   // "Админ создан. Username: {username}, Пароль: {password}"
    tableFullName: string;
    tableUsername: string;
    tableSchool: string;
    tableCreated: string;
    settingsTitle: string;
    changePassword: string;
    fieldNewPassword: string;
    saveBtn: string;
    passwordChangedMsg: string;
    // П.3 Заход 2 — добавлено при i18n-переводе dashboard/schools/admins/settings
    dashboardTitle: string;
    dashboardSubtitle: string;
    quickActionsTitle: string;
    addSchoolAdminQuick: string;
    schoolsSubtitle: string;
    createSchoolBtn: string;
    fieldSchoolName: string;
    fieldSchoolCode: string;
    autostartLabel: string;
    autostartEnabled: string;
    autostartDisabled: string;
    noSchools: string;
    schoolCreatedMsg: string;         // "Школа «{name}» создана."
    searchPlaceholder: string;
    noResults: string;
    editAdminTitle: string;
    deleteAdminTitle: string;
    deleteAdminConfirm: string;       // "{name}"
    resetAdminPasswordConfirm: string; // "{name}"
    adminUpdatedMsg: string;
    adminDeletedMsg: string;
    newPasswordFlash: string;         // "{name}" "{password}"
    noAccountError: string;
    settingsSubtitle: string;
    saving: string;
    creating: string;
    deleting: string;
    resetPasswordBtn: string;
    resetting: string;
    schoolArchivedBadge: string;
    schoolWipeBtn: string;
    schoolRestoreBtn: string;
    schoolRestoredMsg: string;
    schoolRestoreConfirmTitle: string;
    schoolRestoreConfirmText: string;
    schoolRestoreConfirmBtn: string;
    schoolArchivedMsg: string;
    schoolWipeTitle: string;
    schoolWipeIntro: string;
    schoolArchiveOption: string;
    schoolArchiveHint: string;
    schoolDeleteOption: string;
    schoolDeleteHint: string;
    schoolWipeWhatGoes: string;
    wipeCounting: string;
    wipeStudents: string;
    wipeTeachers: string;
    wipeParents: string;
    wipeGroups: string;
    wipeLessons: string;
    wipeGrades: string;
    wipeFiles: string;
    schoolDeleteIrreversible: string;
    schoolDeleteConfirmLabel: string;
    schoolDeleteConfirmBtn: string;
    schoolDeletedMsg: string;
    backBtn: string;
    demoSchoolProtected: string;
    schoolNameMismatch: string;
  };
  parent: {
    title: string;
    role: string;
    navDashboard: string;
    selectChild: string;
    noChildren: string;
  };
  parentNav: {
    dashboard: string;
    schedule: string;
    grades: string;
    homework: string;
    attendance: string;
    payments: string;
    childProfile: string;
    messages: string;
    messagesComingSoon: string;
    logout: string;
  };
  parentJoin: {
    title: string;
    codeLabel: string;
    codePlaceholder: string;
    checkCodeBtn: string;
    checking: string;
    invalidCode: string;
    childrenLabel: string;
    usernameLabel: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    passwordMismatch: string;
    usernameTaken: string;
    serverError: string;
    createAccountBtn: string;
    creating: string;
    successRedirecting: string;
    changeCodeBtn: string;
  };
  adminParents: {
    title: string;
    addParent: string;
    addParentTitle: string;
    fieldFullName: string;
    fieldPhone: string;
    fieldChildren: string;
    selectChildren: string;
    createBtn: string;
    creating: string;
    cancelBtn: string;
    /** Z.2.8 — приглашения заменены телефоном и паролем. */
    parentCreatedTitle: string;
    fieldPassword: string;
    passwordShownOnce: string;
    parentLoginHint: string;
    parentCreatedNext: string;
    copyPhone: string;
    parentPhoneRequired: string;
    parentChildRequired: string;
    showCodeBtn: string;
    codeLabel: string;
    codeNone: string;
    inviteCreatedTitle: string;
    inviteCodeLabel: string;
    copyCode: string;
    copyLink: string;
    copied: string;
    doneBtn: string;
    tableFullName: string;
    tablePhone: string;
    tableChildren: string;
    tableStatus: string;
    tableCreated: string;
    statusRegistered: string;
    statusPending: string;
    statusExpired: string;
    copyCodeBtn: string;
    regenerateCodeBtn: string;
    deleteBtn: string;
    deleteConfirm: string;
    searchPlaceholder: string;
    noParents: string;
    editBtn: string;
    editParentTitle: string;
    saveBtn: string;
    saving: string;
    resetPasswordBtn: string;
    resetPasswordConfirm: string;
    resetPasswordNotRegistered: string;
    parentSavedMsg: string;
    parentDeletedMsg: string;
    newPasswordFlash: string;
    emptyParentsNeedStudents: string;
    needStudentsFirst: string;
    fieldPhoneHint: string;
    fieldSocialLogins: string;      // заголовок блока в форме родителя (миграция 201)
    fieldSocialLoginsHint: string;
    fieldGoogleEmail: string;
    fieldAppleEmail: string;
    fieldAppleEmailNote: string;
  };
  /** П.3 Заход 2 — человеческие сообщения об ошибках для админ-форм
   *  (apps/web/lib/admin-error-messages.ts), заменяют сырой Postgres-текст. */
  adminErrors: {
    logoTooBig: string;
    logoBadType: string;
    logoEmpty: string;
    logoUploadFailed: string;
    usernameTaken: string;
    phoneTaken: string;
    demoSchoolProtected: string;
    schoolNameMismatch: string;
    googleEmailTaken: string;   // почта уже у другого родителя (миграция 201)
    appleEmailTaken: string;
    socialEmailInvalid: string; // адрес не похож на почту
    schoolCodeTaken: string;
    foreignKeyBlocked: string;
    subjectHasLessons: string;
    requiredField: string;   // "Обязательное поле: {field}"
    invalidCredentials: string;
    rateLimited: string;
    /** Z.2.3 — гварды удаления. Причина отказа с числами вместо сырой
     *  ошибки внешнего ключа. */
    /** Z.2.9 — имена ограничений сверены с живой базой. */
    subjectNameTaken: string;
    assignmentExists: string;
    phoneInvalid: string;
    groupNameTaken: string;
    groupsBulkTooManyError: string;
    birthDateBad: string;
    birthDateInFuture: string;
    birthDateTooOld: string;
    genderBad: string;
    coursePriceInvalid: string;
    coursePriceTooBig: string;
    superadminWriteBlocked: string;
    rlsWriteBlocked: string;
    lastSchoolAdmin: string;
    /** Миграция 237 — удалению учётной записи мешают ссылки на неё. */
    userHasRefs: string;
    /** Auth API подменяет ошибку базы своим текстом; это его перевод. */
    authUserOperationFailed: string;
    topUpAmountInvalid: string;
    topUpReasonRequired: string;
    moneyManagerOnly: string;
    priceManagerOnly: string;
    invoiceNotOpen: string;
    invoiceNotCanceled: string;
    invoiceNotFound: string;
    invoiceAmountInvalid: string;
    invoiceReasonRequired: string;
    teacherHasLessons: string;      // "{count}"
    teacherHasGrades: string;       // "{count}"
    subjectInUse: string;           // "{lessons} {homework} {plans}"
    catalogSubjectInUse: string;    // "{assignments} {lessons} {homework} {plans}"
    genericPrefix: string;   // "Ошибка: "
  };
  parentUi: {
    todayTitle: string;
    scheduleTodayTitle: string;
    noLessonsToday: string;
    lessonNow: string;
    lessonPast: string;
    lessonUpcoming: string;
    gradesWeekTitle: string;
    noGradesWeek: string;
    viewAllGrades: string;
    homeworkPendingTitle: string;
    allHomeworkDone: string;
    viewAllHomework: string;
    dueDate: string;

    scheduleTitle: string;
    thisWeek: string;
    nextWeek: string;
    noLessonsWeek: string;

    gradesTitle: string;
    overallAverage: string;
    subjectAverage: string;
    noGrades: string;

    homeworkTitle: string;
    hwStatusDone: string;
    hwStatusPending: string;
    hwStatusOverdue: string;
    noHomeworkAtAll: string;
    submittedByChild: string;
    notSubmittedYet: string;
    teacherGradeLabel: string;

    attendanceTitle: string;
    attendancePercentage: string;
    statusPresent: string;
    statusAbsent: string;
    statusExcused: string;
    noAttendanceRecords: string;

    remainingBalance: string;

    profileTitle: string;
    birthDateLabel: string;
    classesLabel: string;

    messagesStubTitle: string;

    notFoundChildTitle: string;
    notFoundChildDescription: string;
    backToDashboard: string;
  };
  /** Строки, специфичные для мобильного приложения родителя (apps/mobile-parent). */
  parentMobile: {
    loginSubtitle: string;
    networkError: string;
    configError: string;
    notParentError: string;
    notParentDbError: string;
    greeting: string;
    myChildren: string;
    comingSoonSection: string;
    // Промт МОБ-1 — 7 экранов (Главная/Успехи/ДЗ/Расписание/Уведомления/Сообщения/Профиль)
    tabProgress: string;
    homeSubtitle: string; // "Вот что происходит у {name} сегодня"
    childClassLabel: string; // "{n} класс" fallback когда группы нет
    statArrival: string;
    statLessons: string;
    statAttended: string;
    statNextLesson: string;
    childStatusAtSchool: string;
    childStatusHome: string;
    balanceMealTitle: string; // TODO(payments)
    balanceAccountTitle: string; // TODO(payments)
    sumCurrency: string;
    insightTitle: string; // TODO(ai-insight)
    insightBadgeNew: string;
    insightMockBody: string; // TODO(ai-insight)
    insightBtnProgress: string;
    insightBtnMessageTeacher: string;
    quickActionsTitle: string;
    quickActionSchedule: string;
    quickActionHomework: string;
    quickActionGrades: string;
    quickActionAttendance: string;
    quickActionPayments: string;
    quickActionMessages: string;
    strengthsTitle: string;
    growthAreasTitle: string;
    gradesEmpty: string;
    hwStatsTotal: string;
    hwStatsDone: string;
    hwStatsLeft: string;
    hwTabAll: string;
    hwTabActive: string;
    hwTabDone: string;
    hwActiveTitle: string;
    hwRecentlyChecked: string;
    scheduleSummary: string; // "{n} уроков сегодня"
    scheduleEmptyDay: string;
    scheduleBreak: string;
    messagesEmptyTitle: string;
    messagesEmptyDescription: string;
    profileChildren: string;
    profileAddChild: string;
    profileSettings: string;
    profileNotifRow: string;
    profileLanguageRow: string;
    profileVersion: string; // "SNR EduOS · версия {v}"
    childIdMock: string; // TODO(child-id-format)
    errorGeneric: string;
    notParentExitBtn: string;
    filterAll: string;
    filterUnread: string;
    // Промт МОБ-3 — детальные экраны (Успехи/Предмет/ДЗ/Посещаемость/Навыки).
    switchChildBtn: string;
    progAverageLabel: string;
    progRatingExcellent: string;
    progRatingGood: string;
    progRatingAverage: string;
    progRatingLow: string;
    progWeekLabel: string;
    progWeekUp: string;
    progWeekDown: string;
    progWeekFlat: string;
    progAttendanceLabel: string;
    progAttendedOfTotal: string; // "Присутствий: {a}/{b}"
    progSkillsSectionTitle: string;
    progSeeMore: string;
    progSubjectsSectionTitle: string;
    progReviewsSectionTitle: string;
    progReviewsSeeAll: string;
    progReviewsEmpty: string;
    progAiSummaryTitle: string;
    progAiSummaryMock: string; // TODO(ai-progress-summary)
    progSubjectsEmpty: string;

    subjTeacherLabel: string;
    subjCurrentPerfLabel: string;
    subjTopicsTitle: string;
    subjTopicsEmpty: string;
    subjLastWorkTitle: string;
    subjLastWorkEmpty: string;
    subjUpcomingTestTitle: string;
    subjUpcomingTestEmpty: string;
    subjUpcomingInDays: string; // "Через {n} дн."
    subjTeacherCommentTitle: string;
    subjTeacherCommentEmpty: string;
    subjAiRecTitle: string;
    subjAiRecMock: string; // TODO(ai-subject-recommendations)
    subjGradesEmpty: string;

    hwDetailTitle: string;
    hwDetailDeadlineLabel: string;
    hwDetailNoDeadline: string;
    hwDetailInstructionsTitle: string;
    hwDetailAttachmentsTitle: string;
    hwDetailNoAttachments: string;
    hwDetailOpenFileBtn: string;
    hwDetailStatusTitle: string;
    hwDetailStepAssigned: string;
    hwDetailStepInProgress: string;
    hwDetailStepSubmitted: string;
    hwDetailStepReview: string;
    hwDetailStepGraded: string;
    hwDetailTeacherCommentEmpty: string;
    hwDetailSubmitUpdatedBtn: string;
    hwDetailSubmitMockNotice: string; // TODO(homework-file-upload)
    hwDetailNotFound: string;

    attDetailTitle: string;
    attExcusedLabel: string;
    attUnexcusedLabel: string;
    attThisMonth: string;
    attCalendarLegendPresent: string;
    attCalendarLegendExcused: string;
    attCalendarLegendUnexcused: string;
    attCalendarLegendNone: string;
    attRecentDaysTitle: string;
    attRecentDaysEmpty: string;

    skillsTitle: string;
    skillsOverallIndexLabel: string;
    skillsOverallRatingGreat: string;
    skillsAiInsightTitle: string;
    skillsAiInsightMock: string; // TODO(ai-skills-insight)
    skillsActivitiesTitle: string;
    skillLogic: string;
    skillMath: string;
    skillCommunication: string;
    skillCreativity: string;
    skillTeamwork: string;
    skillSpeaking: string;
    skillsActivity1Title: string;
    skillsActivity1Desc: string;
    skillsActivity2Title: string;
    skillsActivity2Desc: string;

    reviewsAllTitle: string;
    reviewsAllEmpty: string;

    // Промт МОБ-4 — сообщения (#24), чат с учителем (#25), объявления (#26/#27), поддержка mock (#28).
    msgFilterChats: string;
    msgFilterAnnouncements: string;
    msgFilterServices: string;
    msgServiceSupportTitle: string;
    msgServiceSupportDesc: string;
    msgSearchMockNotice: string;
    msgComposeMockNotice: string;

    threadCallMockTitle: string;
    threadCallMockNotice: string;
    threadAttachMockNotice: string;
    threadEmptyDesc: string;

    annListTitle: string;
    annSourceAdmin: string;
    annDetailBackToMessages: string;
    annImportantBadge: string;

    supportTitle: string;
    supportOnlineStatus: string;
    supportAvgResponseLabel: string;
    supportAvgResponseValue: string;
    supportPopularQuestionsTitle: string;
    supportChipTuition: string;
    supportChipMeals: string;
    supportChipReceipts: string;
    supportChipRefund: string;
    supportSendMockNotice: string;
    supportDialogUser1: string;
    supportDialogSupport1: string;
    supportDialogUser2: string;
    supportDialogSupport2Title: string;
    supportDialogSupport2Body: string;
    supportReplyTuition: string;
    supportReplyMeals: string;
    supportReplyReceiptsTitle: string;
    supportReplyReceiptsBody: string;
    supportReplyRefund: string;

    // Промт МОБ-5 — Оплаты (Баланс/Счета/Checkout/История/Чек/Кошелёк ребёнка).
    payBalanceTitle: string;
    payTopUpBtn: string;
    payPayBillBtn: string;
    payHistoryBtn: string;
    payNearestTitle: string;
    payNearestNone: string;
    payRecentTitle: string;
    payRecentEmpty: string;
    payDueLabel: string; // "Срок: {date}"
    payOverdueTag: string;
    payViewAllBills: string;

    billsTitle: string;
    billsEmpty: string;
    billsDueLabel: string; // "Срок оплаты: {date}"

    checkoutTitle: string;
    checkoutMethodLabel: string;
    checkoutAddCardBtn: string;
    checkoutNoCards: string;
    checkoutPayBtn: string; // "Оплатить {amount}"
    checkoutProcessing: string;
    checkoutSuccessTitle: string;
    checkoutSuccessDesc: string; // "Счёт «{title}» оплачен"
    checkoutBackBtn: string;

    historyTitle: string;
    historyEmpty: string;

    receiptTitle: string;
    receiptSchoolName: string;
    receiptSchoolDetails: string;
    receiptPayerLabel: string;
    receiptItemLabel: string;
    receiptTotalLabel: string;
    receiptDateLabel: string;
    receiptShareBtn: string;
    receiptShareMockNotice: string;

    walletTitle: string;
    walletBalanceLabel: string;
    walletTopUpBtn: string;
    walletRecentTitle: string;
    walletEmpty: string;
    walletTopUpSuccessTitle: string;
    walletTopUpSuccessDesc: string;

    // Промт МОБ-6 — Профиль расширенно (Ребёнок/Родитель/Документы/
    // Уведомления/Способы оплаты/Безопасность).
    childProfGenderLabel: string;
    childProfGenderMale: string;
    childProfGenderFemale: string;
    childProfSubjectsTitle: string;
    childProfSubjectsEmpty: string;
    childProfStatusTitle: string;
    childProfStatusActive: string;
    childProfStatusInactive: string;
    childProfEnrolledLabel: string;

    parentProfEmailLabel: string;
    parentProfEditBtn: string;
    parentProfEditSoon: string;
    parentProfDocumentsRow: string;
    parentProfNotificationsRow: string;
    parentProfPaymentMethodsRow: string;
    parentProfSecurityRow: string;

    docTitle: string;
    docStatusUploaded: string;
    docStatusNeedsUpdate: string;
    docStatusMissing: string;
    docUploadBtn: string;
    docPreviewTitle: string;
    docUploadSuccessTitle: string;
    docUploadSuccessDesc: string;

    notifSetTitle: string;
    notifSetGrades: string;
    notifSetHomework: string;
    notifSetAttendance: string;
    notifSetAnnouncements: string;
    notifSetTeacherMessages: string;
    notifSetPayments: string;
    notifSetQuietHoursTitle: string;
    notifSetQuietHoursDesc: string; // "С {from} до {to}"

    pmTitle: string;
    pmPrimaryTag: string;
    pmMakePrimaryBtn: string;
    pmDeleteBtn: string;
    pmAddBtn: string;
    pmAddTitle: string;
    pmCardNumberLabel: string;
    pmExpiryLabel: string;
    pmCvvLabel: string;
    pmInvalidNotice: string;
    pmDetailUsageTitle: string;
    pmDetailUsageEmpty: string;
    pmDeleteConfirmTitle: string;
    pmDeleteConfirmBtn: string;

    secTitle: string;
    secBiometricRow: string;
    secBiometricEnabled: string;
    secPinRow: string;
    secPinChangeBtn: string;
    secPinEnterTitle: string;
    secPinCreateTitle: string;
    secPinRepeatTitle: string;
    secPinMismatch: string;
    secSessionsTitle: string;
    secSessionActiveNow: string;
    secSessionDaysAgo: string; // "{n} дн. назад"
    secSessionEndBtn: string;
    secSessionEndedNotice: string;
    secLoginHistoryTitle: string;

    // Промт МОБ-7 — v7 Статус дня.
    dailyStatusTitle: string;
    dailyStatusDayOffTitle: string;
    dailyStatusDayOffDesc: string;
    dailyStatusArrivedTitle: string;
    dailyStatusArrivedMock: string;
    dailyStatusOnLesson: string;
    dailyStatusBreakLabel: string; // "Перемена, ещё {n} мин"
    dailyStatusSummaryTitle: string;
    dailyStatusSummaryTotal: string;
    dailyStatusSummaryAttended: string;
    dailyStatusSummaryMissed: string;
    dailyStatusSummaryGrades: string;
    dailyStatusSummaryHomework: string;
    dailyStatusHomeWidgetDone: string;
    homeNowAtSchoolTitle: string;

    // Промт МОБ-7 — v8 EduOS Assistant Insight.
    insightEmptyTitle: string;
    insightEmptyDesc: string;
    insightStaleLabel: string;
    insightRefreshBtn: string;
    insightCategoryRecommendation: string;
    homeInsightWeekTitle: string;

    // Промт МОБ-7 — v10 Все сервисы.
    allServicesTitle: string;
    allServicesSearchPlaceholder: string;
    allServicesSearchEmpty: string;
    allServicesPaymentsLabel: string;
    allServicesPaymentsSubtitle: string;
    allServicesScheduleLabel: string;
    allServicesScheduleSubtitle: string;
    allServicesHomeworkLabel: string;
    allServicesHomeworkSubtitle: string;
    allServicesGradesLabel: string;
    allServicesGradesSubtitle: string;
    allServicesAttendanceLabel: string;
    allServicesAttendanceSubtitle: string;
    allServicesMessagesLabel: string;
    allServicesMessagesSubtitle: string;
    allServicesDailyStatusLabel: string;
    allServicesDailyStatusSubtitle: string;
    allServicesInsightLabel: string;
    allServicesInsightSubtitle: string;
    allServicesTransportLabel: string;
    allServicesTransportSubtitle: string;
    allServicesCafeteriaLabel: string;
    allServicesCafeteriaSubtitle: string;
    allServicesMedicalLabel: string;
    allServicesMedicalSubtitle: string;
    allServicesClubsLabel: string;
    allServicesClubsSubtitle: string;
    allServicesLibraryLabel: string;
    allServicesLibrarySubtitle: string;
    allServicesSupportLabel: string;
    allServicesSupportSubtitle: string;
    comingSoonTag: string;
    comingSoonTitle: string;
    comingSoonDesc: string;
    homeSeeAllServices: string;
  };
  homework: {
    title: string;
    active: string;
    onReview: string;
    done: string;
    overdue: string;
    due: string; // "до {date}"
    open: string;
    submit: string;
    yourAnswer: string;
    answerPlaceholder: string;
    attachFile: string;
    send: string;
    submittedOn: string; // "Сдано {date}"
    grade: string;
    teacherComment: string;
    aiReviewPending: string;
    noTasks: string;
    // новые ключи #19
    eyebrow: string;
    detailDeadline: string;
    detailAttachments: string;
    detailDownload: string;
    detailYourSubmission: string;
    submittedCodeLabel: string;   // "Отправленный код" — read-only снимок сданного кода (programming)
    externalNoSubmission: string; // внешний сервис: работа не отправляется по дизайну (deprecated, оставлено для совместимости)
    notSubmittedYet: string;      // "Ещё не отправлено" — когда сдачи нет
    externalLinkLabel: string;    // "Ссылка на вашу работу" — поле ссылки в форме сдачи внешнего сервиса
    externalPhotoLabel: string;   // "Прикрепить скриншот/фото"
    externalPhotoHint: string;    // "JPG, PNG · до 50 МБ"
    externalSubmitHint: string;   // "Прикрепите фото и/или вставьте ссылку на свою работу"
    yourWorkLink: string;         // "Ссылка на работу" — заголовок над кликабельной ссылкой сдачи
    formSubmitting: string;
    formSuccess: string;
    formError: string;
    formValidation: string;
    statsTitle: string;
    statsTotal: string;
    tipTitle: string;
    emptyActive: string;
    emptyReview: string;
    emptyCompleted: string;
    emptyOverdue: string;
    daysLeft: string; // "осталось {n} дн."
    daysOverdue: string; // "просрочено на {n} дн."
    noFile: string;
    typeFile: string;
    typeTest: string;
    sourceProgram: string;
    sourceTeacher: string;
    filterAll: string;
    filterFiles: string;
    filterTests: string;
    testSubmit: string;
    testResults: string;
    testScore: string;
    testCorrect: string;
    testReview: string;
    testWebOnly: string;
    teacherFile: string;
    teacherVideo: string;
    detailWatch: string;
    videoSourceLabel: string;
    attachmentUnavailable: string;
    hintPanelTitle: string;     // "Подсказка" — БОЛЬШОЕ ОБНОВЛЕНИЕ §8.2 side panel
    hintPanelCollapse: string;
    hintPanelOpen: string;
    submittedFileLbl: string;
    uploadingFile: string;
    resubmitBtn: string;
    // Homework types (migration 31)
    typeProgramming: string;
    typeBundle: string;
    typeCodeCompletion: string;
    // новые ключи — редизайн /homework (Iter5 P8)
    searchPlaceholder: string;
    typeAll: string;
    typeProgrammingShort: string; // "Код" — короткая метка для компактного бейджа карточки
    deadlineAll: string;
    deadlineSoon: string;
    sortDeadlineAsc: string;
    sortDeadlineDesc: string;
    sortTitle: string;
    sortSubject: string;
    notFoundTitle: string;
    notFoundBody: string;
    notFoundBtn: string;
    noResultsTitle: string;
    noResultsBody: string;
    resetFilters: string;
    noTasksBody: string;
    allDoneTitle: string;
    allDoneBody: string;
    calendarTitle: string;
    dueToday: string;          // "Сегодня"
    dueTodayCount: string;     // "{n} заданий"
    calendarEmpty: string;
    calendarLink: string;
    overdueBadge: string;      // "Просрочено"
    activeBadge: string;       // "Активно"
    submittedBadge: string;    // "Сдано"
    gradedBadgeLabel: string;  // "Оценено"
    notSubmittedBadge: string; // "Не сдано" — задача "Задания", явный статус на экране сдачи
    pendingReviewBadge: string; // "Отправлено на проверку"
    dueUntil: string;          // "До {date}"
    heroAlt: string;           // подпись для decorative hero-блока
    test: {
      durationLabel: string;       // "Длительность теста (минут)"
      autoGradeLabel: string;      // "Автоматически выставить оценку по результату"
      autoGradeFormula: string;    // "≥85% → 5, ≥70% → 4, ≥50% → 3, <50% → 2"
      createTest: string;          // "Создать тест"
      info: string;                // "{q} вопросов · {min} мин · {grade}"
      autoGradeOn: string;         // "авто-оценка вкл"
      autoGradeOff: string;        // "авто-оценка выкл"
      start: string;               // "Начать тест"
      startWarning: string;        // "После нажатия запустится таймер…"
      meta: string;                // "{q} вопросов · {min} мин на выполнение"
      finish: string;              // "Завершить тест"
      timeLeft: string;            // "Осталось"
      timeUp: string;              // "Время истекло — ответы отправлены"
      resultLine: string;          // "Вы ответили на {score} из {max} ({pct}%)"
      awaitingReview: string;      // "Ожидает проверки учителя"
      viewAnswers: string;         // "Просмотреть свои ответы"
      yourAnswer: string;          // "Ваш ответ"
      correctAnswer: string;       // "Верный ответ"
      answersUnavailable: string;  // "Ответы по вопросам недоступны"
    };
    programming: {
      language: string;
      starterLabel: string;
      starterHint: string;
      expectedLabel: string;
      expectedHint: string;
      testsLabel: string;
      testsHint: string;
      condition: string;        // "Условие"
      run: string;              // "Запустить"
      running: string;          // "Запуск..." (code-runner in flight, client-side)
      exitCode: string;         // "Код выхода"
      submit: string;           // "Отправить учителю"
      output: string;           // "Вывод"
      outputEmpty: string;
      sent: string;             // "Код отправлен учителю"
      testsFile: string;        // "Файл с тестами"
      download: string;         // "Скачать"
      noCode: string;           // "Ученик ещё не отправил код"
    };
    bundle: {
      subtasksTitle: string;
      subtaskDone: string;
      subtaskInProgress: string;
      subtaskNotStarted: string;
      progressLabel: string;      // "{done} из {total} подзадач выполнено"
      submitAll: string;
      confirmPartialTitle: string;
      confirmPartialBody: string; // "Ты выполнил {done} из {total} подзадач. Отправить сейчас?"
      confirmSubmitBtn: string;
      confirmBackBtn: string;
      submittedStatus: string;
      openSubtask: string;
    };
  };
  projects: {
    actionFailed: string;
    submitFailed: string;
    title: string;
    filterAll: string; filterActive: string; filterSubmitted: string; filterGraded: string;
    statusNotStarted: string; statusInProgress: string; statusAwaiting: string; statusGraded: string;
    empty: string;
    stagesCount: string;        // "{n} этапов"
    badge: string;              // "Проект"
    teacher: string;            // "Учитель"
    deadline: string;
    start: string;              // "Начать проект"
    stagesTitle: string;        // "Этапы проекта"
    markDone: string;           // "Отметить пройденным"
    done: string;               // "Пройдено"
    notesLabel: string;
    notesPlaceholder: string;
    attachLabel: string;        // "Прикреплённые файлы"
    attachStage: string;        // "Прикрепить файл к этапу"
    generalFiles: string;       // "Файлы проекта"
    attachGeneral: string;
    progressLabel: string;      // "Пройдено: {done} из {total} этапов"
    submitBtn: string;          // "Сдать проект"
    submitConfirmTitle: string;
    submitConfirmMsg: string;
    submittedTitle: string;     // "Проект сдан, ждёт проверки"
    gradedTitle: string;        // "Оценка: {grade}"
    teacherComment: string;
    deleteFile: string;
    // Iter5 P10 — CD redesign: hardcoded demo project cards + sandbox CTA
    pageSubtitle: string;       // "Создавай, экспериментируй и развивай свои навыки"
    myProjectsSection: string; // "Мои проекты"
    openSandboxBtn: string;    // "Открыть песочницу"
    statusCompleted: string;   // "Завершён" (demo card, distinct from graded)
    typePython: string;
    typeArduino: string;
    typeWeb: string;
    typeGeogebra: string;
    typePhet: string;
    externalProjectsSection: string; // "Внешние инструменты" — раздел проектов на внешних сервисах (всегда 0%)
  };
  sandbox: {
    title: string;          // "Проекты (песочница)"
    subtitle: string;
    backToMenu: string;     // "← Вернуться в меню проектов"
    modeProjects: string;   // вкладка "Проекты"
    modeSandbox: string;    // вкладка "Песочница"
    // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.4 — subject filter above the tool grid
    filterLabel: string;    // "Предмет"
    filterAll: string;      // "Все"
    tools: {
      wokwi: { name: string; description: string };
      codesandbox: { name: string; description: string };
      code: { name: string; description: string };
      geogebra: { name: string; description: string };
      phet: { name: string; description: string };
      desmos: { name: string; description: string };
      blockly_games: { name: string; description: string };
      visualgo: { name: string; description: string };
      p5js: { name: string; description: string };
      excalidraw: { name: string; description: string };
      learningapps: { name: string; description: string };
      sqlonline: { name: string; description: string };
      typerun: { name: string; description: string };
      scratch: { name: string; description: string };
      google_docs: { name: string; description: string };
      google_sheets: { name: string; description: string };
      google_slides: { name: string; description: string };
    };
    // migration 118 — Промт 5Б: автосохранение + именованные проекты
    // (только CodeSandbox — python/cpp, единственный режим с реальным
    // персистируемым состоянием сейчас).
    projects: {
      myProjects: string;       // "Мои проекты"
      newProjectOption: string; // "Новый проект" — пункт списка = нет активного именованного проекта
      saveAsBtn: string;        // "Сохранить как..."
      renameBtn: string;        // "Переименовать"
      deleteBtn: string;        // "Удалить"
      savedLabel: string;       // "Сохранено"
      autosaveLabel: string;    // "Автосохранение"
      nameTakenToast: string;   // "Проект с таким названием уже есть"
      savedSecondsAgo: string;  // "{n} сек назад"
      savedMinutesAgo: string;  // "{n} мин назад"
      namePlaceholder: string;  // "Название проекта"
      deleteConfirm: string;    // "Удалить проект «{name}»?"
      cancelBtn: string;        // "Отмена"
      saveBtn: string;          // "Сохранить"
      limitReached: string;     // "Достигнут лимит проектов (20)"
    };
    // Z-Scratch, 10.08.2026 — экраны работ Scratch. Родные кнопки редактора
    // («Файл → Сохранить», «Поделиться», «Мои работы») переведены на нашу
    // платформу, поэтому все подписи вокруг них наши.
    scratch: {
      myWorks: string;          // кнопка на панели над редактором
      worksTitle: string;       // заголовок панели со списком
      closePanel: string;
      countLabel: string;       // "{n} из {limit}"
      emptyTitle: string;       // работ ещё нет
      emptyBody: string;        // как их получить — без этого экран немой
      openBtn: string;
      deleteBtn: string;
      deleteConfirm: string;    // "{name}"
      cancelBtn: string;
      originSandbox: string;
      originLesson: string;
      originHomework: string;
      sharedBadge: string;      // работа показана классу
      unitKb: string;           // "{n} КБ"
      unitMb: string;           // "{n} МБ"
      saving: string;
      opening: string;
      savedOk: string;
      sharedOk: string;
      openedOk: string;
      deletedOk: string;
      notReady: string;         // редактор ещё не прислал «готов»
      // Тексты отказов. server action возвращает машинный код, человеку
      // нужен смысл: раньше он видел молчание.
      errNotStudent: string;
      errTooBig: string;
      errLimit: string;
      errFailed: string;
      errOpenFailed: string;
      errDeleteFailed: string;
    };
  };
  // Iter5 P10 — standalone /ai-assistant page (Claude Design redesign);
  // separate from `ai.chat` above, which is the in-lesson "Робокот" panel.
  aiAssistant: {
    title: string;             // "AI-помощник"
    subtitle: string;          // "Твой умный помощник в учёбе — спрашивай что угодно"
    chatName: string;          // "EduOS Assistant"
    onlineStatus: string;      // "В сети"
    welcomeTitle: string;      // "Привет! Я твой помощник по учёбе."
    welcomeSubtitle: string;   // "Спроси меня про любой предмет или попроси объяснить тему."
    inputPlaceholder: string;  // "Спроси что-нибудь..."
    disclaimer: string;        // "AI может ошибаться. Проверяй важную информацию."
    errorFallback: string;     // "AI временно недоступен, попробуй позже"
    quickTopicsTitle: string;  // "Быстрые темы"
    quickTopicsSubtitle: string; // "Нажми, чтобы спросить"
    tipTitle: string;          // "Совет дня"
    tipBody: string;
    suggestions: string[];     // 4 quick-prompt chips
    // Пачка 3, Задача 2 — глобальный дневной лимит Gemini под чатом (миграция 136).
    usageLimitLabel: string;   // "Осталось запросов сегодня: {remaining} / {limit}" — интерполируются
    usageLimitReached: string;  // сообщение при исчерпании общего дневного лимита ученика
  };
  demo: {
    showToClass: string;       // "Показать классу"
    showingNow: string;        // "🔴 Демонстрируется"
    stopShowing: string;       // "Остановить демонстрацию"
    teacherShowing: string;    // "📺 Учитель показывает материал"
    unsupportedFormat: string;
    supportedFormats: string;
    lessonMustBeActive: string;
    onlyTeacherCanClose: string; // "Только учитель может закрыть"
    minimizeDemo: string;       // "Свернуть"
    maximizeDemo: string;       // "Развернуть"
    pdfLoading: string;
    pdfLoadError: string;
    pdfPageOf: string;          // "{current} из {total}"
  };
  // Публичный "Демо-режим" на /login (Iter4 Prompt 14) — отдельный неймспейс
  // от "demo" выше: тот про показ материала классу, этот про пробный вход.
  demoMode: {
    buttonLabel: string;   // "Демо-режим"
    shortLabel: string;    // "Демо" — for the compact OAuth-row button
    buttonHint: string;    // "Попробуйте платформу без регистрации"
    modalTitle: string;    // "Выберите демо-роль"
    modalSubtitle: string; // "Выберите роль чтобы попробовать платформу"
    loginBtn: string;      // "Войти"
    loginProgress: string; // "Вход..."
    bannerText: string;    // "Вы в демо-режиме. Все данные тестовые."
    bannerLogout: string;  // "Выйти"
    resetNote: string;     // P3-фикс: было "Данные тестовые. Автосброс через 3 часа
                            // неактивности." (устарело — этой логики нет с Пачки 2).
                            // Актуально: "Вы входите в реальный аккаунт..." + инфо про 15 мин.
    welcomeTitle: string;  // "Вы в демо-режиме"
    welcomeText: string;   // "Все данные тестовые."
    welcomeOk: string;     // "Понятно"
    // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 4.2 — pool claim/release model (migration 99)
    roleStudent10: string; // "Демо-ученик 10 класс"
    roleStudent7: string;  // "Демо-ученик 7 класс"
    roleStudent3: string;  // "Демо-ученик 3 класс"
    roleTeacher: string;   // "Демо-учитель" — kept for backward compat
    // PROMT 3 — per-subject demo teachers
    roleTeacherProgramming: string;
    roleTeacherRobotics: string;
    roleTeacherMath: string;
    roleTeacherEnglish: string;
    roleTeacherRussian: string;
    sectionStudents: string;
    sectionTeachers: string;
    allBusy: string;       // "Все демо-аккаунты заняты, попробуйте через несколько минут"
    loginFailed: string;   // демо-логин не удался по иной причине (не занятость пула)
    // Миграция 183: демо-школа не настроена — её ноль или, наоборот, флагом
    // is_demo помечены две. Функция claim_demo_slot в этом случае отказывает
    // ('demo_school_not_configured'), а не берёт первую попавшуюся школу.
    // Посетителю причина не сообщается: это внутренняя неисправность, и
    // подробности ему не нужны. Точная причина уходит в лог сервера.
    demoUnavailable: string;
    cannotEditRealData: string; // tooltip/ошибка: в демо нельзя менять реальные записи
    // P2-фикс (revert бага А пачки 2) — ОДНА кнопка «Демо» (buttonLabel/
    // shortLabel выше) открывает модалку. Раздельные studentButtonLabel/
    // teacherButtonLabel/modalTitleTeacher/modalSubtitleTeacher из
    // ошибочного разделения на 2 кнопки — убраны.
    // P3-фикс — модалка вернулась к исходной структуре «до Пачки 2»:
    // 3 карточки классов (случайный ученик ИЗ ЭТОГО класса, не из общего
    // пула) вместо одной общей карточки «Ученик» (modalCardStudent убран).
    modalSectionStudents: string;  // заголовок секции классов в модалке ("Ученики")
    modalCardGrade3: string;       // подпись карточки 3-го класса
    modalCardGrade7: string;       // подпись карточки 7-го класса
    modalCardGrade10: string;      // подпись карточки 10-го класса
    modalCardTeacher: string;      // заголовок секции предметников в модалке ("Учителя")
    slotOccupied: string;          // «занят» под занятой карточкой (класс ИЛИ предметник)
    parentButtonLabel: string;     // мобилка LoginScreen: «Демо родитель»
  };
  announcements: {
    title: string;
    empty: string;
    pinned: string;
    newBadge: string;
    by: string;
    dashboardTitle: string;
    dashboardEmpty: string;
    seeAll: string;
    validUntil: string;
    expired: string;
    tickerBadge: string;
    categoryGeneral: string;
    categoryAcademic: string;
    categoryEvent: string;
    categoryUrgent: string;
    categoryReminder: string;
  };
  notifications: {
    title: string;
    markAll: string;
    empty: string;
    seeAll: string;
    noMore: string;
    loadMore: string;
    delete: string;
    today: string;
    yesterday: string;
    agoSeconds: string; agoMinutes: string; agoHours: string; agoDays: string;
    tabNotifications: string;
    tabAnnouncements: string;
  };
  payments: {
    title: string;
    balance: string;
    paymentsHistory: string;
    chargesHistory: string;
    amount: string;
    date: string;
    type: string;
    subscription: string;
    oneTime: string;
    noData: string;
    statusActive: string;
    statusDebtor: string;
    statusFrozen: string;
    paymentStatusTitle: string;
    paidThisMonth: string;
    chargedThisMonth: string;
    myCourses: string;
    noPayments: string;
    noCharges: string;
    topupButton: string;
    topupTitle: string;
    topupStub: string;
    topupContacts: string;
    topupClose: string;
    showAll: string;
  };
  profile: {
    title: string;
    tabProfile: string;
    tabSecurity: string;
    tabNotifications: string;
    tabInterface: string;
    gradeLabel: string;
    curator: string;
    groups: string;
    language: string;
    theme: string;
    notifHomework: string;
    notifSchedule: string;
    notifGrades: string;
    notifAttendance: string;
    logout: string;
    edit: string;
  };
  settings: {
    title: string;
    tabProfile: string;
    tabSecurity: string;
    tabNotifications: string;
    tabInterface: string;
    fullName: string;
    username: string;
    email: string;
    phone: string;
    bio: string;
    avatar: string;
    changeAvatar: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordChanged: string;
    passwordReset: string;
    passwordMismatch: string;
    saveChanges: string;
    language: string;
    darkThemeComingSoon: string;
    notifySubmission: string;
    notifyLessonSoon: string;
    notifyAnnouncement: string;
    notifyLeaveRequest: string;
    notifyTitle: string;
  };
  // Пачка 3, Задача 4 — полноэкранный просмотр материалов (FileViewerModal)
  // с зумом/панорамированием. Отдельный от 'materials' (тот — про список/
  // фильтры страницы) и 'demo' (тот — про live-показ материала классу).
  viewer: {
    close: string;      // aria-label кнопки закрытия (X)
    zoomIn: string;      // aria-label кнопки "+"
    zoomOut: string;      // aria-label кнопки "-"
    resetZoom: string;   // текст/aria-label кнопки "100%"
    loadFailed: string;  // TextPreview: не удалось открыть файл
    loading: string;     // TextPreview: загрузка
  };
  materials: {
    title: string;
    searchPlaceholder: string;
    filterAll: string;
    filterPdf: string;
    filterVideo: string;
    filterPresentation: string;
    filterBook: string;
    filterLink: string;
    recentTitle: string;
    emptyTitle: string;
    emptyDesc: string;
    openFile: string;
    showMore: string;
    noAccess: string;
    openError: string;          // файл есть, но открыть не вышло
    presentationError: string;  // презентация есть, но не загрузилась
    presentationEmpty: string;  // слайдов нет вовсе — практический этап
    noFile: string;             // к материалу не приложен файл
  };
  books: {
    title: string;
    tabLibrary: string;
    tabFavorites: string;
    searchPlaceholder: string;
    emptyLibrary: string;
    emptyFavorites: string;
    download: string;
    addFavorite: string;
    removeFavorite: string;
    uploadTitle: string;
    uploadFile: string;
    uploadCover: string;
    uploadCoverOptional: string;
    fieldTitle: string;
    fieldAuthor: string;
    fieldSubject: string;
    fieldType: string;
    fieldDesc: string;
    uploading: string;
    successTitle: string;
    successSubtitle: string;
    uploadMore: string;
    done: string;
    deleteConfirm: string;
    menuDownload: string;
    menuDelete: string;
    typeTextbook: string;
    typeNotes: string;
    typeCollection: string;
    typeReference: string;
    allBooks: string;
    downloadTextbook: string;
    downloadConspect: string;
    downloadCollection: string;
    downloadReference: string;
  };
  lesson: {
    stagePreviewShow: string;
    stagePreviewHide: string;
    stagePreviewGaps: string;
    stagePreviewEmpty: string;
    stagePreviewLiveHint: string;
    stagePreviewTeacherOnly: string;
    markLockedTitle: string;   // замок на оценке (миграция 203)
    markLockedBody: string;
    markWindowLeft: string;    // «Исправить можно ещё {n} мин»
    markCommentAlways: string;
    markFreeWhileLesson: string; // урок идёт — замка нет (миграция 245)
    createNoSubjects: string;
    editSubjectHasGrades: string;   // «уже стоит оценок: {n}» — предупреждение при смене предмета
    createSelectSubject: string;
    back: string;
    progressTitle: string;
    stagesTitle: string;
    stage1: string;
    stage2: string;
    stage3: string;
    stage4: string;
    stage5: string;
    stage6: string;
    stagesOf: string;       // "{done}/{total} этапов"
    materialsTitle: string;
    materialsEmpty: string;
    homeworkTitle: string;
    homeworkEmpty: string;
    openHomework: string;
    cabinet: string;
    lessonOf: string;       // "Урок от {date}"
    download: string;
    linkLesson: string;     // "К какому уроку (опционально)"
    noLesson: string;       // "Не привязывать к уроку"
    selectSubjectFirst: string; // "Сначала выберите предмет"
    // Teacher lesson editor (migration 24)
    titleLabel: string;
    titlePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    aboutLesson: string;
    addStageLabel: string;
    stageCompletedLabel: string;
    teacherNotesLabel: string;
    teacherNotesPlaceholder: string;
    studentDescriptionLabel: string;
    // migration 60 — слайды презентации (этап теории)
    slides: {
      back: string;
      next: string;
      of: string;
      exportPptx: string;
      empty: string;
      slideOf: string;
      teacherOnly: string;
      fullscreen: string;
      exitFullscreen: string;
      fullscreenTitle: string; // header shown in the auto-fullscreen student presentation overlay
      /** Ученику на короткое нажатие Esc, пока этап активен. */
      lockedHint: string;
      /** Ученику, пока он удерживает Esc (рядом с индикатором прогресса). */
      holdingExit: string;
    };
    contentSource: {
      label: string;
      ai: string;
      aiDesc: string;
      file: string;
      fileDesc: string;
      text: string;
      textDesc: string;
    };
    removeStageLabel: string;
    stagesHint: string;
    addMaterialLabel: string;
    addMaterialTitle: string;
    materialTitleLabel: string;
    materialTitlePlaceholder: string;
    lessonsList: string;
    backToLessons: string;
    saveBtn: string;
    uploading: string;
    deleteConfirm: string;
    // Lesson features (migration 30)
    nowStarting: string;          // "Сейчас начинается урок"
    startsInLabel: string;        // "Урок начнётся через {time}"
    goToLesson: string;           // "Перейти"
    goToLessonNow: string;        // "сейчас"
    countdownNote: string;        // "Переход в режим урока через {n} секунд"
    teacherLabel: string;         // "Учитель"
    // Iter5 P7 — hint stub card (code stage)
    needHelp: string;             // "Нужна помощь с задачей?"
    showHint: string;             // "Подсказка"
    hintComingSoon: string;       // "Скоро будет доступно"
    // Iter5 P14 — waiting screen (scheduled lesson)
    untilStart: string;           // "до начала" (countdown label)
    // Плановое начало этого конкретного урока (starts_at) — показывается
    // рядом с LOOPED countdown (тот — "пульс дня", а не время конкретного
    // урока), чтобы не терялась привязка ко времени в расписании.
    plannedStart: string;         // "Плановое начало"
    autoOpen: string;             // "Урок откроется, когда его начнёт учитель"
    /** 11.08.2026 — только число этапов. Минуты убраны из подписи: сумма
     *  длительностей этапов и длительность урока — независимые величины. */
    planStagesSummary: string;    // "{count} этапов"
    planTopicPrefix: string;      // "Тема ·"
    planEmptyPlaceholder: string; // "Учитель ещё не добавил план урока" (Iter5 hotfix P14.1)
    excuse: {
      button: string;             // "Отпроситься"
      title: string;              // "Отпроситься с урока"
      subtitle: string;           // "Учитель увидит вашу заявку до начала урока"
      reasonLabel: string;        // "Причина"
      reasonPlaceholder: string;
      submit: string;             // "Отправить заявку"
      sending: string;            // "Отправка…"
      cancel: string;             // "Отмена"
      minLengthError: string;     // "Минимум 5 символов"
      requestedTitle: string;     // "Вы отпросились"
      reasonPrefix: string;       // "Причина:"
      cancelRequest: string;      // "Отменить заявку"
      teacherTitle: string;       // "Отпросились" (+ count)
    };
    raisedHand: {
      raise: string;              // "Поднять руку"
      raised: string;             // "Рука поднята"
      teacherSees: string;        // "Учитель видит"
      teacherTitle: string;       // "Поднятые руки"
      empty: string;              // "Никто не поднял руку"
      lower: string;              // "Опустить руку"
      agoSeconds: string;         // "{n} сек назад"
      agoMinutes: string;         // "{n} мин назад"
      error: string;              // "Не удалось поднять руку"
      studentRaisedHand: string;  // "{name} поднял(а) руку"
      acknowledge: string;        // "Обратил внимание"
    };
    workspace: {
      live: string;               // "Урок идёт"
      task: string;               // "Задание"
      noTask: string;             // "На этом этапе задания нет"
      materials: string;          // "Материалы"
      aiTitle: string;            // "AI-помощник"
      aiPrompt: string;           // "Затрудняешься? Чем я могу помочь тебе сегодня?"
      aiAsk: string;              // "Задать вопрос"
      soon: string;               // "Скоро будет доступно"
      backToLesson: string;       // fullscreen stage: "← Назад к уроку"
      submit: string;             // fullscreen stage: "Сдать"
      submitted: string;          // fullscreen stage: "✓ Сдано"
      submittedSuccessfully: string; // "Решение отправлено учителю"
      submitError: string;        // "Ошибка отправки. Попробуйте ещё раз"
      collapse: string;           // "Свернуть sidebar"
      expand: string;             // "Развернуть sidebar"
      stages: string;             // "Этапы"
      noMaterials: string;        // "Нет материалов"
      // Iter5 P6 — Stitch lesson workspace redesign
      fullscreen: string;         // "Во весь экран"
      fullscreenExit: string;     // "Выйти из полноэкранного режима"
      helpTitle: string;          // sidebar tip card: "Нужна помощь?"
      helpSubtitle: string;       // "Спроси учителя или подними руку"
      // Iter5 P13 — Claude Design header/sidebar redesign
      lessonNumberLabel: string;  // "Урок {n}" pill in header
      stagePlan: string;          // sidebar card title: "План урока"
      stageLockedShort: string;   // upcoming-step sidebar label (lock icon)
    };
    // Stage constructor v2 (migration 35)
    stageStartLabel: string;           // "Старт"
    stageSummaryLabel: string;         // "Итог"
    stageBadgeTheory: string;          // "Теория"
    stageBadgeTask: string;            // "Задача"
    stageContentPresentation: string;  // "Презентация"
    stageContentCode: string;          // "Программирование (код)"
    stageContentWokwi: string;         // "Wokwi"
    stageContentCodesandbox: string;   // "CodeSandbox"
    stageContentGeogebra: string;      // "GeoGebra"
    stageContentPhet: string;          // "PhET Simulations"
    stageContentDesmos: string;        // "Desmos"
    stageContentBlocklyGames: string;  // "Blockly Games"
    stageContentVisualgo: string;      // "VisuAlgo"
    stageContentP5js: string;          // "p5.js Web Editor"
    stageContentExcalidraw: string;    // "Excalidraw"
    stageContentLearningapps: string;  // "Learning Apps"
    stageContentSqlonline: string;     // "SQL Online"
    stageContentTyperun: string;       // "TypeRun"
    stageContentScratch: string;       // "Scratch"
    stageContentGoogleDocs: string;  // "Google Документы"
    stageContentCodeCompletion: string; // "Код с пропусками"
    stageContentQuizQia: string;       // "Тест (QIA)"
    stageContentQuizKahoot: string;    // "Квиз-игра (Kahoot)"
    stageStepLabel: string;            // "Этап {n}"
    stageAddBtn: string;               // "+ Добавить этап"
    stageAddModalTitle: string;        // "Добавить этап"
    stageEditModalTitle: string;       // "Редактировать этап"
    stageStep1Title: string;           // "Шаг 1: Тип этапа"
    stageStep2Title: string;           // "Шаг 2: Тип содержимого"
    stageStep3Title: string;           // "Шаг 3: Настройка"
    stageTypeTheoryLabel: string;      // "Теория"
    stageTypeTheoryDesc: string;       // "Ученик изучает материал, отмечает «Изучил», без оценки"
    stageTypeTaskLabel: string;        // "Задача"
    stageTypeTaskDesc: string;         // "Ученик выполняет задание, оценивается"
    stageTitleLabel: string;           // "Название этапа"
    stageTitlePlaceholder: string;     // "Введение в циклы"
    stageDescLabel2: string;           // "Описание / инструкция"
    stageDescPlaceholder2: string;     // "Опишите задание..."
    // Сложность + длительность этапа (migration 55)
    stageDifficultyLabel: string;      // "Сложность этапа"
    stageDifficultyEasy: string;       // "Лёгкий"
    stageDifficultyMedium: string;     // "Средний"
    stageDifficultyHard: string;       // "Сложный"
    stageDurationLabel: string;        // "Длительность (мин)"
    stageDurationHint: string;         // "Необязательно. ИИ сам распределит время по этапам."
    stageContentStubNote: string;      // "Настройка этого типа контента — в следующем обновлении"
    stageAddConfirmBtn: string;        // "Добавить"
    stageSaveBtn2: string;             // "Сохранить"
    stageDeleteConfirmMsg: string;     // "Удалить этот этап? Действие нельзя отменить."
    stageMoveUp: string;               // "Выше"
    stageMoveDown: string;             // "Ниже"
    // Student stage progress
    stagePassed: string;               // "Пройдено"
    stageCurrent: string;              // "Текущий"
    stageUpcoming: string;             // "Предстоящий"
    stageOpenBtn: string;              // "Открыть"
    stageNoContent: string;            // "У этого этапа пока нет содержимого"
    stageTaskSubmittedLabel: string;   // "Сдано"
    stageTaskGradedLabel: string;      // "Оценка"
    stageTaskCloseBtn: string;         // "Закрыть"
    // Auto-schedule + visibility (migration 36)
    completedLock: string;             // "Урок завершён. Редактирование недоступно."
    stageLocked: string;               // "Сначала пройди"
    stageLockedSummary: string;        // "Доступно после завершения урока"
    materialVisibilityAll: string;     // "Видно всем"
    materialVisibilityTeacher: string; // "Только для учителя"
    materialTeacherOnlyBadge: string;  // "Только для учителя"
    materialVideoUrlLabel: string;     // "или вставить ссылку на видео (YouTube / RuTube)"
    materialInvalidVideoUrl: string;   // "Ссылка должна быть на YouTube или RuTube"
    materialVideoTag: string;          // "Видео"
    bannerStarted: string;             // "Урок начался!"
    bannerGo: string;                  // "Перейти →"
    // Reminder modal (teacher, 5 min before end)
    reminderTitle: string;             // "До конца урока 5 минут"
    reminderBody: string;              // "У вас осталась неоконченная перекличка..."
    reminderUnmarked: string;          // "Не отмечены:"
    reminderGoToRollCall: string;      // "Перейти к перекличке"
    // Inline attendance reminder banner (replaces modal)
    attendanceReminderTitle: string;   // "До конца урока осталось {minutes} мин."
    attendanceReminderHint: string;    // "Не забудьте сделать перекличку"
    attendanceReminderUrgent: string;  // "Скоро урок закончится — пожалуйста сделайте перекличку"
    attendanceMadeCheckOthers: string; // "Перекличка сделана. Проверьте оценки и задачи"
    // 23.08.2026 (миграция 225) — запас времени после звонка и счёт неотмеченных.
    attendanceGraceTitle: string;      // "Урок закончился. На перекличку осталось {minutes} мин."
    attendanceUnmarkedCount: string;   // "Не отмечено: {count}"
    attendanceAutoAbsentWarn: string;  // "Неотмеченным ученикам автоматически поставят пропуск"
    reminderAndMore: string;           // "и ещё {count}"
    makeAttendance: string;            // "Сделать перекличку"
    openAttendance: string;            // "Открыть посещаемость"
    openGrades: string;                // "Оценки"
    // Lesson status — manual start/end only (решение 21.07, авто-режим по времени отключён)
    inProgressAutoNote: string;        // "Урок идёт."
    startLessonBtn: string;            // "Начать урок" — БОЛЬШОЕ ОБНОВЛЕНИЕ §7.6
    startBlockedPastDay: string;       // урок прошедшего дня начать нельзя (миграция 173)
    endLessonBtn: string;              // "Закончить урок" — ТОЛЬКО учитель, завершает урок для всех
    endLessonConfirm: string;          // confirm text before manual end (учитель)
    reloadPage: string;                // "Обновить страницу" — reload button next to endLessonBtn
    leaveLessonBtn: string;            // "Выйти из урока" — ученик, чисто клиентская навигация, урок продолжается для остальных
    liveScores: {                      // §7.7 — live quiz_qia/quiz_kahoot scores table
      title: string;
      student: string;
      correct: string;
      grade: string;
      empty: string;
      updating: string;
    };
    // Programming code stages (Prompt 4)
    code: {
      backToStages: string;
      problemStatement: string;
      language: string;
      python: string;
      cpp: string;
      starterCode: string;
      starterCodePlaceholder: string;
      expectedOutput: string;
      expectedOutputHint: string;
      editorLabel: string;
      stdin: string;
      stdinPlaceholder: string;
      stdinPaste: string;
      stdinAdd: string;
      stdinTotal: string;
      run: string;
      running: string;
      runFirst: string;       // first Pyodide load (5–15s)
      runningCpp: string;     // JSCPP compiling/interpreting (browser, no server round-trip)
      cppUnsupported: string; // JSCPP hit a language/library feature it never implemented
      output: string;
      emptyOutput: string;
      clear: string;
      submit: string;
      confirmSubmit: string;
      submittedWaiting: string;
      error: string;
      compileError: string;
      timeout: string;
      loading: string;
      graded: string;
      teacherComment: string;
      openEditor: string;
      // teacher review
      reviewSubmissions: string;
      noSubmissions: string;
      openSolution: string;
      studentCode: string;
      studentStdin: string;
      studentOutput: string;
      runHere: string;
      gradeField: string;
      commentField: string;
      saveGrade: string;
      gradeSaved: string;
      submittedAt: string;
    };
    // External services: wokwi / codesandbox
    external: {
      wokwi: string;
      codesandbox: string;
      wokwiDesc: string;
      codesandboxDesc: string;
      service: string;            // "Сервис"
      projectLink: string;        // teacher config field
      leaveEmptyHint: string;     // "Оставьте пустым для открытия чистого редактора"
      open: string;               // student stage open button
      openService: string;        // "Открыть" (+ service name)
      openInNewTab: string;
      cantEmbedHint: string;      // teacher config note
      opensInNewTab: string;      // student note
      afterWork: string;          // "После работы вернись и прикрепи результат"
      loadError: string;
      loadErrorBody: string;
      openEditor: string;
      attachResult: string;       // "Прикрепи результат"
      attachResultOptional: string;
      attachLink: string;
      attachScreenshot: string;
      chooseFile: string;
      requiredLink: string;       // checkbox label
      requiredScreenshot: string; // checkbox label
      atLeastOne: string;
      mustAttachHint: string;     // "Ученик не сможет сдать пока не прикрепит…"
      submitAndSave: string;
      confirmSubmit: string;
      submittedWaiting: string;
      // teacher review
      reviewSubmissions: string;
      noSubmissions: string;
      openStudentProject: string;
      studentLink: string;
      studentScreenshot: string;
      openedAt: string;
      submittedAt: string;
      gradeField: string;
      commentField: string;
      saveGrade: string;
      gradeSaved: string;
      graded: string;
      teacherComment: string;
      fullscreen: string;         // "На весь экран" (УЧ.10 Part 5)
      exitFullscreen: string;     // "Свернуть"
    };
    // Quizzes: QIA test + Kahoot game (Prompt 6)
    quiz: {
      // builder (teacher)
      addQuestion: string;
      question: string;            // "Вопрос {n}"
      questionText: string;
      questionPlaceholder: string;
      option: string;             // "Вариант"
      correct: string;            // "Правильный"
      secondsPerQuestion: string; // Kahoot
      limitTime: string;          // QIA checkbox
      minutesForTest: string;     // QIA
      pointsPerCorrect: string;   // QIA
      deleteQuestion: string;
      minOneQuestion: string;
      invalidQuestions: string;
      // QIA player
      test: string;
      time: string;
      questionOf: string;         // "Вопрос {n} из {total}"
      prev: string;
      next: string;
      finish: string;
      confirmFinish: string;
      resultTitle: string;        // "Молодец!"
      youAnsweredCorrectly: string;
      ofTotal: string;            // "{correct} из {total}"
      grade: string;
      review: string;
      correctLabel: string;       // "правильно"
      correctAnswerWas: string;   // "правильный ответ —"
      closeReturn: string;
      start: string;
      timeUp: string;
      open: string;               // student open button
      // Kahoot common
      players: string;
      waitingStudents: string;
      startGame: string;
      answeredCount: string;      // "Ответили"
      correctAnswer: string;
      topThree: string;
      nextQuestion: string;
      gameOver: string;
      winner: string;
      points: string;
      leaderboard: string;
      waitingQuestion: string;
      waitingQuestionHint: string;
      restartGame: string;
      restartGameConfirm: string;
      close: string;
      launchGame: string;
      results: string;
      noAttempts: string;
      // Kahoot student
      waitingTeacher: string;
      teacherWillStart: string;
      ready: string;
      answerRecorded: string;
      waitingOthers: string;
      yourAnswer: string;
      correctPlus: string;        // "Правильно! +{n}"
      wrongAnswer: string;
      totalScore: string;
      yourPlace: string;          // "Твоё место"
      waitingNext: string;
      yourResult: string;
      place: string;              // "место"
      you: string;                // "ТЫ"
      reviewSubmissions: string;  // teacher: see QIA results
      noSubmissions: string;
      viewResult: string;        // student: re-open finished kahoot/qia read-only
      kindQuiz: string;          // grade badge: lesson quiz (QIA)
      kindKahoot: string;        // grade badge: kahoot game
      kindExternal: string;      // grade badge: external service stage
      // Iter5 P13 — Claude Design QIA/Kahoot inline redesign
      timeLabel: string;         // "Время" (QIA countdown ring)
      kahootLiveNow: string;     // "Идёт сейчас" header pill while a kahoot session is active
      yourStreak: string;        // "Серия" — consecutive correct answers (Kahoot stats bar)
      questionShort: string;     // "Вопрос" — badge above the QIA question card
    };
    // Leave requests (migration 47) — student requests to leave during in_progress lesson
    leave: {
      button: string;             // "Отпроситься"
      title: string;              // "Запрос на выход с урока"
      reasonLabel: string;        // "Причина"
      reasonIll: string;          // "Плохое самочувствие"
      reasonFamily: string;       // "Семейные обстоятельства"
      reasonMedical: string;      // "Медицинская причина"
      reasonOther: string;        // "Другое"
      otherPlaceholder: string;   // "Укажите причину…"
      submit: string;             // "Отправить запрос"
      sending: string;            // "Отправка…"
      cancel: string;             // "Отмена"
      pending: string;            // "На рассмотрении"
      approved: string;           // "Одобрен"
      rejected: string;           // "Отклонён"
      cancelRequest: string;      // "Отменить запрос"
      teacherTitle: string;       // "Запросы на выход"
      teacherEmpty: string;       // "Запросов нет"
      approve: string;            // "Одобрить"
      reject: string;             // "Отклонить"
    };
    // Lesson grade modal (teacher, migration 40)
    gradeStudent: string;          // modal title prefix "Оценить ученика:"
    gradeChoose: string;           // "Выбери оценку"
    gradeComments: {
      "1": string[];               // 3 preset comments for grade 1
      "2": string[];
      "3": string[];
      "4": string[];
      "5": string[];
    };
    gradeOther: string;            // "Другое"
    gradeOtherPlaceholder: string; // textarea placeholder
    gradeSave: string;             // "Сохранить оценку"
    gradeSaved: string;            // toast "Оценка сохранена"
    kindLesson: string;            // grade badge in /grades + filter pill
    // Active stage control (migration 54)
    activeStage: {
      manageStages: string;        // "Управление этапами"
      activeNow: string;           // "Активен сейчас"
      activate: string;            // "Активировать"
      passed: string;              // "Пройдено"
      activatedToast: string;      // "Этап активирован"
      teacherChangedStage: string; // "Учитель перешёл к новому этапу"
      lessonNotStarted: string;    // "Урок ещё не начат"
      waitingForTeacher: string;   // "Учитель готовит следующий этап…"
      studentsSeeThis: string;     // "Все ученики видят этот этап"
      activateFailed: string;      // "Не удалось активировать этап. Попробуйте ещё раз."
    };
    // Live coding (migration 64) — учитель пишет код в реальном времени
    live: {
      start: string;        // "Начать Live"
      stop: string;         // "Остановить Live"
      liveOn: string;       // "🔴 LIVE — ученики видят ваш код"
      liveOff: string;      // "Live-демонстрация выключена"
      title: string;        // fullscreen student modal: "Учитель показывает код вживую"
    };
    // Completion modal (Iter4 Prompt 3)
    completedTitle: string;
    completedTopic: string;
    completedDuration: string;
    completedRedirect: string;
    completedGoNow: string;
  };
  teacher: {
    bulkBtn: string;
    bulkTitle: string;
    bulkSubtitle: string;
    bulkGroup: string;
    bulkSubject: string;
    bulkWeekdays: string;
    bulkTime: string;
    bulkPerDayTime: string;        // «Своё время по дням» (пункт 11)
    bulkPerDayTimeHint: string;
    bulkTimeSame: string;          // подпись общего времени, когда режим выключен
    bulkFrom: string;
    bulkTo: string;
    bulkRoom: string;
    bulkTopics: string;
    bulkTopicsHint: string;
    bulkTopicsNone: string;
    bulkPreviewBtn: string;
    bulkPreviewLoading: string;
    bulkPreviewTitle: string;
    bulkWillCreate: string;
    bulkOccupied: string;
    bulkNoTopic: string;
    bulkTopicsLeft: string;
    bulkNothing: string;
    bulkCreateBtn: string;
    bulkCreating: string;
    bulkDone: string;
    bulkBack: string;
    bulkOccupiedRow: string;
    bulkNoTopicRow: string;
    bulkPickWeekday: string;
    bulkBadPeriod: string;
    wdMon: string;
    wdTue: string;
    wdWed: string;
    wdThu: string;
    wdFri: string;
    wdSat: string;
    wdSun: string;
    curTopicCreateLesson: string;
    curTopicCreating: string;
    curTopicOpenLesson: string;
    curTopicLessonAt: string;
    curTopicLessonExists: string;
    curAddTopic: string;
    curAddTopicTitle: string;
    curAddTopicPlaceholder: string;
    curAddTopicDescription: string;
    curAddTopicHint: string;
    curAddTopicSave: string;
    curAddTopicSaving: string;
    curAddTopicEmpty: string;
    curAddTopicFailed: string;
    role: string;
    navHome: string;
    navHomework: string;
    navGrades: string;
    navMaterials: string;
    navKnowledgeBase: string; // "База знаний" — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1, replaces navMaterials+navBooks in the sidebar
    navGroups: string;
    navProfile: string;
    kpiGroups: string;
    kpiActive: string;
    kpiPending: string;
    kpiStudents: string;
    kpiLessonsDone: string;      // "{done} из {total}" — плитка «Уроков сегодня»
    kpiPendingReview: string;    // плитка «Непроверенные работы» (03.09.2026)
    // 24.08.2026 — расписание на дашборде учителя.
    scheduleTitle: string;       // "Расписание сегодня"
    scheduleFreeDay: string;     // "Свободный день"
    scheduleFreeDayHint: string; // "Уроков на сегодня не запланировано"
    lessonNow: string;           // "Идёт"
    lessonDone: string;          // "Завершён"
    lessonRoom: string;          // "Кабинет"
    todayLessons: string;
    noLessons: string;
    noActivity: string;
    homeworkTitle: string;
    createBtn: string;
    filterAll: string;
    filterFiles: string;
    filterTests: string;
    filterGroup: string;
    allGroups: string;
    progressLabel: string;
    openBtn: string;
    statsTitle: string;
    statsActive: string;
    statsPending: string;
    statsDone: string;
    statsOverdue: string;
    menuEdit: string;
    menuDelete: string;
    menuDuplicate: string;
    menuStub: string;
    newHomeworkTitle: string;
    step1Title: string;
    step1Test: string;
    step1File: string;
    step1TestDesc: string;
    step1FileDesc: string;
    formName: string;
    formDesc: string;
    formDeadline: string;
    formGroup: string;
    formSubject: string;
    hwGroupAuto: string;
    hwGroupAutoHint: string;
    hwGroupManual: string;
    hwGroupManualHint: string;
    hwGroupExternal: string;
    hwGroupExternalHint: string;
    hwGroupExternalCount: string;
    hwGroupExternalAll: string;
    hwRequiredLegend: string;
    hwLessonNeedsSubject: string;
    hwErrTitle: string;
    hwErrTask: string;
    hwErrGaps: string;
    hwErrGroup: string;
    hwErrDeadline: string;
    hwErrFileTooBig: string;
    hwErrNoSession: string;
    hwErrNoTeacher: string;
    formType: string;
    saveDraft: string;
    publish: string;
    addQuestion: string;
    questionText: string;
    questionType: string;
    singleChoice: string;
    openQuestion: string;
    addOption: string;
    markCorrect: string;
    aiGenerate: string;
    aiStub: string;
    fileUploadStub: string;
    detailStats: string;
    detailSubmitted: string;
    detailAvgScore: string;
    detailStudents: string;
    statusSubmitted: string;
    statusNotSubmitted: string;
    statusGraded: string;
    statusOverdue: string;
    statusPending: string;
    reviewBtn: string;
    reviewTitle: string;
    reviewAnswers: string;
    reviewGrade: string;
    reviewComment: string;
    reviewAiHint: string;
    reviewSend: string;
    reviewCorrect: string;
    reviewWrong: string;
    reviewPending: string;
    aiReviewNavLabel: string;
    aiReviewPageTitle: string;
    aiReviewEmpty: string;
    aiGrade: string;
    aiFeedbackStrengths: string;
    aiFeedbackWeaknesses: string;
    aiFeedbackSuggestions: string;
    aiFeedbackSummary: string;
    aiReviewStudentAnswer: string;
    aiReviewConfirmBtn: string;
    aiReviewEditConfirmBtn: string;
    aiReviewManualBtn: string;
    aiReviewPendingBadge: string;
    aiReviewOpenBtn: string;
    groupsTitle: string;
    groupStudents: string;
    groupAttendance: string;
    groupAvgScore: string;
    groupClassPrefix: string;
    groupsSearchPlaceholder: string;
    groupRecentLessons: string;
    groupGradesCounted: string;
    gradesExportStudent: string;
    gradesExportClassAvg: string;
    gradesExportAssignments: string;
    gradesExportLessonGrades: string;
    gradesExportLesson: string;
    gradesExportTopic: string;
    profileTitle: string;
    profileSubjects: string;
    profileGroups: string;
    materialsTitle: string;
    materialsUploadBtn: string;
    materialsEmpty: string;
    materialsUploadTitle: string;
    materialsName: string;
    materialsDesc: string;
    materialsSubject: string;
    materialsGroup: string;
    materialsLesson: string;
    materialsFile: string;
    materialsDragDrop: string;
    materialsMaxSize: string;
    materialsUploading: string;
    materialsSuccess: string;
    materialsDeleteConfirm: string;
    materialsDeleting: string;
    materialsDownload: string;
    materialsDelete: string;
    materialsLessonOptional: string;
    materialsAllGroups: string;
    materialsAllSubjects: string;
    // 6А, Заход B — Библиотека материалов учителей (/teacher/library,
    // migration 147). Отдельная от materials*/books* — свой раздел,
    // видимый только учителям, куратор смотрит, но не грузит.
    libraryTitle: string;
    libraryUploadBtn: string;
    libraryEmpty: string;
    libraryEmptyFiltered: string;
    libraryError: string;
    librarySearchPlaceholder: string;
    libraryAllSubjects: string;
    libraryAllClasses: string;
    libraryUploadedBy: string;
    libraryDownload: string;
    libraryDelete: string;
    libraryDeleting: string;
    libraryUploadTitle: string;
    libraryName: string;
    libraryNamePlaceholder: string;
    librarySubjectLabel: string; // "Ваш предмет" — read-only, резолвится из роли
    libraryClassesLabel: string;
    libraryFile: string;
    libraryDragDrop: string;
    libraryMaxSize: string; // "PDF, PPTX, JPG, PNG, MP4 — макс. 50 МБ"
    libraryCancel: string;
    libraryUpload: string;
    libraryUploading: string;
    librarySuccess: string;
    libraryCuratorNotice: string;
    libraryErrTitleRequired: string;
    libraryErrFileRequired: string;
    libraryErrFileTooLarge: string;
    libraryErrFileType: string;
    libraryErrUploadFailed: string;
    libraryErrDeleteFailed: string;
    // 6А, Заход D — видео-ссылки (migration 148).
    libraryAddVideoBtn: string;
    libraryVideoModalTitle: string;
    libraryVideoUrlLabel: string;
    libraryVideoUrlPlaceholder: string;
    libraryErrVideoUrlRequired: string;
    libraryErrVideoUrlInvalid: string;
    /** Прямая .mp4-ссылка: хранить негде, нужен загруженный файл. */
    libraryErrVideoMp4Link: string;
    libraryVideoBadge: string;
    navLessons: string;
    navCurriculumPlans: string;
    navBooks: string;
    booksTitle: string;
    booksUploadBtn: string;
    booksEmpty: string;
    booksUploadTitle: string;
    booksFile: string;
    booksCover: string;
    booksCoverOptional: string;
    booksFieldTitle: string;
    booksFieldAuthor: string;
    booksFieldSubject: string;
    booksFieldType: string;
    booksFieldDesc: string;
    booksUploading: string;
    booksSuccessTitle: string;
    booksSuccessSubtitle: string;
    booksUploadMore: string;
    booksDone: string;
    booksMenuDownload: string;
    booksMenuDelete: string;
    hwAttachLabel: string;
    hwAttachBtn: string;
    hwAttachProgress: string;
    hwDeleteAttach: string;
    hwDeleteAttachConfirm: string;
    hwDownloadAttach: string;
    hwHintLabel: string;      // "Подсказка ученику" — БОЛЬШОЕ ОБНОВЛЕНИЕ §8.1
    hwHintHint: string;
    hwHintBtn: string;
    hwHintInvalidType: string;
    hwCreatedMsg: string;
    bundleSubtasksBlock: string;
    bundleAddSubtask: string;
    bundleSubtaskType: string;
    bundleSubtaskTitle: string;
    bundleSubtaskDesc: string;
    bundleMinHint: string;
    bundleRemoveSubtask: string;
    bundleEmptyHint: string;
    bundleGradeLabel: string;
    bundleCommentLabel: string;
    bundleStudentAnswers: string;
    reviewDownloadWork: string;
    rollCallTitle: string;
    rollCallSubtitle: string;
    rollCallFinalizedNote: string;
    rollCallAutoFixNote: string;       // "Перекличка закрыта. Автоматические пропуски ещё можно исправить"
    rollCallAutoMarked: string;        // "автоматически"
    rollCallPresent: string;
    rollCallExcused: string;
    rollCallUnexcused: string;
    rollCallSaved: string;
    rollCallMarkAll: string;        // «Отметить остальных» (пункт 15)
    rollCallMarkAllHint: string;
    rollCallMarkAllNone: string;
    rollCallGradeAll: string;       // «Оценить остальных»
    rollCallGradeAllNone: string;
    bulkPartialSaved: string;       // «Сохранено {ok} из {all}»
    rollCallStats: string;
    endLessonConfirmTitle: string;
    endLessonConfirmMsg: string;
    incompleteAttendanceTitle: string;
    incompleteAttendanceMsg: string;
    rollCallUnmarked: string;
    // Проверка задания по программированию у учителя. Имена ключей —
    // наследие классной работы, которой больше нет: сам раздел удалён
    // 20.08.2026, а эти три подписи живут на другом экране
    // (teacher/homework/[id]/TeacherProgrammingSubmissions.tsx), поэтому
    // и остались. Переименование тронуло бы экран домашних заданий.
    classworkCommentLabel: string;
    classworkGradeBtn: string;
    classworkGradedLabel: string;
    projects: {
      nav: string;              // "Проекты"
      title: string;
      create: string;
      empty: string;
      stagesCount: string;      // "{n} этапов"
      submittedCount: string;   // "{done}/{total} сдали"
      formTitle: string;
      editTitle: string;
      group: string; subject: string; name: string; description: string; deadline: string;
      stagesBlock: string;
      addStage: string;
      stageTitle: string;
      stageDesc: string;
      createBtn: string;
      saveBtn: string;
      deleteConfirm: string;
      studentsBlock: string;
      notStarted: string; inWork: string; awaiting: string; graded: string;
      review: string;
      studentNotes: string;
      files: string;
      gradeLabel: string; commentLabel: string; gradeBtn: string; gradedLabel: string;
      noStages: string;
      tabProjects: string;
      tabScratch: string;
      scratchTitle: string;
      scratchHint: string;
      scratchEmpty: string;
      scratchEmptyHint: string;
      scratchNothingFound: string;
      scratchSearch: string;
      scratchFromLesson: string;
      scratchFromHomework: string;
      scratchShared: string;
      scratchOpen: string;
      scratchClose: string;
      scratchOpening: string;
      scratchOpenFailed: string;
      scratchViewOnly: string;
      scratchCount: string;
      scratchAllGroups: string;
    };
    announcements: {
      nav: string;
      title: string;
      create: string;
      empty: string;
      formTitle: string;
      titleLabel: string; bodyLabel: string;
      audience: string;
      audienceGroup: string; audienceAll: string; audienceStudent: string;
      pinLabel: string;
      publish: string;
      audienceGroupLabel: string;   // "Группа {name}"
      audienceAllLabel: string;     // "Все мои группы"
      readCount: string;            // "Прочитали: {read} из {total}"
      pin: string; unpin: string; delete: string; deleteConfirm: string;
      pinnedTag: string;
      categoryLabel: string;
      isTickerLabel: string;
      validUntilLabel: string;
      // П.3 Заход 2 — добавлено при i18n-переводе AdminAnnouncementsView
      errorRequiredFields: string;
      errorSelectGroup: string;
      scopeGroupFallback: string;
      scopeStudentFallback: string;
      scopeAllGroups: string;
    };
  };
  submission: {
    dropAction: string;
    dropHint: string;
    fileTooLarge: string;
    fileWrongType: string;
    removeFile: string;
    attachedTitle: string;
    openFile: string;
    openFailed: string;
    stateSaving: string;
    stateSaved: string;
    stateError: string;
    statusDraft: string;
    statusSubmitted: string;
    submittedAt: string;
    yourAnswer: string;
    redo: string;
    redoCancel: string;
    lockedByGrade: string;
    uploading: string;
    uploadFailed: string;
    noFile: string;
  };
  ai: {
    workElapsed: string;
    workUsually: string;
    workStepModel: string;
    workStepSaving: string;
    workStepMaterials: string;
    workStepHomework: string;
    workOf: string;
    chat: {
      title: string;             // "Робокот"
      placeholder: string;       // "Напиши вопрос…"
      send: string;              // "Отправить"
      welcomeMessage: string;    // "Привет! Я Робокот 🤖…"
      remaining: string;         // "Осталось: {n} из {total}"
      limitReached: string;      // "Лимит на сегодня исчерпан…"
      error: string;             // "Что-то пошло не так…"
      collapse: string;          // "Свернуть"
      expand: string;            // "Развернуть"
      loading: string;           // "Думаю…"
    };
    generateHomework: {
      button: string;
      title: string;
      topicLabel: string;
      topicPlaceholder: string;
      levelLabel: string;
      hintsLabel: string;
      hintsPlaceholder: string;
      bundleTypesLabel: string;
      bundleTypesHint: string;
      generateBtn: string;
      generating: string;
      error: string;
      appliedToast: string;
    };
    generate: {
      button: string;            // "✨ Добавить этапы через ИИ"
      title: string;             // "Создать этапы через ИИ"
      topic: string;             // "Тема урока"
      topicPlaceholder: string;  // "Например: Циклы в Python"
      grade: string;             // "Класс"
      stageTypes: string;        // "Какие этапы создать?"
      theory: string;            // "Теория (презентация)"
      code: string;              // "Программирование"
      quizQia: string;           // "Тест (QIA)"
      quizKahoot: string;        // "Квиз-игра (Kahoot)"
      quizCount: string;         // "Вопросов в тесте"
      kahootCount: string;       // "Вопросов в Kahoot"
      generating: string;        // "Создаю этапы…"
      regenerate: string;        // "Сгенерировать заново"
      addToLesson: string;       // "Добавить в урок"
      preview: string;           // "ИИ создал {n} этапов. Проверь и подтверди:"
      error: string;             // "Не удалось создать этапы"
      retry: string;             // "Попробовать заново"
      edit: string;              // "Редактировать"
      remove: string;            // "Убрать"
      adding: string;            // "Добавляю…"
      added: string;             // "Этапы добавлены!"
      stageQuestions: string;    // "{n} вопросов"
      // Итерация 3 — расширенная генерация
      duration: string;          // "Длительность урока (мин)"
      useWebSearch: string;      // "Использовать поиск в интернете"
      useWebSearchHint: string;  // "ИИ найдёт актуальную информацию в Google"
      filesAttached: string;     // "{count} файлов прикреплено"
      noFilesAttached: string;   // "Файлы не прикреплены"
      filesHint: string;         // "ИИ прочитает их и использует как контекст"
      generatingLong: string;    // "ИИ работает… это может занять 30–60 секунд"
      recommendedMaterials: string; // "Рекомендуемые материалы для подготовки"
      searchQueries: string;     // "Поисковые запросы"
      copied: string;            // "Скопировано!"
      openInGoogle: string;      // "Открыть в Google"
      aiNotes: string;           // "Заметки от ИИ"
      createStages: string;      // "Создать этапы"
      difficultyEasy: string;    // "Лёгкий"
      difficultyMedium: string;  // "Средний"
      difficultyHard: string;    // "Сложный"
      minutesShort: string;      // "мин"
      // Двухэтапный выбор (iter3 промт 5)
      proposePlan: string;       // "Предложить план"
      selectedCount: string;     // "Отмечено: {selected} из {total}"
      totalSelected: string;     // "Общая длительность выбранных: {min} мин"
      lessonDuration: string;    // "Длительность урока: {min} мин — будет пересчитано"
      overallDifficulty: string; // "Общий уровень сложности урока"
      copyQuery: string;         // "Скопировать"
      // iter4 промт 8 — авто-создание без выбора
      creating: string;          // "Этапы создаются..."
      createAll: string;         // "Создать этапы"
    };
    // УЧ.11 Part 2 — speech bubble above the floating AI button
    fab: {
      welcome: string[]; // 2 phrases, one picked at random on first landing after login
      idle: string[];    // 5 phrases, cycled at random every 15s on other pages
      quickQuestions: string[]; // shown as chips inside the empty floating chat window
      closeLabel: string;
    };
  };
  grades: {
    title: string;              // "Мои оценки"
    avgScoreLabel: string;      // "Средний балл"
    completedLabel: string;     // "Выполнено работ"
    bestSubjectLabel: string;   // "Лучший предмет"
    noSubjectYet: string;       // "—" fallback when no graded work at all
    allSubjects: string;        // "Все предметы"
    allTypes: string;           // "Все типы"
    allPeriods: string;         // "Все сроки"
    // Задача "Оценки" — сегментированный переключатель Все/За задания/За урок
    // (стиль tabToday/tabWeek), отдельно от гранулярного typeFilter выше.
    filterAll: string;          // "Все"
    filterAssignment: string;   // "За задания"
    filterLesson: string;       // "За урок"
    filterStage: string;        // "Работа на уроке" — оценки за этапы урока
    periodWeek: string;         // "Эта неделя"
    periodMonth: string;        // "Этот месяц"
    periodSemester: string;     // "Этот семестр"
    sortNewest: string;         // "По дате (новые)"
    sortOldest: string;         // "По дате (старые)"
    sortGradeDesc: string;      // "По оценке (высокие)"
    sortGradeAsc: string;       // "По оценке (низкие)"
    sortSubject: string;        // "По предмету"
    tableSubject: string;       // "Предмет"
    tableAssignment: string;    // "Задание"
    tableType: string;          // "Тип"
    tableDate: string;          // "Дата сдачи"
    tableGrade: string;         // "Оценка"
    tableStatus: string;        // "Статус"
    statusDone: string;         // "Выполнено"
    emptyTitle: string;         // "Пока нет оценок"
    emptySubtitle: string;      // "Продолжай учиться, и здесь появятся твои первые оценки!"
    emptyFiltered: string;      // "По этому фильтру пока нет оценённых работ"
    distributionTitle: string;  // "Распределение оценок"
    totalWorksLabel: string;    // "Всего работ"
    gradeTierExcellent: string; // "Отлично (5)"
    gradeTierGood: string;      // "Хорошо (4)"
    gradeTierSatisfactory: string; // "Удовл. (3)"
    gradeTierPoor: string;      // "Плохо (2)"
    gradeTierVeryPoor: string;  // "Очень плохо (1)"
    avgBySubjectTitle: string;  // "Средний балл по предметам"
    dynamicsTitle: string;      // "Динамика последних оценок"
    detailModal: {
      dateLabel: string;        // "Дата"
      subjectLabel: string;     // "Предмет"
      gradeLabel: string;       // "Оценка"
      // Задача "Оценки" — детали сдачи (текст/код/файл/результат теста).
      typeLabel: string;        // "Тип"
      typeAssignment: string;   // "За задание"
      typeLesson: string;       // "За урок"
      studentLabel: string;     // "Ученик" — только в модалке учителя
      submissionLabel: string;  // "Сдача"
      noSubmission: string;     // "Нет сданной работы"
      testResultLabel: string;  // "Результат"
      fileLabel: string;        // "Файл"
      openFileBtn: string;      // "Открыть файл"
      externalLinkLabel: string; // "Ссылка"
      noExternalLink: string;   // "Ссылка не указана"
      loadingLabel: string;     // "Загрузка…"
      commentLabel: string;     // "Комментарий учителя"
      noComment: string;        // "Учитель пока не оставил комментарий"
      closeBtn: string;         // "Закрыть"
    };
  };
  chat: {
    title: string;              // "Сообщения"
    composerPlaceholder: string; // "Напишите сообщение..."
    send: string;                // "Отправить"
    today: string;                // "Сегодня"
    yesterday: string;            // "Вчера"
    noThreadsTitle: string;       // "У вас пока нет сообщений"
    noThreadsStudent: string;     // пояснение для ученика
    noThreadsTeacher: string;     // пояснение для учителя
    noThreadsParent: string;      // пояснение для родителя
    noThreadSelected: string;     // "Выберите чат слева"
    participantsLabel: string;    // "Участники"
    backToList: string;           // aria-label кнопки "назад" на мобильном
    sendError: string;            // тост при ошибке отправки
    noMessagesInThread: string;   // "Нет сообщений" — открытый тред, 0 сообщений
    // Промт 7.2: секции личных чатов ученик↔учитель.
    sectionGroupChat: string;     // "Групповой чат" — секция у ученика
    sectionTeachers: string;      // "Учителя" — секция личных чатов у ученика
    sectionGroupChats: string;    // "Групповые чаты" — секция у учителя
    sectionDirectChats: string;   // "Личные чаты" — секция у учителя (сгруппировано по классу)
    emojiPicker: string;          // title/aria-label кнопки-смайлика у поля ввода
  };
  // ─── Родительское мобильное приложение v2 (редизайн, Заход 1) ────────────
  // Словарь макета «SNR EduOS v2 Light.dc.html» (I18N_SRC, строка 3464),
  // перенесён ДОСЛОВНО: 225 ключей, секции = префикс ключа макета до точки
  // (common.back → parentApp.common.back). Ключи со звёздочкой макета
  // («вычитать носителю») перенесены как обычные — их список см. в комментарии
  // рядом с секцией в ru.ts. Старая секция parentMobile (прежнее приложение)
  // не трогается и живёт параллельно до завершения редизайна.
  parentApp: {
    subjectDetailScreen: {
      title: string;
      gradeCount: string;
      noGrades: string;
      topics: string;
      lastComment: string;
      lastWork: string;
      noSubjectTitle: string;
      noSubjectText: string;
      toSubjects: string;
      notFoundTitle: string;
      notFoundText: string;
      footnote: string;
    };
    dayStatusScreen: {
      title: string;
      statLessons: string;
      statAttended: string;
      statMissed: string;
      attPresent: string;
      attExcused: string;
      attUnexcused: string;
      attNotMarked: string;
      gradesToday: string;
      homeworkAssigned: string;
      dayOffTitle: string;
      dayOffText: string;
      footnote: string;
    };
    reviewsScreen: {
      title: string;
      hint: string;
      emptyTitle: string;
      emptyText: string;
      noSubject: string;
      noTeacher: string;
    };
    subjectsScreen: {
      title: string;
      hint: string;
      emptyTitle: string;
      emptyText: string;
      noTeacher: string;
      openTeacher: string;
    };
    common: {
      back: string;
      viewAll: string;
      noChildTitle: string;
      noChildText: string;
      more: string;
      done: string;
      cancel: string;
      cancelAction: string;
      save: string;
      apply: string;
      reset: string;
      notFound: string;
      loading: string;
      showAll: string;
      close: string;
      continue: string;
      next: string;
      send: string;
      download: string;
      open: string;
      clear: string;
      gotIt: string;
      // Долги, проход 1: общая кнопка "повторить" в error-карточках
      // real-данных (посещаемость/расписание/задания) — один ключ на всех.
      retry: string;
      // 16.08.2026 — страховка экрана: если раздел упал при отрисовке,
      // показываем карточку вместо белого листа (ScreenErrorBoundary).
      screenErrorTitle: string;
      screenErrorBody: string;
    };
    search: {
      recent: string;
      popular: string;
    };
    nav: {
      home: string;
      grades: string;
      payments: string;
      messages: string;
      profile: string;
    };
    /** Заглушка «Скоро» на ещё не подключённых экранах (веб-родитель). */
    stub: {
      title: string;
      subtitle: string;
    };
    /** QR-гейт /parent на широких экранах (веб-родитель — узкая мобильная
     *  вёрстка, десктоп/планшет получает QR вместо интерфейса). */
    qrGate: {
      title: string;
      subtitle: string;
    };
    scr: {
      dayStatus: string;
      homeworks: string;
      homework: string;
      attendance: string;
      schedule: string;
      skills: string;
      notifications: string;
      services: string;
      announcements: string;
      adminNews: string;
      support: string;
      bills: string;
      payMethod: string;
      payHistory: string;
      receipts: string;
      childWallet: string;
      payMethods: string;
      topup: string;
      childProfile: string;
      parentData: string;
      documents: string;
      notifSettings: string;
      langSec: string;
      allSubjects: string;
      teacherReviews: string;
      topics: string;
      teacherProfile: string;
      walletOps: string;
      testReview: string;
      work: string;
      application: string;
      about: string;
      whatsnew: string;
      search: string;
      chPass: string;
      tests: string;
      library: string;
      teachers: string;
      assistant: string;
      sessions: string;
    };
    more: {
      studySection: string;
      testsCount: string;
      testsScore: string;
      testsGrade: string;
      testsNotGraded: string;
      testsEmptyTitle: string;
      testsEmptyText: string;
      libraryCount: string;
      libraryFav: string;
      libraryNoFile: string;
      libraryEmptyTitle: string;
      libraryEmptyText: string;
      teachersCount: string;
      teachersEmptyTitle: string;
      teachersEmptyText: string;
      teacherSubject: string;
      teacherClasses: string;
      teacherLessons: string;
      teacherReviewsTitle: string;
      teacherNoReviews: string;
      teacherNotFound: string;
      newsCount: string;
      newsPinned: string;
      newsAuthorFallback: string;
      newsEmptyTitle: string;
      newsEmptyText: string;
      sessionsSubtitle: string;
      sessionsCount: string;
      sessionsCurrent: string;
      sessionsEntered: string;
      sessionsActivity: string;
      sessionsUnknownDevice: string;
      sessionsEmptyTitle: string;
      sessionsEmptyText: string;
      sessionsNote: string;
    };
    home: {
      quickActions: string;
      nextLesson: string;
      pay: string;
      hwShort: string;
      atSchoolSince: string;
      lessons: string;
      attended: string;
      hw: string;
      wallet: string;
      viewProgress: string;
      msgTeacher: string;
      today: string;
      todaySection: string;
      // Долги, проход 1 — карточка «Следующий урок» на реальных данных
      // (Заход 2, шаг 4): состояния загрузки/ошибки/пусто + шаблон кабинета.
      nextLessonError: string;      // «Ошибка загрузки»
      nextLessonRetryHint: string;  // «Нажмите, чтобы повторить»
      nextLessonEmpty: string;      // «Нет предстоящих уроков»
      roomLabel: string;            // «Каб. {room}»
      // Веб-родитель, экран «Главная» (реальные данные) — приветствие
      // (шаблон с {name}), мок-текст ассистента, мок-плейсхолдер значения
      // для карточек «К оплате»/«Питание» (данные пока не подключены).
      greetingTitle: string;  // «Доброе утро, {name}!»
      // 28.08.2026 — БЕЗ ПАДЕЖА. Было «Вот что происходит у {name} сегодня»:
      // имя настоящего ребёнка подставлялось именительным, и родитель читал
      // «у Шерзод сегодня». Склонять на лету нельзя (имена бывают латиницей,
      // узбекскими, несклоняемыми), поэтому падеж убран из самой фразы.
      greetingSub: string;    // «Вот что происходит сегодня · {name}»
      /**
       * Приветствие БЕЗ ИМЕНИ — для настоящего входа.
       *
       * ФИО в боевой школе записано узбекским порядком заглавными:
       * «BOQIJONOV SARDOR AZAMAT O'G'LI». Первое слово — фамилия, и
       * приветствие читалось «Доброе утро, BOQIJONOV!». Разделить имя и
       * фамилию из одной строки нельзя: порядок не гарантирован ни
       * школой, ни базой. По решению заказчика имя из приветствия убрано
       * — до тех пор, пока у школы не появятся отдельные колонки.
       *
       * Витрина продолжает здороваться по имени: там имя выдуманное и
       * заведомо в правильном поле.
       */
      greetingTitlePlain: string;
      greetingSubPlain: string;
      assistantText: string;
      noDataYet: string;
    };
    grades: {
      average: string;
      subjects: string;
      tabGrades: string;
      tabSkills: string;
      tabDyn: string;
      topic: string;
      break: string;
      room: string;
      class: string;
      presence: string;
      absence: string;
      teacherComment: string;
      dynAvg: string;
      lastReviews: string;
      // Заход 2, шаг 6 — реальные оценки вкладки «Успехи»→«Оценки».
      loadError: string;          // «Не удалось загрузить оценки»
      empty: string;              // «Оценок пока нет»
      noReviews: string;          // «Отзывов учителей пока нет»
      gradeChipExcellent: string; // «Отлично!» — средний балл ≥4.5
      gradeChipGood: string;      // «Хорошо!» — средний балл ≥3.5
      gradeChipNeedsWork: string; // «Есть куда расти» — средний балл <3.5
      strengths: string;
      growthAreas: string;
      attendanceRatio: string;     // «присутствий {ratio}»
    };
    /** Веб-родитель, экран «Успехи» — статичный мок-текст под карточкой
     *  «Средний балл» и вкладками «Навыки»/«Динамика» (те же вкладки в
     *  мобилке остаются фикстурой — сюда просто перенесены их подписи). */
    progressWeb: {
      weekProgressLabel: string; // «Прогресс за неделю»
      weekProgressNote: string;
      dynamicsNote: string;
      assistantGradesNote: string;
      assistantSkillsNote: string;
    };
    skills: {
      profile: string;
      progress: string;
      practice: string;
      // Редизайн радара «Профиль навыков» (П10 «Успехи»→«Навыки»): 6 коротких
      // подписей вершин радара (в паре с числом самой вершины на экране,
      // напр. «Самост. 64%» / «Mustaq. 64%»). Все 6 — через i18n (не смесь
      // RU-литерала с переводом), длина каждой формы подобрана так, чтобы
      // «имя + число%» помещалось в тот же бюджет символов, что уже проверен
      // на #16 (SkillsScreen.tsx, «Самост. 4.5» = 11 символов).
      axisLogic: string;         // «Логика»
      axisCommunication: string; // «Комм.»
      axisDiscipline: string;    // «Дисц.»
      axisCreativity: string;    // «Креатив»
      axisIndependence: string;  // «Самост.»
      axisTeamwork: string;      // «Команда»
    };
    /**
     * ПОДПИСИ ВИТРИНЫ — шести экранов учёбы, собранных по макету.
     *
     * Отдельной секцией, потому что это подписи ровно тех блоков, которых у
     * настоящего родителя нет: они появляются только в показе. Держать их
     * вперемешку с подписями настоящих экранов значило бы каждый раз гадать,
     * кому какая принадлежит.
     *
     * САМО СОДЕРЖИМОЕ (названия тем, тексты отзывов, реплики помощника) сюда
     * НЕ попадает — оно живёт рядом с заготовками, в
     * apps/mobile-parent/src/data/i18n.ts. Здесь только рамка.
     */
    showcase: {
      // Экран 6 «Статус дня»
      atSchoolNow: string;      // «{name} в школе»
      arrivedAt: string;        // «Пришл{suf} в {time} · {entry}»
      mainEntrance: string;
      lessonsOf: string;        // «{done}/{total} уроков»
      lessonRunning: string;    // «{n}-й урок идёт сейчас, впереди ещё {ahead}»
      nowRunning: string;
      presentCap: string;
      excusedCap: string;
      unexcusedCap: string;
      mealsMenu: string;        // «Меню: {menu}»
      mealsBalance: string;     // «Баланс питания: {sum}»
      // Экран «Все предметы»
      subjectsCount: string;    // «{n} предметов»
      avgGrade: string;         // «Средний балл {avg}»
      // Экран 11 «Детали предмета»
      currentPerformanceCap: string;
      teacherCap: string;
      lastWorkCap: string;
      upcomingTestCap: string;
      teacherCommentCap: string;
      assistantRecommendations: string;
      // Экран «Отзывы учителей»
      groupToday: string;
      groupThisWeek: string;
      groupEarlier: string;
      reply: string;
      // Экран 16 «Навыки»
      overallIndexCap: string;
      // Экран «Освоение тем»
      topicsInPlan: string;         // «{n} тем в учебном плане»
      topicsMastered: string;       // «{n} освоено на 70% и выше»
      topicsNeedAttention: string;  // «{n} тем требуют внимания — они помечены в списке»
      needsAttention: string;
      allChip: string;
      // Экран 26 «Объявления» — два чипа фильтра, которых нет у настоящего
      // экрана (у того свой набор: срочные / события / учёба).
      filterImportant: string;
      filterInfo: string;
      importantBadge: string;    // чип «Важно» на карточке
      filesAttached: string;     // «{n} файлов прикреплено»
      // Экран 27 «От администрации»
      commentsCount: string;      // «{n} комментариев»
      eventDate: string;
      eventTime: string;
      eventPlace: string;
      backToMessages: string;
      // Профиль учителя
      writeMessage: string;
      callSchool: string;
      aboutInfo: string;
      experience: string;
      education: string;
      onlineNow: string;
      teacherRole: string;        // «Учитель · {subject}»
      scheduleWithChild: string;
      lessonMeta: string;         // «{room} · {minutes} минут»
      lastReviewsAbout: string;
      allReviews: string;
      reviewTitle: string;        // «Оценка работы · {name}»
      // Дневник, тесты, библиотека
      gradesReceivedCap: string;
      weekAvgCap: string;
      homeworkDoneCap: string;
      testsPassedCap: string;
      avgScoreCap: string;
      filterPassed: string;
      filterUpcoming: string;
      recentlyOpenedCap: string;
      allMaterialsCap: string;
      libraryNote: string;
      // Активные сессии
      otherDevicesCap: string;
      noOtherSessions: string;
      endAllSessions: string;
      sessionsWarning: string;
      // О приложении
      aboutVersion: string;
      aboutBuildDate: string;
      aboutDeveloper: string;
      aboutPlatform: string;
      aboutSchoolCap: string;
      termsLink: string;
      privacyLink: string;
      licensesLink: string;
      writeSupportLink: string;
      rateAppLink: string;
      shareAppLink: string;
      // Экраны действий
      workDescCap: string;
      gradeCap: string;
      downloadWork: string;
      appStatusCap: string;
      appDataCap: string;
      schoolCommentCap: string;
      attachedDocsCap: string;
      withdrawApp: string;
      periodCap: string;
      reasonCap: string;
      commentCap: string;
      searchRecentCap: string;
      searchPopularCap: string;
      thisVersionCap: string;
      prevVersionsCap: string;
      lastUpdatedLabel: string;
      // Оплаты
      cardSystem: string;
      cardType: string;
      cardBank: string;
      cardStatus: string;
      cardLastPaymentsCap: string;
      deleteCard: string;
      cardNumberCap: string;
      cardExpiryCap: string;
      cardCvvCap: string;
      cardHolderCap: string;
      makeMainCard: string;
      addCard: string;
      /** Замена «успокаивающей» подписи макета про передачу данных банку. */
      cardPreviewNote: string;
      formPreviewNote: string;
    };
    pay: {
      autopay: string;
      on: string;
      off: string;
      payNow: string;
      downloadReceipt: string;
      balance: string;
      topupBtn: string;
      all: string;
      refunds: string;
      total: string;
      sum: string;
      chooseMethod: string;
      mainCard: string;
      otherCards: string;
      otherMethods: string;
      lastOps: string;
      // Заход 4: экран П17 «Оплаты» — дополнительные подписи макета.
      balanceTotalCap: string;    // «ОБЩИЙ БАЛАНС»
      balanceDueCap: string;      // «К ОПЛАТЕ»
      balanceOverpaidCap: string; // «ПЕРЕПЛАТА»
      balanceAvailable: string;   // «Доступно для расходов»
      dueNow: string;             // «К оплате сейчас»
      billsChip: string;          // «{n} счёта»
      billDueBy: string;          // «до {date}»
      payAllBtn: string;          // «Оплатить всё — {sum}»
      billsReceipts: string;      // «Счета и чеки»
      // Тоже без падежа, и по той же причине; плейсхолдер переименован из
      // {gen} в {name}, чтобы имя подставляли именительным осознанно.
      walletTitle: string;        // «Кошелёк · {name}»
      walletTitleGeneric: string; // «Кошелёк ребёнка» — когда имени ещё нет
      walletSub: string;          // «На питание и покупки в школе»
      // Заход 6: доп. ключи для ветки «Оплаты» — экраны d17-limits,
      // d17-transfer, d17-addcard, d17-topup, paySheet-успехи, helpSheet.
      addCardTitle: string;       // «Добавить карту»
      cardNumber: string;         // «Номер карты»
      cardExpiry: string;         // «Срок действия»
      cardCvv: string;            // «CVV»
      cardHolder: string;         // «Имя держателя»
      topupInputPlaceholder: string;  // «0» (плейсхолдер суммы)
      topupChooseAmount: string;      // «Сумма пополнения»
      howItWorks: string;             // «Как работают оплаты» (заголовок helpSheet)
      successBillTitle: string;       // paySheet.kind==='bill' → «Платёж проведён»
      successTopupTitle: string;      // paySheet.kind==='top' → «Баланс пополнен»
      successCardTitle: string;       // paySheet.kind==='card'→ «Карта добавлена»
    };
    /** Веб-родитель, экран «Оплаты» — мок, не подключён к БД. Пара новых
     *  строк, которых не хватало среди уже существующих pay.* ключей:
     *  общее название первого счёта-заглушки и generic-заголовок карточки
     *  кошелька (без склонения имени ребёнка — на вебе нет genitive-хелпера
     *  мобилки, first_name_gen). */
    /**
     * ВЕБ-РАЗДЕЛ ОПЛАТ У НАСТОЯЩЕГО РОДИТЕЛЯ. Заход 2 по оплатам, 30.08.2026.
     *
     * Отдельная секция, а не `pay`: там подписи ВИТРИНЫ, дословно снятые с
     * макета, и трогать их нельзя — демо-гость видит их до пикселя. Здесь —
     * подписи экрана, который витрины не показывает вовсе. Тот же приём, что
     * у настоящей переписки со школой (msg.supportReal*).
     *
     * ИМЯ СЕКЦИИ УЖЕ, ЧЕМ ЕЁ СОДЕРЖИМОЕ. С захода 5 эти же подписи берёт
     * настоящая вкладка оплат в МОБИЛЬНОМ: строки те же, и два словаря об
     * одном экране разошлись бы. Переименовать секцию значит тронуть веб —
     * это стоит сделать заходом, которому веб править разрешено.
     */
    paymentsWeb: {
      tuition: string;              // «Обучение» — заголовок 1-го счёта-заглушки
      /** Склонения «счёт»: в русском 1 счёт / 2 счёта / 5 счетов. У настоящего
       *  родителя счёт РОВНО ОДИН, и «1 счёта» из витрины было бы ошибкой. */
      dueOne: string;
      dueFew: string;
      dueMany: string;
      payBtn: string;               // «Оплатить — {sum}»
      invoiceUnpaid: string;        // чип статуса открытого счёта
      noInvoicesTitle: string;
      noInvoicesText: string;
      loadFailedTitle: string;
      loadFailedText: string;
      /** Шторка «онлайн-оплата не подключена». Кассы нет, но раздел работает. */
      sheetTitle: string;
      sheetText: string;
      sheetInvoiceCap: string;
      sheetHowCap: string;
      sheetPhone: string;
      sheetAddress: string;
      /** Запасной текст, если у школы не заполнены ни телефон, ни адрес. */
      sheetNoContacts: string;
      sheetOk: string;
      sheetCall: string;
      // ── Заход 3: экраны «Счета» и «История оплат» ──
      /** Заголовок экрана счетов у настоящего родителя. У витрины он
       *  «Счета и чеки»: чеки выдаёт платёжная система, которой нет, и
       *  вкладка с ними у настоящего убрана целиком — пустая обещала бы,
       *  что там что-то появится. */
      invoicesTitle: string;
      invoicesOpenCap: string;
      invoicesPaidCap: string;
      invoicesCanceledCap: string;
      invoicePaid: string;
      invoiceCanceled: string;
      invoicePaidOn: string;          // «Оплачен 5 сентября 2026»
      /** Админ школы может изменить сумму счёта руками — тогда у счёта
       *  amount_source = admin_adjusted и обычно есть причина. Родитель
       *  обязан видеть, что сумма не та, которую посчитала система. */
      invoiceAdjusted: string;
      invoiceAdjustedNoReason: string;
      historyTopup: string;
      historyCharge: string;
      historyAdjust: string;
      historyRefund: string;
      historyEmptyTitle: string;
      historyEmptyText: string;
      historyToppedCap: string;
      historyChargedCap: string;
      historyRefundsCap: string;
    };
    msg: {
      announcementsSub: string;  // подпись раздела на вкладке «Сообщения»
      adminNewsSub: string;
      online: string;
      typeMessage: string;
      teachers: string;
      servicesChip: string;
      announcements: string;
      avgReply: string;
      supportName: string;
      // Настоящая переписка родителя со школой (миграция 234).
      supportRealTitle: string;
      supportRealSub: string;
      supportStartTitle: string;
      supportStartText: string;
      supportNoAdminTitle: string;
      supportNoAdminText: string;
      supportSendFailed: string;
      supportSendBtn: string;
      supportRoleAdmin: string;
      // Заход 4: экран d24 «Сообщения» — табы и подписи «сторис».
      tabAll: string;
      tabChats: string;
      tabAnn: string;
      tabSvc: string;
      storyImportant: string;
      storyCurator: string;
      storyMath: string;
      storyEng: string;
      storyAdmin: string;
      // Заход 7: меню прикреплений в шторке чата (#25).
      attachPhoto: string;   // «Фото»
      attachFile: string;    // «Файл»
    };
    prof: {
      children: string;
      settings: string;
      logout: string;
      appVersion: string;
      biometric: string;
      biometricSub: string;
      sessionsSub: string;
      deleteAcc: string;
      terms: string;
      privacy: string;
      licenses: string;
      writeSupport: string;
      rateApp: string;
      shareApp: string;
      myKids: string;
      switchChild: string;        // «Сменить ребёнка ›» (ChildSwitcherCard compact)
      // Личные данные родителя (d30), табы профиля ребёнка (d29) и
      // подтверждения выхода/удаления. Приехали из кода 28.08.2026.
      sectionAdditional: string;
      sectionContact: string;
      fullNameRow: string;
      gender: string;
      maritalStatus: string;
      city: string;
      postalCode: string;
      workplace: string;
      jobTitle: string;
      workPhone: string;
      backupPhone: string;
      tabData: string;
      tabAchievements: string;
      logoutTitle: string;
      logoutBody: string;
      deleteAccTitle: string;
      deleteAccBody: string;
      generalInfo: string;
      schoolContacts: string;
      additional: string;
      // Подписи строк профиля ребёнка (d29). До 28.08.2026 лежали в вёрстке
      // экрана по-русски; переехали сюда вместе с починкой самого экрана.
      birthDate: string;          // «Дата рождения»
      age: string;                // «Возраст»
      school: string;             // «Школа»
      classRow: string;           // «Класс»
      curator: string;            // «Классный руководитель»
      fileNo: string;             // «Номер личного дела»
      studentId: string;          // «ID ученика» — подпись под именем в hero
      personalInfo: string;
      address: string;
      // Заход 4: экран «Профиль-хаб» — подписи меню и версии.
      parentRole: string;         // «Родитель»
      parentDataOnlySchool: string;
      // Профиль ребёнка на настоящих полях (миграция 232).
      genderMale: string;
      genderFemale: string;
      studentPhone: string;
      allergies: string;
      medicalNotes: string;
      phoneRow: string;
      emailRow: string;
      docsSub: string;            // «Свидетельства, справки, ID»
      notifSetSub: string;        // «Оценки, задания, оплаты»
      payMethodsSub: string;      // «Карты и платёжные системы»
      langSecSub: string;         // «Язык, пароль, биометрия»
      helpTitle: string;          // «Помощь и поддержка»
      helpSub: string;            // «Чат с поддержкой школы»
      aboutSub: string;           // «SNR EduOS для родителей»
      exit: string;               // «Выйти»
      versionLabel: string;       // «SNR EduOS · версия {v}»
    };
    about: {
      info: string;
      school: string;
      /* Заход 5: экран «О приложении» стал настоящим — всё ниже реальное. */
      appName: string;      // «SNR EduOS для родителей»
      version: string;      // «Версия приложения»
      channel: string;      // «Канал обновлений»
      runtime: string;      // «Среда Expo»
      updated: string;      // «Обновление загружено»
      schoolToday: string;  // «Учебный день школы»
      childrenCount: string; // «Детей привязано»
      parent: string;       // «Родитель»
      phone: string;        // «Телефон»
      storeNote: string;    // почему версия обновляется «по воздуху»
      unknown: string;      // «неизвестно»
    };
    set: {
      security: string;
      privacySec: string;
      appearance: string;
      light: string;
      dark: string;
      system: string;
      lightSub: string;
      darkSub: string;
      systemSub: string;
      appLanguage: string;
      langSysDefault: string;
      langUz: string;
      langEn: string;
      // Заход 7: #34 «Язык и безопасность» — доп. ключи.
      langRu: string;     // «Русский» / «Rus tili» / «Russian»
      chPass: string;     // «Изменить пароль»
      sessions: string;   // «Активные сессии»
    };
    /** Заход 7: #32 «Настройки уведомлений». Каждый пункт = переключатель
     *  с заголовком + подпись (subtitle). Опоздания в SNR EduOS НЕТ (см. attend.*),
     *  подпись notif.attSub ссылается только на присутствие/пропуски. */
    notif: {
      master: string;      masterSub: string;
      grades: string;      gradesSub: string;
      hw: string;          hwSub: string;
      sched: string;       schedSub: string;
      att: string;         attSub: string;
      ann: string;         annSub: string;
      events: string;      eventsSub: string;
      pay: string;         paySub: string;
      msg: string;         msgSub: string;
      promo: string;       promoSub: string;
      allowTitle: string;
      allowSub: string;
      sectionCap: string;
      // Настоящее хранилище настроек (миграция 236).
      saveFailed: string;
      saveFailedSub: string;
      loadFailed: string;
      onlyFourNote: string;
    };
    wn: {
      thisVersion: string;
      prevVersions: string;
    };
    svc: {
      diary: string;
      tests: string;
      library: string;
      portfolio: string;
      applications: string;
      medcard: string;
      transport: string;
      meals: string;
      study: string;
      finance: string;
      other: string;
      promoTitle: string;
      promoSub: string;
      promoCta: string;
    };
    auth: {
      heroTitle: string;
      heroSub: string;
      // Онбординг-слайды 2 и 3 (свайп) — продолжают тему heroTitle/heroSub:
      // 2 — успеваемость/задания, 3 — связь со школой/оплаты/уведомления.
      heroTitle2: string;
      heroSub2: string;
      heroTitle3: string;
      heroSub3: string;
      start: string;
      learnMore: string;
      welcome: string;
      signInSub: string;
      phone: string;
      smsCode: string;
      resend: string;
      chooseChild: string;
      demo: string;
      tagline: string;
      needHelp: string;
      moreTitle: string;
      moreIntro: string;
      helpTitle: string;
      helpSub: string;
      demoSub: string;
      demoCtaTitle: string;
      demoCtaSub: string;
      smsTitle: string;
      smsSubPrefix: string;
      smsResendCountdown: string;
      smsResend: string;
      smsSecurity: string;
      // Заход 1 (реальный вход по 3 тестовым номерам) — ошибки на экранах
      // телефона/кода; существовавших раньше просто не было, т.к. фикстурный
      // вход никогда не мог провалиться.
      phoneNotFound: string;
      /** Вход по телефону с настоящим кодом: причины отказа. */
      phoneInvalid: string;
      phoneTooSoon: string;
      phoneNoAccount: string;
      networkError: string;
      configError: string;
      codeWrong: string;
      codeExpired: string;
      codeTooMany: string;
      codeFromSchool: string;
      // Ввод кода: остаток попыток и состояния проверки
      codeAttemptsLeft: string;
      codeLastAttempt: string;
      codeChecking: string;
      codeAccepted: string;
      sendingCode: string;   // затянувшаяся отправка кода — подпись в кнопке
      wrongCode: string;
    /** Z.2.8 — настоящий код: срок жизни и защита от частых запросов. */
    codeTooSoon: string;
    resendCode: string;
      loginFailed: string;
      /** 11.08.2026 — SMS не ушла: провайдер отверг отправку. Код при этом
       *  создан и виден администратору, поэтому текст ведёт к нему. */
      codeSendFailed: string;
      a4Sub: string;
      a4SecurityTitle: string;
      a4SecuritySub: string;
      a4School: string;
      continue: string;
      legalPrefix: string;
      legalTerms: string;
      legalAnd: string;
      legalPrivacy: string;
      legalNotReady: string;
      or: string;          // разделитель над кнопками Google/Apple
      withDemo: string;
      demoSigningIn: string;
      demoFailed: string;
      demoHint: string;
      googleDemoSchool: string;
      withGoogle: string;
      withApple: string;
      soonBadge: string;   // «скоро» на неактивной кнопке
      socialSoon: string;  // объяснение по нажатию (Apple — ещё не подключён)
      // Вход через Google: подпись на кнопке во время перехода и отказы
      googleSigningIn: string;
      googleNotLinked: string;
      googleNoAccount: string;
      googleSchoolArchived: string;
      googleFailed: string;
      appleSoon: string;
      googleWebOnly: string;   // мобильное: в Expo Go возврат по схеме не приходит
      phoneHint: string;
      phonePlaceholder: string;
      kidsOne: string;
      kidsMany: string;
      helpPhoneRowTitle: string;
      helpEmailRowTitle: string;
      demoBanner: string;
      featEduTitle: string;
      featEduSub: string;
      featHwTitle: string;
      featHwSub: string;
      featPayTitle: string;
      featPaySub: string;
      featChatTitle: string;
      featChatSub: string;
      helpPhoneValue: string;
      helpEmailValue: string;
      close: string;
    };
    /** Заход 5x (правка 3): one-shot центр-модалка после демо-входа
     *  (заменила жёлтый DemoBannerGlass поверх шапки). */
    demo: {
      title: string;
      body: string;
      cta: string;
    };
    status: {
      paid: string;
      due: string;
      overdue: string;
      refund: string;
      atSchool: string;
      absent: string;
      liveNow: string;
      assigned: string;
      inWork: string;
      submitted: string;
      underReview: string;
      reviewed: string;
      approved: string;
      pending: string;
      rejected: string;
      // Долги, проход 1 — реальный статус сдачи ДЗ (lib/homeworkStatus.ts,
      // 3 состояния; underReview выше уже переиспользуется для «pending_review»).
      notSubmitted: string; // «Не сдано»
      graded: string;       // «Оценено»
    };
    subj: {
      math: string;
      eng: string;
      rus: string;
      prog: string;
      robo: string;
    };
    more2: {
      diaryWeekGrades: string;
      diaryWeekAvg: string;
      diaryWeekHw: string;
      diaryNoGrade: string;
      diaryDayAvg: string;
      diaryPrevWeek: string;
      diaryNextWeek: string;
      diaryEmptyTitle: string;
      diaryEmptyText: string;
      diaryNoLessonsDay: string;
      topicsCount: string;
      topicsMastered: string;
      topicsAttention: string;
      topicsOverall: string;
      topicsAttentionChip: string;
      topicsAllSubjects: string;
      topicsMeta: string;
      topicsEmptyTitle: string;
      topicsEmptyText: string;
      topicsNote: string;
      assistantGenerate: string;
      assistantRegenerate: string;
      assistantWorking: string;
      assistantGeneratedAt: string;
      assistantEmptyTitle: string;
      assistantEmptyText: string;
      assistantError: string;
      assistantNote: string;
      assistantSummaryCap: string;
      assistantItemsCap: string;
      libraryOpen: string;
      libraryOpening: string;
      libraryOpenFailed: string;
    };
    /**
     * Строки семи разделов, доведённых до настоящих данных в мобильном
     * приложении 14.08.2026 (дневник, тесты, библиотека, учителя, объявления,
     * новости администрации, уведомления). Часть из них нужна и вебу — блок
     * общий, чтобы у одной и той же надписи не завелось двух переводов.
     */
    more4: {
      loadFailed: string;
      notifFilterAll: string;
      notifFilterUnread: string;
      notifEmptyTitle: string;
      notifEmptyText: string;
      notifUnreadEmptyTitle: string;
      notifUnreadEmptyText: string;
      testsPassed: string;
      testsAvgGrade: string;
      testsAvgResult: string;
      libraryFilterAll: string;
      libraryFavSection: string;
      libraryAllSection: string;
      libraryNote: string;
      teachersTitle: string;
      teachersPick: string;
      annNotFoundTitle: string;
      annNotFoundText: string;
      annBackToList: string;
      annOnlyAdmin: string;
      diaryWeekEmptyDay: string;
      sortTitle: string;
      sortPctDesc: string;
      sortPctAsc: string;
      sortByTitle: string;
      skillsSourceCap: string;
      attendanceNote: string;
      attendanceNoRecords: string;
    };
    /**
     * Оплаты мобильного приложения. Платёжной подсистемы в проекте нет, и
     * половина этих строк — объяснения, почему кнопка ничего не делает.
     * Держим их в словаре, а не литералами в экранах: экран, который на
     * узбекском говорит по-русски «появится позже», объясняет плохо.
     */
    pay2: {
      demoBanner: string;
      soon: string;
      soonFile: string;
      cardsNote: string;
      addCard: string;
      addCardWhy: string;
      cardValidThru: string;
      methodLinked: string;
      methodNotLinked: string;
      billsDueCap: string;
      billsLaterCap: string;
      billsEmpty: string;
      noDebt: string;
      tuitionInvoice: string;
      balanceTitle: string;
      topUpNotConnected: string;
      invoicesEmptyHint: string;
      receiptsSoon: string;
      walletIsExample: string;
      adjustedByAdmin: string;
      loadFailed: string;
      payAll: string;
      historyCap: string;
      historyTotal: string;
      historyNet: string;
      historyRefunds: string;
      historyEmpty: string;
      receiptsChecks: string;
      receiptsInvoices: string;
      receiptDownload: string;
      receiptPaid: string;
      receiptUnpaid: string;
      topUpAmount: string;
      topUpFrom: string;
      topUpAction: string;
      walletOpsIn: string;
      walletOpsOut: string;
    };
    more3: {
      skillKnowledge: string;
      skillThinking: string;
      skillCommunication: string;
      skillIndependence: string;
      skillIndependenceWhy: string;
      skillDiscipline: string;
      skillKnowledgeWhy: string;
      skillThinkingWhy: string;
      skillCommunicationWhy: string;
      skillDisciplineWhy: string;
      skillOverall: string;
      skillOverallNote: string;   // "Учитываются оценки, посещаемость и сданные работы"
      skillLevelHigh: string;
      skillLevelGood: string;
      skillLevelGrowing: string;
      skillLevelLow: string;
      skillSubjectsCap: string;
      skillSubjectMeta: string;
      skillEmptyTitle: string;
      skillEmptyText: string;
      skillNote: string;
      supportOnline: string;
      supportTicketsCap: string;
      supportNewCap: string;
      supportStatusAnswered: string;
      supportStatusClosed: string;
      supportStatusWaiting: string;
      supportSubject: string;
      supportSubjectPlaceholder: string;
      supportText: string;
      supportTextPlaceholder: string;
      supportSend: string;
      supportDemoNote: string;
      walletBalance: string;
      walletTopUp: string;
      walletOps: string;
      walletRecentCap: string;
      walletSpent: string;
      walletTopped: string;
      walletOpsCount: string;
      walletDemoNote: string;
      walletDemoNoteShort: string;
      opsAllCap: string;
      opsFilterAll: string;
      opsFilterOut: string;
      opsFilterIn: string;
      opsEmptyTitle: string;
      opsEmptyText: string;
    };
    ann: {
      catUrgent: string;
      catEvent: string;
      catAcademic: string;
      catReminder: string;
      catGeneral: string;
      filterAll: string;
      filterUrgent: string;
      filterEvent: string;
      filterAcademic: string;
      emptyTitle: string;
      emptyText: string;
      emptyFilterTitle: string;
      emptyFilterText: string;
      adminChip: string;
      authorSchool: string;
    };
    date: {
      mon: string;
      tue: string;
      wed: string;
      thu: string;
      fri: string;
      sat: string;
      sun: string;
      june: string;
      july: string;
      august: string;
      today: string;
      yesterday: string;
      tomorrow: string;
      earlier: string;
      /** «21 {month}»: в ru — родительный падеж («июля»). */
      monthsGen: string[];
      /** Месяц отдельным словом: «Июль». */
      monthsNom: string[];
      /** Короткая метка: «июл». */
      monthsShort: string[];
      /** Порядок слов языка: ru «{d} {month}», en «{month} {d}». */
      patDayMonth: string;
      patDayMonthYear: string;
      patMonthYear: string;
      /** Месяц в форме для фразы «…чем в {month}»: ru — предложный падеж. */
      monthsIn: string[];
      deltaSame: string;
      deltaUp: string;
      deltaDown: string;
      periodAll: string;
      periodAllPrev: string;
      minAgo: string;
      hAgo: string;
      dAgo: string;
      in15: string;
      // Долги, проход 1 — полные имена дней недели (баннер даты расписания,
      // Заход 2 шаг 4). mon..sun выше — короткие формы «Пн»..«Вс».
      monFull: string;
      tueFull: string;
      wedFull: string;
      thuFull: string;
      friFull: string;
      satFull: string;
      sunFull: string;
    };
    ai: {
      overall: string;
      recs: string;
      weekly: string;
      techBadge: string;
    };
    sched: {
      today: string;
      // Заход 5 — базовые ярлыки расписания (17 экранов учебной ветки).
      // ВАЖНО: «Дневник» ≠ «Расписание» (см. tz — svc.diary отдельно).
      day: string;      // "День" — заголовок дневного столбца
      week: string;     // "Неделя" — переключатель диапазона
      lesson: string;   // "Урок" — метка ячейки урока
      break: string;    // "Перемена" — приглушённая строка между уроками
      room: string;     // "Кабинет" — короткая метка cab. в карточке урока
      // Долги, проход 1 — реальное расписание (Заход 2, шаг 4).
      loadError: string; // «Не удалось загрузить расписание»
      emptyDay: string;  // «Уроков в этот день нет»
    };
    files: {
      attached: string;
    };
    attend: {
      lastDays: string;
      // Заход 5 — три статуса посещаемости в SNR EduOS (опозданий НЕТ):
      // present  = плитка «Посещаемость» (общая метрика посещаемости, % присутствия)
      // absent   = «Отсутствовал» (общее)
      // excused  = «Уважительные» — плитка уважительных пропусков
      // unexcused = «Неуважительные» — плитка неуважительных пропусков
      // Ключ 'late' / 'lateArrival' в системе намеренно отсутствует.
      present: string;
      absent: string;
      excused: string;
      unexcused: string;
      // Легенда календаря (4 маркера). Формы — краткое существительное/прилагательное,
      // отличаются от плиток выше (там метрики), поэтому отдельные ключи.
      legendPresent: string;   // «Присутствие»
      legendExcused: string;   // «Уважительная»
      legendUnexcused: string; // «Неуважительная»
      legendWeekend: string;   // «Выходной»
      // Долги, проход 1 — реальная посещаемость (Заход 2, шаг 3): предложения-
      // статусы «Последних дней» (отличаются от коротких present/excused/
      // unexcused выше — те для плиток-метрик, эти — полные фразы в строке дня)
      // + состояния загрузки.
      dayPresent: string;    // «Присутствовал»
      dayExcused: string;    // «Уважительная причина»
      dayUnexcused: string;  // «Отсутствовал без уважительной причины»
      loadError: string;     // «Не удалось загрузить посещаемость»
      empty: string;         // «Записей о посещаемости пока нет»
      arrivedPrefix: string; // «В школе:» — префикс времени прихода в строке дня
      leftPrefix: string;    // «Уход:» — префикс времени ухода в строке дня
    };
    /** Долги, проход 1 — реальные задания/сдачи (Заход 2, шаг 5). Новый
     *  namespace: в отличие от grades и sched, для содержимого экрана
     *  «Домашние задания»/«Детали задания» отдельных ключей раньше не было
     *  (только заголовки scr.homeworks/scr.homework). */
    hw: {
      loadListError: string;     // «Не удалось загрузить задания»
      loadDetailError: string;   // «Не удалось загрузить задание»
      emptyAll: string;          // «Заданий пока нет»
      emptyFiltered: string;     // «Нет заданий под этот фильтр»
      notFound: string;          // «Задание не найдено»
      noDeadline: string;        // «Без срока»
      dueToday: string;          // «Срок: сегодня, {time}»
      dueTomorrow: string;       // «Срок: завтра, {time}»
      dueOn: string;             // «Срок: {date}»
      subjectFallback: string;      // «Предмет»
      subjectFallbackCaps: string;  // «ПРЕДМЕТ»
      teacherUnassigned: string; // «Преподаватель не назначен»
      instructionLabel: string;  // «ИНСТРУКЦИЯ ОТ УЧИТЕЛЯ»
      attachmentsLabel: string;  // «ПРИКРЕПЛЁННЫЕ МАТЕРИАЛЫ»
      openFile: string;          // «Открыть файл»
      openLink: string;          // «Открыть ссылку»
      openFileError: string;     // «Не удалось открыть файл» (Alert)
      commentLabel: string;      // «КОММЕНТАРИЙ УЧИТЕЛЯ»
      submissionLabel: string;   // «ВАША СДАЧА»
      testResult: string;        // «Результат: {score} из {max}»
      testPendingResult: string; // «Сдано, ожидает результата»
      testNotTaken: string;      // «Тест не пройден»
      codeNotSubmitted: string;  // «Код не отправлен»
      workNotSubmitted: string;  // «Работа не сдана»
      fileFallbackName: string;  // «Файл»
      sentPrefix: string;        // «Работа отправлена · {status}»
      gradedWithScore: string;   // «Оценено · {grade}» — Заход 2, шаг 6
      filterAll: string;         // «Все»
      filterToday: string;       // «Сегодня»
      filterOverdue: string;     // «Просрочено»
      filterDone: string;        // «Выполнено»
      summaryTotal: string;        // «Всего» в нижней строке-сводке
      sizeKb: string;            // «{n} КБ»
      sizeMb: string;            // «{n} МБ»
    };
    /**
     * Заход 5 (заглушки). Раздел, для которого в базе школы нет данных, не
     * должен показывать пустой экран или «Экран в разработке»: он говорит,
     * ЧТО здесь будет, КОГДА появится и ЧТО доступно сейчас. Тексты у каждого
     * раздела свои — общей фразы «появится позже» на все случаи нет.
     */
    soon: {
      badge: string;    // «Появится в будущих обновлениях»
      whatCap: string;  // подпись «ЧТО ЗДЕСЬ БУДЕТ»
      whenCap: string;  // подпись «КОГДА ПОЯВИТСЯ»
      nowCap: string;   // подпись «ЧТО ДОСТУПНО СЕЙЧАС»
      back: string;     // «Вернуться назад»
      /** Ключ = stubKey или имя маршрута; см. SOON_KEY в StubScreen.tsx. */
      items: Record<string, { what: string; when: string; now?: string }>;
      /** Плашка сверху раздела, который целиком собран из примеров. */
      sections: Record<string, string>;
      /** Однострочные объяснения у кнопок, которые ничего не сохраняют. */
      notes: Record<string, string>;
    };
    /**
     * Заход 6 (сессии). Экран «Активные сессии» переехал на настоящие данные —
     * auth.sessions, строка на каждый вход. Здесь всё, чего не было у прежней
     * фикстуры: закрытие чужого входа, честные подписи под цифрами и названия
     * для входов, которые не являются устройством человека (служебный скрипт,
     * сервер школы, само приложение).
     */
    sess: {
      currentCap: string;   // «ЭТО УСТРОЙСТВО»
      othersCap: string;    // «ДРУГИЕ ВХОДЫ»
      othersEmpty: string;  // когда других входов нет
      end: string;          // «Завершить»
      endAll: string;       // «Завершить все другие входы»
      ending: string;       // «Закрываем…»
      endedOne: string;     // подтверждение с честным сроком
      endedNone: string;    // сеанса уже нет
      endCurrent: string;   // текущий не закрываем
      endError: string;     // сеть/отказ
      confirmTitle: string; // заголовок подтверждения
      confirmText: string;  // «{device}»
      deviceApp: string;    // вход из приложения
      deviceScript: string; // служебный вход (скрипт)
      deviceWeb: string;    // вход через сайт школы
      entered: string;      // «Вход: {when}»
      seen: string;         // «Продлён: {when}»
      addr: string;         // «Адрес: {ip}»
      noteSeen: string;     // что значит «продлён»
      noteSingle: string;   // как это связано с правилом одной сессии
      noteData: string;     // чего в данных нет
    };
    /**
     * 16.08.2026. Разделы, которых нет в базе школы, больше не показывают
     * выдуманные данные с плашкой «это пример» — вместо них экран «Скоро»:
     * иконка, название и одна-две строки о том, что здесь будет и при каком
     * условии появится. Текст у каждого раздела свой.
     */
    soon2: {
      badge: string;   // «Появится в будущих обновлениях»
      items: Record<string, { title: string; text: string }>;
      fallback: { title: string; text: string };
    };
  };
}
