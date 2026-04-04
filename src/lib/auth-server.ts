import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Role, User as DbUser } from "@prisma/client";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export function unauthorized() {
  return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
}

export async function requireAuth(): Promise<
  { session: Session; error: null } | { session: null; error: NextResponse }
> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { session: null, error: unauthorized() };
  }
  return { session, error: null };
}

export async function requireRole(allowed: Role[]): Promise<
  | { session: Session; user: DbUser | null; error: null }
  | { session: null; user: null; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) {
    return { session: null, user: null, error: auth.error };
  }
  const role = auth.session.user.role;
  if (!allowed.includes(role)) {
    return { session: null, user: null, error: forbidden() };
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.session.user.id },
  });
  return { session: auth.session, user, error: null };
}
