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
    tabLibrary: string;       // "Библиотека"
    tabGroupMaterials: string; // "Материалы группы"
    pickerTitle: string;       // "Выбор файла"
    searchPlaceholder: string; // "Поиск по названию"
    select: string;            // "Выбрать"
    selectCount: string;       // "Выбрать ({n})"
    cancel: string;
    noResults: string;
    browse: string;            // "Выбрать из базы знаний" — button that opens the picker
  };
  // Промт 4 — учебные планы (curriculum_plans, migration 116).
  curriculum: {
    title: string;              // "Учебные планы"
    uploadPlan: string;         // "Загрузить учебный план"
    parseWithAi: string;        // "Распарсить AI"
    topicFromPlan: string;      // "Тема из плана"
    enterCustomTopic: string;   // "Ввести свою тему"
    planExistsWarning: string;  // "План уже существует. Заменить?"
    errorPdfDocxOnly: string;   // "Разрешены только PDF и DOCX файлы"
    errorFileTooLarge: string;  // "Файл больше 20 МБ"
    errorParseFailed: string;   // "Не удалось распарсить план"
  };
  auth: {
    title: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    rememberMe: string;
    submit: string;
    forgot: string;
    invalid: string;
    sessionReplaced: string; // single-session: «Вход выполнен с другого устройства»
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
    qaFiles: string;           // "Мои файлы"
    qaTeacher: string;         // "Связь с учителем" (stub)
    qaAI: string;              // "Спросить AI"
    myProgress: string;        // "Мой прогресс"
    progressWeekly: string;    // "Всего за неделю"
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
    streakDays: string;        // "{n} дней подряд!"
    qaNewLesson: string;       // "Новый урок" (5th quick action)
    goalsTitle: string;        // "Ты на пути к новым вершинам!"
    goalsSubtitle: string;     // "Ещё немного, и ты получишь новую награду 🏆"
    viewGoals: string;         // "Смотреть цели" (stub)
    // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 2.4 — full per-class subject catalog section
    classSubjectsTitle: string; // "Предметы класса"
    subjectComingSoon: string;  // "Скоро появится" (toast on stub subject click)
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
    title: string;
    navDashboard: string;
    navStudents: string;
    navTeachers: string;
    navGroups: string;
    navSubjects: string;
    navAnnouncements: string;
    navParents: string;
    navProfile: string;
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
    role: string;
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
    // groups
    groupsTitle: string;
    addGroupTitle: string;
    editGroupTitle: string;
    deleteGroupTitle: string;
    deleteGroupConfirm: string;
    fieldGroupName: string;
    fieldSubject: string;
    fieldTeacher: string;
    fieldDescription: string;
    tableStudentCount: string;
    tableTeacher: string;
    loading: string;
  };
  superadmin: {
    title: string;
    role: string;
    navDashboard: string;
    navSchools: string;
    navAdmins: string;
    navSettings: string;
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
    createdMsg: string;
    tableFullName: string;
    tableUsername: string;
    tableSchool: string;
    tableCreated: string;
    settingsTitle: string;
    changePassword: string;
    fieldNewPassword: string;
    saveBtn: string;
    passwordChangedMsg: string;
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
    curatorLabel: string;
    curatorPhoneLabel: string;
    contactCurator: string;
    curatorComingSoon: string;
    noCurator: string;
    classesLabel: string;

    messagesStubTitle: string;
    messagesStubDescription: string;

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
    childProfWriteCuratorBtn: string;
    childProfSubjectsTitle: string;
    childProfSubjectsEmpty: string;
    childProfStatusTitle: string;
    childProfStatusActive: string;
    childProfStatusInactive: string;
    childProfEnrolledLabel: string;
    childProfNoThreadNotice: string;

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
    noTasks: string;
    // новые ключи #19
    eyebrow: string;
    detailDeadline: string;
    detailAttachments: string;
    detailDownload: string;
    detailYourSubmission: string;
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
    hintPanelTitle: string;     // "Подсказка" — БОЛЬШОЕ ОБНОВЛЕНИЕ §8.2 side panel
    hintPanelCollapse: string;
    hintPanelOpen: string;
    submittedFileLbl: string;
    uploadingFile: string;
    resubmitBtn: string;
    // Homework types (migration 31)
    typeProgramming: string;
    typeBundle: string;
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
      h5p: { name: string; description: string };
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
    modalTitle: string;    // "Демо-режим"
    modalSubtitle: string; // "Выберите роль чтобы попробовать платформу"
    loginBtn: string;      // "Войти"
    loginProgress: string; // "Вход..."
    bannerText: string;    // "Вы в демо-режиме. Все данные тестовые."
    bannerLogout: string;  // "Выйти"
    resetNote: string;     // "Данные тестовые. Автосброс через 3 часа неактивности."
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
    cannotEditRealData: string; // tooltip/ошибка: в демо нельзя менять реальные записи
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
    createNoSubjects: string;
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
    autoOpen: string;             // "Урок откроется автоматически"
    planStagesSummary: string;    // "{count} этапов · {minutes} мин"
    planStagesSummaryNoDuration: string; // "{count} этапов" (no duration_min set)
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
    stageContentH5p: string;           // "H5P Interactive"
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
    stageTaskStubPrefix: string;       // "Здесь будет: "
    stageTaskSubmittedLabel: string;   // "Сдано"
    stageTaskGradedLabel: string;      // "Оценка"
    stageTaskCloseBtn: string;         // "Закрыть"
    // Auto-schedule + visibility (migration 36)
    completedLock: string;             // "Урок завершён. Редактирование недоступно."
    durationMinutes: string;           // "Длительность (мин.)"
    stageLocked: string;               // "Сначала пройди"
    stageLockedSummary: string;        // "Доступно после завершения урока"
    materialVisibilityAll: string;     // "Видно всем"
    materialVisibilityTeacher: string; // "Только для учителя"
    materialTeacherOnlyBadge: string;  // "Только для учителя"
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
    makeAttendance: string;            // "Сделать перекличку"
    openAttendance: string;            // "Открыть посещаемость"
    openGrades: string;                // "Оценки"
    // Lesson auto-status (pg_cron, no manual start/end)
    scheduledAutoNote: string;         // "Урок начнётся автоматически по расписанию"
    inProgressAutoNote: string;        // "Урок идёт."
    inProgressMins: string;            // "Длится {n} мин."
    startLessonBtn: string;            // "Начать урок" — БОЛЬШОЕ ОБНОВЛЕНИЕ §7.6
    endLessonBtn: string;              // "Закончить урок"
    endLessonConfirm: string;          // confirm text before manual end
    reloadPage: string;                // "Обновить страницу" — reload button next to endLessonBtn
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
      close: string;
      launchGame: string;
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
    todayLessons: string;
    noLessons: string;
    recentActivity: string;
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
    groupsTitle: string;
    groupStudents: string;
    groupAttendance: string;
    groupAvgScore: string;
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
    rollCallPresent: string;
    rollCallExcused: string;
    rollCallUnexcused: string;
    rollCallSaved: string;
    rollCallStats: string;
    endLessonConfirmTitle: string;
    endLessonConfirmMsg: string;
    incompleteAttendanceTitle: string;
    incompleteAttendanceMsg: string;
    rollCallUnmarked: string;
    // Classwork
    classworkBtn: string;
    classworkModalTitle: string;
    classworkTabTask: string;
    classworkTabSubmissions: string;
    classworkTypeFile: string;
    classworkTypeTest: string;
    classworkTypeLearning: string;
    classworkTypeProgramming: string;
    classworkTitleLabel: string;
    classworkDescLabel: string;
    classworkTypeLabel: string;
    classworkSaveBtn: string;
    classworkSavingBtn: string;
    classworkDeleteBtn: string;
    classworkDeleteConfirm: string;
    classworkAddQuestion: string;
    classworkQuestionText: string;
    classworkQuestionOption: string;
    classworkMarkCorrect: string;
    classworkNoSubmissions: string;
    classworkSubmittedLabel: string;
    classworkGradeLabel: string;
    classworkCommentLabel: string;
    classworkGradeBtn: string;
    classworkGradedLabel: string;
    classworkTestScore: string;
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
    };
  };
  classwork: {
    title: string;
    submitBtn: string;
    submittedTitle: string;
    yourGrade: string;
    teacherComment: string;
    textAnswerLabel: string;
    textAnswerPlaceholder: string;
    attachFileLabel: string;
    submitError: string;
    testComplete: string;
    testResultsTitle: string;
    testScore: string;
    questionOf: string;    // "{n} из {total}"
    noClasswork: string;
    typeFile: string;
    typeTest: string;
    typeLearning: string;
    typeProgramming: string;
  };
  ai: {
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
    sectionCurator: string;       // "Куратор" — метка над строкой куратора (ученик)
    curatorSubtitle: string;      // "Куратор вашего класса" — подпись под именем куратора
    sectionGroupChat: string;     // "Групповой чат" — секция у ученика
    sectionTeachers: string;      // "Учителя" — секция личных чатов у ученика
    sectionGroupChats: string;    // "Групповые чаты" — секция у учителя
    sectionDirectChats: string;   // "Личные чаты" — секция у учителя (сгруппировано по классу)
  };
}
