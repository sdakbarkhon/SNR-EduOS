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
    lowWarning: string; // "Посещаемость ниже {threshold}%"
    prevMonth: string;
    nextMonth: string;
    kpiOverall: string;
    kpiDays: string;
    kpiMissed: string;
    daysUnit: string;
    lessonsUnit: string;
    calendarTitle: string;
    legendPresent: string;
    legendAbsent: string;
    legendLate: string;
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
}
