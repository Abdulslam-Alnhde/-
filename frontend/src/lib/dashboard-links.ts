/** روابط موحّدة لبطاقات لوحات التحكم — تسهيل الصيانة وتفادي أخطاء المسارات */

export const TEACHER_LINKS = {
  dashboard: "/teacher",
  exams: "/teacher/exams",
  examsPending: "/teacher/exams?status=PENDING_APPROVAL",
  examsApproved: "/teacher/exams?status=APPROVED",
  examsRejected: "/teacher/exams?status=REJECTED",
  createExam: "/teacher/create-exam",
  inbox: "/teacher/inbox",
  settings: "/teacher/settings",
} as const;

/** مسار صفحة تفاصيل نموذج اختبار محفوظ — منفصل عن الكائن لتفادي تعارض `as const` */
export function teacherExamDetailPath(examId: string) {
  return `/teacher/exams/${encodeURIComponent(examId)}`;
}

export const COMMITTEE_LINKS = {
  stats: "/committee",
  queue: "/committee/queue",
  activity: "/committee#committee-activity",
  kpis: "/committee#committee-kpis",
  settings: "/committee/settings",
} as const;

export const ADMIN_LINKS = {
  overview: "/admin",
  users: "/admin/users",
  examsLog: "/admin#exams-log",
  settings: "/admin/settings",
  support: "/admin/support",
} as const;

/** مسار «البريد»/التنبيهات من شريط العلوي — يربط الجرس بصندوق الوارد أو أقرب مسار مناسب */
export function dashboardMailHref(role: "TEACHER" | "COMMITTEE" | "ADMIN"): string {
  switch (role) {
    case "TEACHER":
      return TEACHER_LINKS.inbox;
    case "COMMITTEE":
      return COMMITTEE_LINKS.queue;
    case "ADMIN":
      return ADMIN_LINKS.overview;
    default:
      return "/";
  }
}
