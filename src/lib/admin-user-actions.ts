import type { User } from "@prisma/client";

export type AdminUserAction = "list" | "create" | "edit" | "delete";

export type AdminPanelSubject = Pick<User, "permissionKeys"> & {
  role: User["role"] | string;
};

/**
 * صلاحيات لوحة «إدارة المستخدمين».
 * — إن كان الدور ADMIN ولم تُحدَّد أي مفاتيح، نعتبره مشرفاً كاملاً (حتى لا يُنشأ مشرف بلا صلاحيات بالخطأ).
 * — MANAGE_USERS يمنح كل الإجراءات.
 * — غير ذلك تُطبَّق المفاتيح الدقيقة (USERS_*).
 */
export function canAdminPanelAction(
  user: AdminPanelSubject,
  action: AdminUserAction
): boolean {
  const keys = user.permissionKeys ?? [];
  if (user.role === "ADMIN" && keys.length === 0) return true;
  if (keys.includes("MANAGE_USERS")) return true;
  switch (action) {
    case "list":
      return (
        keys.includes("USERS_CREATE") ||
        keys.includes("USERS_EDIT_PERMISSIONS") ||
        keys.includes("USERS_DELETE")
      );
    case "create":
      return keys.includes("USERS_CREATE");
    case "edit":
      return keys.includes("USERS_EDIT_PERMISSIONS");
    case "delete":
      return keys.includes("USERS_DELETE");
    default:
      return false;
  }
}
