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
    legendLate: string;   // reused as "Уваж. пропуск" in new scheme
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
    };
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
}
