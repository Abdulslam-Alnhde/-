import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        
        // استخدام اتصال مباشر لتجاوز أي أخطاء في إعدادات Vercel
        const { PrismaClient } = require("@prisma/client");
        const authPrisma = new PrismaClient({
          datasourceUrl: "postgresql://postgres:Abdulslam2026@db.cgcgtojvfqtshepbbtrh.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1",
        });

        const user = await authPrisma.user.findUnique({ where: { email } }).finally(() => authPrisma.$disconnect());
        
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissionKeys: user.permissionKeys ?? [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissionKeys = user.permissionKeys ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
        session.user.permissionKeys = (token.permissionKeys as string[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-only-change-me-use-long-random-string-in-production",
};
