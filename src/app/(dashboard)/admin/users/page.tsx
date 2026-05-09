"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "@/lib/motion";
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
import { Button } from "@/components/ui/button";
import {
  ADMIN_PANEL_PERMISSION_KEYS,
  COMMITTEE_PERMISSION_KEYS,
} from "@/lib/permissions";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

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
      <div className="space-y-3 rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-indigo-50/40 to-violet-50/20 p-4 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-zinc-900/40">
        <div
          className={
            description
              ? "border-b border-indigo-100/80 pb-2 dark:border-indigo-900/50"
              : ""
          }
        >
          <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          {items.map((p) => (
            <label
              key={p.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-slate-300"
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
      <div className="flex shrink-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-3xl font-black tracking-tight text-transparent dark:from-indigo-400 dark:to-violet-400">
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
            إنشاء الحسابات، ربطها بالكلية، وضبط صلاحيات اللجنة أو الإدارة حسب
            الدور.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === "users" ? "default" : "outline"}
            onClick={() => setTab("users")}
            className="gap-2 rounded-xl font-bold shadow-sm"
          >
            <Users className="h-4 w-4" /> الدليل
          </Button>
          <Button
            variant={tab === "requests" ? "default" : "outline"}
            onClick={() => setTab("requests")}
            className="gap-2 rounded-xl font-bold"
          >
            <ClipboardList className="h-4 w-4" /> طلبات البيانات
            {pendingCount > 0 && (
              <span className="mr-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {tab === "users" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {canCreate && (
              <Button
                onClick={() => {
                  setNewUser(emptyForm());
                  setIsAdding(true);
                }}
                className="h-12 w-fit gap-2 rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 px-6 font-black shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700"
              >
                <UserPlus className="h-5 w-5" /> تسجيل حساب جديد
              </Button>
            )}
            <div className="relative max-w-md flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-200/80 bg-white py-3 pl-4 pr-10 text-sm font-medium shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-4 p-24">
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                  <p className="text-sm font-bold text-muted-foreground">
                    جارِ جلب البيانات…
                  </p>
                </div>
              ) : !canList ? (
                <div className="p-16 text-center text-sm font-bold text-amber-800 dark:text-amber-200">
                  ليس لديك صلاحية عرض قائمة المستخدمين.
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-24 text-center text-sm font-medium text-muted-foreground">
                  لا توجد حسابات.
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-right">
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-5 py-4">المستخدم</th>
                      <th className="px-5 py-4">الكلية</th>
                      <th className="px-5 py-4">الدور</th>
                      <th className="px-5 py-4">الصلاحيات</th>
                      <th className="px-5 py-4">الملف</th>
                      <th className="px-5 py-4 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    <AnimatePresence>
                      {filteredUsers.map((user, i) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="group hover:bg-slate-50/80 dark:hover:bg-zinc-900/50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/60 bg-indigo-50 text-sm font-black text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
                                {user.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-foreground">
                                  {user.name}
                                </p>
                                <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{user.email}</span>
                                </p>
                                {user.employeeCode && (
                                  <p className="mt-0.5 text-[10px] font-mono text-slate-500">
                                    وظيفي: {user.employeeCode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex max-w-[180px] items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                              <span className="line-clamp-2">
                                {user.college?.name ?? "—"}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex text-[10px] font-black tracking-wide ${
                                user.role === "ADMIN"
                                  ? "rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                                  : user.role === "COMMITTEE"
                                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
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
                              <span className="text-[10px] font-black text-amber-700">
                                مقفل
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-emerald-700">
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
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {reqLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              لا توجد طلبات.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between dark:border-zinc-800"
                >
                  <div className="space-y-1 text-right">
                    <p className="font-black">
                      {r.user?.name ?? "—"}{" "}
                      <span className="text-xs font-mono text-muted-foreground">
                        {r.user?.email}
                      </span>
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] font-mono dark:bg-zinc-900">
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
                        className="rounded-xl bg-emerald-600 font-black"
                        onClick={() => reviewRequest(r.id, "APPROVED")}
                      >
                        موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-rose-300 font-bold text-rose-700"
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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white px-6 py-5 dark:border-zinc-800 dark:from-indigo-950/40 dark:to-zinc-950">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      حساب جديد
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      البيانات الأساسية، الكلية، ثم الصلاحيات حسب الدور.
                    </p>
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
                      label="الرقم الوظيفي (المعرّف الأساسي)"
                      value={newUser.employeeCode}
                      onChange={(v) =>
                        setNewUser({ ...newUser, employeeCode: v })
                      }
                      required
                      hint="معرّف فريد للموظف في النظام"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="البريد الجامعي (لتسجيل الدخول)"
                      value={newUser.email}
                      onChange={(v) => setNewUser({ ...newUser, email: v })}
                      type="email"
                      required
                    />
                    <Field
                      label="كلمة المرور الأولية"
                      value={newUser.password}
                      onChange={(v) => setNewUser({ ...newUser, password: v })}
                      type="password"
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        الدور الوظيفي في النظام
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setRoleNew(e.target.value)}
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="TEACHER">عضو هيئة تدريس</option>
                        <option value="COMMITTEE">عضو لجنة</option>
                        <option value="ADMIN">مشرف نظام</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <Building2 className="h-3.5 w-3.5" />
                        الكلية <span className="text-rose-600">*</span>
                      </label>
                      <select
                        required
                        value={newUser.collegeId}
                        onChange={(e) =>
                          setNewUser({ ...newUser, collegeId: e.target.value })
                        }
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-950"
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
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
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
                    <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                      قفل التعديل المباشر للملف (يتطلب موافقة مشرف)
                    </span>
                  </label>

                  {newUser.role === "COMMITTEE" && (
                    <PermissionsBlock
                      title="صلاحيات اللجنة والمراجعة"
                      description="مراجعة الاستخراج، التصحيح، واعتماد النماذج."
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
                      description="تحكم من يستطيع إضافة مستخدمين، تعديل صلاحياتهم، أو حذفهم. «إدارة كاملة» تمنح كل ذلك."
                      items={adminPerms}
                      role={newUser.role}
                      keys={newUser.permissionKeys}
                      onChange={(k) =>
                        setNewUser({ ...newUser, permissionKeys: k })
                      }
                    />
                  )}
                </div>
                <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 rounded-2xl font-black"
                    onClick={() => setIsAdding(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-12 flex-1 rounded-2xl bg-indigo-600 font-black hover:bg-indigo-700"
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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setEditingUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-zinc-800">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <Shield className="h-6 w-6 text-indigo-600" />
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
                      <label className="text-[10px] font-black uppercase text-slate-500">
                        الدور
                      </label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setRoleEdit(e.target.value)}
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="TEACHER">عضو هيئة تدريس</option>
                        <option value="COMMITTEE">عضو لجنة</option>
                        <option value="ADMIN">مشرف نظام</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                        <Building2 className="h-3.5 w-3.5" />
                        الكلية <span className="text-rose-600">*</span>
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
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-950"
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
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 dark:border-zinc-800">
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
                <div className="flex gap-3 border-t px-6 py-4 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 rounded-2xl font-black"
                    onClick={() => setEditingUser(null)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-12 flex-1 rounded-2xl bg-indigo-600 font-black"
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
      <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-950"
      />
      {hint ? (
        <p className="text-[10px] font-medium text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
