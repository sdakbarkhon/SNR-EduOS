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
    tagline: string;
    // Iter5 P1 — Stitch login redesign
    signingIn: string;    // "Вход..."
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
    kpiLate: string;
    kpiAbsent: string;
    kpiPercentage: string;
    filterSubject: string;
    filterAllSubjects: string;
    filterMonth: string;
    calendarLegendPresent: string;
    calendarLegendLate: string;
    calendarLegendAbsent: string;
    calendarLegendNone: string;
    // teacher attendance
    teacherTitle: string;
    teacherGroupLabel: string;
    teacherAllGroups: string;
    teacherAvgPct: string;
    teacherMatrixEmpty: string;
    teacherLegendPresent: string;
    teacherLegendLate: string;
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
    submittedFileLbl: string;
    uploadingFile: string;
    resubmitBtn: string;
    // Homework types (migration 31)
    typeLearning: string;
    typeProgramming: string;
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
      learningStub: string;
      learningStubSub: string;
      programmingStub: string;
      programmingStubSub: string;
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
      submit: string;           // "Отправить учителю"
      output: string;           // "Вывод"
      outputEmpty: string;
      runSoonTitle: string;     // "Скоро будет доступно"
      runSoonBody: string;
      understood: string;       // "Понятно"
      sent: string;             // "Код отправлен учителю"
      testsFile: string;        // "Файл с тестами"
      download: string;         // "Скачать"
      noCode: string;           // "Ученик ещё не отправил код"
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
    typeScratch: string;
  };
  sandbox: {
    title: string;          // "Проекты (песочница)"
    subtitle: string;
    backToMenu: string;     // "← Вернуться в меню проектов"
    modeProjects: string;   // вкладка "Проекты"
    modeSandbox: string;    // вкладка "Песочница"
    tools: {
      scratch: { name: string; description: string };
      wokwi: { name: string; description: string };
      codesandbox: { name: string; description: string };
      makecode: { name: string; description: string };
      code: { name: string; description: string };
    };
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
    resetNote: string;     // "Данные тестовые. Сброс раз в сутки в 3:00 ночи (Ташкент)."
    welcomeTitle: string;  // "Вы в демо-режиме"
    welcomeText: string;   // "Все данные тестовые."
    welcomeOk: string;     // "Понятно"
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
    };
    // Stage constructor v2 (migration 35)
    stageStartLabel: string;           // "Старт"
    stageSummaryLabel: string;         // "Итог"
    stageBadgeTheory: string;          // "Теория"
    stageBadgeTask: string;            // "Задача"
    stageContentPresentation: string;  // "Презентация"
    stageContentCode: string;          // "Программирование (код)"
    stageContentScratch: string;       // "Scratch"
    stageContentWokwi: string;         // "Wokwi"
    stageContentCodesandbox: string;   // "CodeSandbox"
    stageContentMakecode: string;      // "MakeCode Arcade"
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
      runningCpp: string;     // sending to Piston
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
    // External services: scratch / wokwi / codesandbox / makecode
    external: {
      scratch: string;
      wokwi: string;
      codesandbox: string;
      makecode: string;
      wokwiDesc: string;
      codesandboxDesc: string;
      makecodeDesc: string;
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
    hwCreatedMsg: string;
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
  };
}
