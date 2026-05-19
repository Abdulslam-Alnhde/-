"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "@/common/lib/motion";
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Trash2,
  Loader2,
  CheckCircle,
  Pencil,
  Shield,
  X,
  ClipboardList,
  Building2,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import {
  ADMIN_PANEL_PERMISSION_KEYS,
  COMMITTEE_PERMISSION_KEYS,
} from "@/common/lib/permissions";
import { canAdminPanelAction } from "@/common/lib/admin-user-actions";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { EmptyState } from "@/common/components/dashboard/EmptyState";

type PermissionItem = { key: string; labelAr: string };

type CollegeRow = { id: string; name: string };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeCode?: string | null;
  collegeId?: string | null;
  college?: { id: string; name: string } | null;
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  permissionKeys?: string[];
  profileLocked?: boolean;
};

type ProfileRequest = {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

const emptyForm = () => ({
  name: "",
  email: "",
  password: "",
  role: "TEACHER",
  employeeCode: "",
  collegeId: "",
  department: "",
  jobTitle: "",
  phone: "",
  permissionKeys: [] as string[],
  profileLocked: true,
});

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "requests">("users");

  const [permList, setPermList] = useState<PermissionItem[]>([]);
  const [colleges, setColleges] = useState<CollegeRow[]>([]);
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  const [currentActor, setCurrentActor] = useState<UserRow | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [newUser, setNewUser] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const committeeKeySet = useMemo(
    () => new Set<string>([...COMMITTEE_PERMISSION_KEYS]),
    []
  );
  const adminKeySet = useMemo(
    () => new Set<string>([...ADMIN_PANEL_PERMISSION_KEYS]),
    []
  );

  const committeePerms = useMemo(
    () => permList.filter((p) => committeeKeySet.has(p.key)),
    [permList, committeeKeySet]
  );

  const adminPerms = useMemo(
    () => permList.filter((p) => adminKeySet.has(p.key)),
    [permList, adminKeySet]
  );

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get<UserRow[]>("/api/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await axios.get<UserRow>("/api/users/me");
      setCurrentActor(data);
    } catch {
      setCurrentActor(null);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await axios.get<PermissionItem[]>("/api/permissions");
      setPermList(Array.isArray(data) ? data : []);
    } catch {
      setPermList([]);
    }
  }, []);

  const fetchColleges = useCallback(async () => {
    try {
      const { data } = await axios.get<CollegeRow[]>("/api/colleges");
      setColleges(Array.isArray(data) ? data : []);
    } catch {
      setColleges([]);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const { data } = await axios.get<ProfileRequest[]>(
        "/api/profile-requests"
      );
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
    fetchMe();
  }, [fetchUsers, fetchPermissions, fetchMe]);

  useEffect(() => {
    if (tab === "users") {
      fetchColleges();
    }
  }, [tab, fetchColleges]);

  useEffect(() => {
    if (tab === "requests") fetchRequests();
  }, [tab, fetchRequests]);

  useEffect(() => {
    if (isAdding || editingUser) {
      fetchColleges();
    }
  }, [isAdding, editingUser, fetchColleges]);

  const actorPerm = currentActor
    ? {
        role: currentActor.role,
        permissionKeys: currentActor.permissionKeys ?? [],
      }
    : null;

  const canList = actorPerm
    ? canAdminPanelAction(actorPerm, "list")
    : false;
  const canCreate = actorPerm
    ? canAdminPanelAction(actorPerm, "create")
    : false;
  const canEdit = actorPerm
    ? canAdminPanelAction(actorPerm, "edit")
    : false;
  const canDelete = actorPerm
    ? canAdminPanelAction(actorPerm, "delete")
    : false;

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeCode &&
        u.employeeCode.toLowerCase().includes(search.toLowerCase()))
  );

  const togglePerm = (
    keys: string[],
    key: string,
    setKeys: (k: string[]) => void
  ) => {
    if (keys.includes(key)) setKeys(keys.filter((x) => x !== key));
    else setKeys([...keys, key]);
  };

  function PermissionsBlock({
    title,
    description,
    items,
    role,
    keys,
    onChange,
  }: {
    title: string;
    description?: string;
    items: PermissionItem[];
    role: string;
    keys: string[];
    onChange: (k: string[]) => void;
  }) {
    if (role === "TEACHER") return null;
    return (
      <div className="space-y-3 rounded-2xl border border-[#E8E8E8] bg-brand-teal/5 p-4">
        <div
          className={
            description
              ? "border-b border-brand-teal/20 pb-2"
              : ""
          }
        >
          <p className="text-xs font-semibold text-brand-teal">
            {title}
          </p>
        </div>
        <div className="grid gap-2">
          {items.map((p) => (
            <label
              key={p.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-sm shadow-sm"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-border"
                checked={keys.includes(p.key)}
                onChange={() => togglePerm(keys, p.key, onChange)}
              />
              <span className="text-right leading-snug">
                <span className="font-bold text-foreground">{p.labelAr}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.collegeId) {
      alert("اختر الكلية.");
      return;
    }
    if (!newUser.employeeCode.trim()) {
      alert("الرقم الوظيفي مطلوب.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post("/api/users", {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        employeeCode: newUser.employeeCode.trim(),
        collegeId: newUser.collegeId,
        department: newUser.department || null,
        jobTitle: newUser.jobTitle || null,
        phone: newUser.phone || null,
        permissionKeys:
          newUser.role === "TEACHER" ? [] : newUser.permissionKeys,
        profileLocked: newUser.profileLocked,
      });
      await fetchUsers();
      setIsAdding(false);
      setNewUser(emptyForm());
      alert(
        "تم حفظ الحساب في قاعدة البيانات. يمكن للمستخدم تسجيل الدخول باستخدام البريد وكلمة المرور التي أدخلتها."
      );
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "فشل في إضافة المستخدم";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      employeeCode: u.employeeCode ?? "",
      collegeId: u.collegeId ?? "",
      department: u.department ?? "",
      jobTitle: u.jobTitle ?? "",
      phone: u.phone ?? "",
      permissionKeys: u.permissionKeys ?? [],
      profileLocked: u.profileLocked ?? true,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.employeeCode.trim()) {
      alert("الرقم الوظيفي مطلوب.");
      return;
    }
    if (!editForm.collegeId) {
      alert("اختر الكلية.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.patch(`/api/users/${editingUser.id}`, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        employeeCode: editForm.employeeCode.trim(),
        collegeId: editForm.collegeId,
        department: editForm.department || null,
        jobTitle: editForm.jobTitle || null,
        phone: editForm.phone || null,
        permissionKeys:
          editForm.role === "TEACHER" ? [] : editForm.permissionKeys,
        profileLocked: editForm.profileLocked,
        ...(editForm.password.trim()
          ? { password: editForm.password }
          : {}),
      });
      await fetchUsers();
      setEditingUser(null);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "فشل التحديث";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`حذف المستخدم «${u.name}» نهائياً؟`)
    ) {
      return;
    }
    try {
      await axios.delete(`/api/users/${u.id}`);
      await fetchUsers();
    } catch {
      alert("تعذر حذف المستخدم.");
    }
  };

  const reviewRequest = async (
    id: string,
    status: "APPROVED" | "REJECTED"
  ) => {
    const note =
      status === "REJECTED"
        ? prompt("ملاحظة الرفض (اختياري):") ?? ""
        : undefined;
    try {
      await axios.patch(`/api/profile-requests/${id}`, {
        status,
        adminNote: note || null,
      });
      await fetchRequests();
      await fetchUsers();
    } catch {
      alert("تعذر تحديث الطلب.");
    }
  };

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests]
  );

  const setRoleNew = (role: string) => {
    setNewUser((prev) => ({
      ...prev,
      role,
      permissionKeys: role === "TEACHER" ? [] : prev.permissionKeys,
    }));
  };

  const setRoleEdit = (role: string) => {
    setEditForm((prev) => ({
      ...prev,
      role,
      permissionKeys: role === "TEACHER" ? [] : prev.permissionKeys,
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col space-y-8 animate-in fade-in duration-700">
      <PageHeader
        eyebrow="مدير النظام"
        title="إدارة المستخدمين"
        subtitle="أضف الحسابات وعدّل الأدوار والصلاحيات وراجع طلبات التعديل."
        actions={
          <>
            <Button
              variant={tab === "users" ? "default" : "outline"}
              onClick={() => setTab("users")}
              className="h-11 gap-2 rounded-xl font-bold"
            >
              <Users className="h-4 w-4" /> المستخدمون
            </Button>
            <Button
              variant={tab === "requests" ? "default" : "outline"}
              onClick={() => setTab("requests")}
              className="h-11 gap-2 rounded-xl font-bold"
            >
              <ClipboardList className="h-4 w-4" /> طلبات التعديل
              {pendingCount > 0 && (
                <span className="mr-1 rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Button>
          </>
        }
      />

      {tab === "users" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {canCreate && (
              <Button
                onClick={() => {
                  setNewUser(emptyForm());
                  setIsAdding(true);
                }}
                className="h-11 w-fit gap-2 rounded-xl bg-brand-teal px-5 font-bold text-white hover:bg-brand-teal/90"
              >
                <UserPlus className="h-4 w-4" /> إضافة مستخدم
              </Button>
            )}
            <div className="relative max-w-md flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-4 pr-10 text-sm font-medium transition focus:border-brand-teal/70 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <PageLoading message="جارِ جلب البيانات…" />
              ) : !canList ? (
                <div className="p-16 text-center text-sm font-bold text-brand-orange">
                  ليس لديك صلاحية عرض قائمة المستخدمين.
                </div>
              ) : filteredUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="لا توجد حسابات"
                  description="لم نعثر على مستخدمين مطابقين لبحثك."
                />
              ) : (
                <table className="w-full min-w-[720px] text-right">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/50">
                    <tr className="text-xs font-bold text-muted-foreground">
                      <th className="px-5 py-4">المستخدم</th>
                      <th className="px-5 py-4">الكلية</th>
                      <th className="px-5 py-4">الدور</th>
                      <th className="px-5 py-4">الصلاحيات</th>
                      <th className="px-5 py-4">الملف</th>
                      <th className="px-5 py-4 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence>
                      {filteredUsers.map((user, i) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="group hover:bg-brand-teal-light/40 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-teal/30 bg-brand-teal/10 text-sm font-semibold text-brand-teal">
                                {user.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {user.name}
                                </p>
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{user.email}</span>
                                </p>
                                {user.employeeCode && (
                                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                                    وظيفي: {user.employeeCode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex max-w-[180px] items-center gap-1.5 text-xs font-bold text-foreground">
                              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand-teal" />
                              <span className="line-clamp-2">
                                {user.college?.name ?? "—"}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex text-[10px] font-black tracking-wide ${
                                user.role === "ADMIN"
                                  ? "rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1 text-brand-teal"
                                  : user.role === "COMMITTEE"
                                    ? "rounded-lg border border-[#00A99D]/30 bg-[#E6F7F6] px-2.5 py-1 text-[#00A99D]"
                                    : "rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1 text-brand-teal"
                              }`}
                            >
                              {user.role === "ADMIN"
                                ? "مدير"
                                : user.role === "COMMITTEE"
                                  ? "لجنة"
                                  : "تدريس"}
                            </span>
                          </td>
                          <td className="max-w-[200px] px-5 py-4">
                            <p className="line-clamp-3 text-[10px] font-mono leading-relaxed text-muted-foreground">
                              {user.role === "TEACHER"
                                ? "—"
                                : (user.permissionKeys ?? []).join(", ") ||
                                  "—"}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {user.profileLocked ? (
                              <span className="text-[10px] font-black text-brand-orange">
                                مقفل
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-brand-teal">
                                تعديل مباشر
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-left">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit &&
                                currentActor?.id !== user.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-9 w-9 rounded-full"
                                    onClick={() => openEdit(user)}
                                    title="تعديل"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              {canDelete &&
                                currentActor?.id !== user.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(user)}
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "requests" && (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
          {reqLoading ? (
            <PageLoading message="جارِ تحميل الطلبات…" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="لا توجد طلبات"
              description="لم يتقدّم أي مستخدم بطلب تعديل ملف حتى الآن."
            />
          ) : (
            <div className="space-y-4">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 text-right">
                    <p className="font-black">
                      {r.user?.name ?? "—"}{" "}
                      <span className="text-xs font-mono text-muted-foreground">
                        {r.user?.email}
                      </span>
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-3 text-[11px] font-mono">
                      {JSON.stringify(r.payload, null, 2)}
                    </pre>
                    <p className="text-[10px] text-muted-foreground">
                      {r.status} ·{" "}
                      {new Date(r.createdAt).toLocaleString("ar-SA")}
                    </p>
                  </div>
                  {r.status === "PENDING" && canEdit && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl bg-[#00A99D] hover:bg-[#008F84] font-black text-white"
                        onClick={() => reviewRequest(r.id, "APPROVED")}
                      >
                        موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-[#D32F2F]/30 font-bold text-[#D32F2F] hover:bg-[#FFEBEB]"
                        onClick={() => reviewRequest(r.id, "REJECTED")}
                      >
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-[#EEEEEE] bg-white shadow-2xl dark:border-[#1E3330] dark:bg-[#1A2E2D]"
            >
              <div className="flex shrink-0 items-start justify-between border-b border-[#EEEEEE] bg-[#F8F8F8] px-6 py-5 dark:border-[#1E3330] dark:bg-[#162422]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-lg shadow-brand-teal/30">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      مستخدم جديد
                    </h3>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="shrink-0 rounded-full"
                  onClick={() => setIsAdding(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <form
                onSubmit={handleAddUser}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="space-y-5 overflow-y-auto px-6 py-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="الاسم الكامل"
                      value={newUser.name}
                      onChange={(v) => setNewUser({ ...newUser, name: v })}
                      required
                    />
                    <Field
                      label="الرقم الوظيفي"
                      value={newUser.employeeCode}
                      onChange={(v) =>
                        setNewUser({ ...newUser, employeeCode: v })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="البريد الجامعي"
                      value={newUser.email}
                      onChange={(v) => setNewUser({ ...newUser, email: v })}
                      type="email"
                      required
                    />
                    <Field
                      label="كلمة المرور"
                      value={newUser.password}
                      onChange={(v) => setNewUser({ ...newUser, password: v })}
                      type="password"
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        الدور
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setRoleNew(e.target.value)}
                        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm font-medium dark:bg-[#162422] dark:text-[#C8DEDD]"
                      >
                        <option value="TEACHER">عضو هيئة تدريس</option>
                        <option value="COMMITTEE">عضو لجنة</option>
                        <option value="ADMIN">مشرف نظام</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        الكلية <span className="text-[#D32F2F]">*</span>
                      </label>
                      <select
                        required
                        value={newUser.collegeId}
                        onChange={(e) =>
                          setNewUser({ ...newUser, collegeId: e.target.value })
                        }
                        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm font-medium dark:bg-[#162422] dark:text-[#C8DEDD]"
                      >
                        <option value="">— اختر الكلية —</option>
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="القسم (اختياري)"
                      value={newUser.department}
                      onChange={(v) =>
                        setNewUser({ ...newUser, department: v })
                      }
                    />
                    <Field
                      label="المسمى الوظيفي (اختياري)"
                      value={newUser.jobTitle}
                      onChange={(v) =>
                        setNewUser({ ...newUser, jobTitle: v })
                      }
                    />
                  </div>
                  <Field
                    label="الجوال (اختياري)"
                    value={newUser.phone}
                    onChange={(v) => setNewUser({ ...newUser, phone: v })}
                    type="tel"
                  />
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 rounded"
                      checked={newUser.profileLocked}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          profileLocked: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold text-brand-orange">
                      قفل التعديل المباشر للملف (يتطلب موافقة مشرف)
                    </span>
                  </label>

                  {newUser.role === "COMMITTEE" && (
                    <PermissionsBlock
                      title="صلاحيات اللجنة"
                      items={committeePerms}
                      role={newUser.role}
                      keys={newUser.permissionKeys}
                      onChange={(k) =>
                        setNewUser({ ...newUser, permissionKeys: k })
                      }
                    />
                  )}
                  {newUser.role === "ADMIN" && (
                    <PermissionsBlock
                      title="صلاحيات الإدارة"
                      items={adminPerms}
                      role={newUser.role}
                      keys={newUser.permissionKeys}
                      onChange={(k) =>
                        setNewUser({ ...newUser, permissionKeys: k })
                      }
                    />
                  )}
                </div>
                <div className="flex shrink-0 gap-3 border-t border-border bg-muted/30 px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl font-medium"
                    onClick={() => setIsAdding(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 flex-1 rounded-xl bg-brand-teal font-medium hover:bg-brand-teal/90"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="ml-2 h-5 w-5" />
                        حفظ الحساب
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setEditingUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-[#EEEEEE] bg-white shadow-2xl dark:border-[#1E3330] dark:bg-[#1A2E2D]"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Shield className="h-5 w-5 text-brand-teal" />
                  تعديل مستخدم
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="rounded-full"
                  onClick={() => setEditingUser(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <form
                onSubmit={handleSaveEdit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="space-y-5 overflow-y-auto px-6 py-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="الاسم"
                      value={editForm.name}
                      onChange={(v) =>
                        setEditForm({ ...editForm, name: v })
                      }
                      required
                    />
                    <Field
                      label="البريد"
                      value={editForm.email}
                      onChange={(v) =>
                        setEditForm({ ...editForm, email: v })
                      }
                      type="email"
                      required
                    />
                  </div>
                  <Field
                    label="كلمة مرور جديدة (اتركها فارغة إن لم تتغير)"
                    value={editForm.password}
                    onChange={(v) =>
                      setEditForm({ ...editForm, password: v })
                    }
                    type="password"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        الدور
                      </label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setRoleEdit(e.target.value)}
                        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm font-medium dark:bg-[#162422] dark:text-[#C8DEDD]"
                      >
                        <option value="TEACHER">عضو هيئة تدريس</option>
                        <option value="COMMITTEE">عضو لجنة</option>
                        <option value="ADMIN">مشرف نظام</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        الكلية <span className="text-[#D32F2F]">*</span>
                      </label>
                      <select
                        required
                        value={editForm.collegeId}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            collegeId: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm font-medium dark:bg-[#162422] dark:text-[#C8DEDD]"
                      >
                        <option value="">— اختر الكلية —</option>
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Field
                    label="الرقم الوظيفي"
                    value={editForm.employeeCode}
                    onChange={(v) =>
                      setEditForm({ ...editForm, employeeCode: v })
                    }
                    required
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="القسم"
                      value={editForm.department}
                      onChange={(v) =>
                        setEditForm({ ...editForm, department: v })
                      }
                    />
                    <Field
                      label="المسمى الوظيفي"
                      value={editForm.jobTitle}
                      onChange={(v) =>
                        setEditForm({ ...editForm, jobTitle: v })
                      }
                    />
                  </div>
                  <Field
                    label="الجوال"
                    value={editForm.phone}
                    onChange={(v) =>
                      setEditForm({ ...editForm, phone: v })
                    }
                  />
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={editForm.profileLocked}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          profileLocked: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold">
                      قفل التعديل المباشر للملف
                    </span>
                  </label>

                  {editForm.role === "COMMITTEE" && (
                    <PermissionsBlock
                      title="صلاحيات اللجنة"
                      items={committeePerms}
                      role={editForm.role}
                      keys={editForm.permissionKeys}
                      onChange={(k) =>
                        setEditForm({ ...editForm, permissionKeys: k })
                      }
                    />
                  )}
                  {editForm.role === "ADMIN" && (
                    <PermissionsBlock
                      title="صلاحيات الإدارة"
                      description=""
                      items={adminPerms}
                      role={editForm.role}
                      keys={editForm.permissionKeys}
                      onChange={(k) =>
                        setEditForm({ ...editForm, permissionKeys: k })
                      }
                    />
                  )}
                </div>
                <div className="flex gap-3 border-t border-border px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl font-medium"
                    onClick={() => setEditingUser(null)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 flex-1 rounded-xl bg-brand-teal font-medium"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "تحديث"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
      <div className="space-y-2">
      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-[#D32F2F]">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm font-medium transition focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 dark:bg-[#162422] dark:text-[#C8DEDD]"
      />
      {hint ? (
        <p className="text-[10px] font-medium text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
