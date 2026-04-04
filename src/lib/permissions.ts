/** مفاتيح الصلاحيات المعتمدة في النظام */
export const PERMISSION_KEYS = {
  /** تعديل نص إجابة الطالب بعد الاستخراج (لجنة / مراجعة) */
  EDIT_STUDENT_EXTRACT: "EDIT_STUDENT_EXTRACT",
  /** إعادة تشغيل التصحيح بعد تعديل الاستخراج */
  RE_RUN_GRADING: "RE_RUN_GRADING",
  /** اعتماد أو رفض نماذج الاختبارات */
  APPROVE_EXAMS: "APPROVE_EXAMS",
  /** إدارة حسابات المستخدمين والصلاحيات — كامل الصلاحيات */
  MANAGE_USERS: "MANAGE_USERS",
  /** إنشاء مستخدمين جدد */
  USERS_CREATE: "USERS_CREATE",
  /** تعديل بيانات المستخدمين وصلاحياتهم */
  USERS_EDIT_PERMISSIONS: "USERS_EDIT_PERMISSIONS",
  /** حذف مستخدمين */
  USERS_DELETE: "USERS_DELETE",
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

/** صلاحيات عضو اللجنة (مراجعة الاختبارات) */
export const COMMITTEE_PERMISSION_KEYS: readonly string[] = [
  PERMISSION_KEYS.EDIT_STUDENT_EXTRACT,
  PERMISSION_KEYS.RE_RUN_GRADING,
  PERMISSION_KEYS.APPROVE_EXAMS,
] as const;

/** صلاحيات لوحة الإدارة (مشرفون فرعيون) */
export const ADMIN_PANEL_PERMISSION_KEYS: readonly string[] = [
  PERMISSION_KEYS.MANAGE_USERS,
  PERMISSION_KEYS.USERS_CREATE,
  PERMISSION_KEYS.USERS_EDIT_PERMISSIONS,
  PERMISSION_KEYS.USERS_DELETE,
] as const;

const committeeSet = new Set(COMMITTEE_PERMISSION_KEYS);
const adminPanelSet = new Set(ADMIN_PANEL_PERMISSION_KEYS);

export function sanitizeKeysForRole(
  role: string,
  keys: string[]
): string[] {
  if (role === "TEACHER") return [];
  if (role === "COMMITTEE") {
    return keys.filter((k) => committeeSet.has(k));
  }
  if (role === "ADMIN") {
    return keys.filter((k) => adminPanelSet.has(k));
  }
  return [];
}

export const PERMISSION_LABELS_AR: Record<string, string> = {
  [PERMISSION_KEYS.EDIT_STUDENT_EXTRACT]:
    "تعديل إجابات الطلاب المستخرجة من الورقة",
  [PERMISSION_KEYS.RE_RUN_GRADING]: "إعادة التصحيح بعد تعديل الاستخراج",
  [PERMISSION_KEYS.APPROVE_EXAMS]: "اعتماد أو رفض نماذج الاختبارات",
  [PERMISSION_KEYS.MANAGE_USERS]:
    "إدارة المستخدمين كاملة (إنشاء، تعديل صلاحيات، حذف)",
  [PERMISSION_KEYS.USERS_CREATE]: "إضافة مستخدمين جدد",
  [PERMISSION_KEYS.USERS_EDIT_PERMISSIONS]:
    "تعديل بيانات المستخدمين وصلاحياتهم",
  [PERMISSION_KEYS.USERS_DELETE]: "حذف مستخدمين",
};

/** المشرف (ADMIN) يتجاوز صلاحيات اللجنة في واجهات المراجعة فقط */
export function hasPermission(
  role: string,
  permissionKeys: string[] | undefined,
  key: PermissionKey
): boolean {
  if (role === "ADMIN") return true;
  return Array.isArray(permissionKeys) && permissionKeys.includes(key);
}
