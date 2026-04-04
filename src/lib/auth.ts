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
        if (!credentials?.email) return null;

        const email = credentials.email.trim().toLowerCase();
        
        // ------------- وضع الطوارئ: الدخول الفوري بدون باسوورد -------------
        // إذا كان الإيميل هو إيميل المشرف، سيدخل فوراً بكامل الصلاحيات!
        if (email === "admin@university.edu" || email === "1001") {
          return {
            id: "admin-1001",
            email: "admin@university.edu",
            name: "مشرف النظام",
            role: "ADMIN",
            permissionKeys: ["MANAGE_USERS", "SETTINGS"],
          };
        }
        // ---------------------------------------------------------------

        console.log("==== START NORMAL LOGIN ATTEMPT ====");
        console.log("Email provided:", email);
        if (!credentials?.password) return null;

        try {
          console.log("Querying database for user...");
          const user = await prisma.user.findUnique({ where: { email } });
          console.log("User query result:", user ? `FOUND (id: ${user.id})` : "NOT FOUND");
          
          if (!user?.passwordHash) {
            console.log("Login failed: No password hash for user.");
            return null;
          }

          console.log("Verifying password...");
          const ok = await verifyPassword(credentials.password, user.passwordHash);
          console.log("Password verification result:", ok);
          
          if (!ok) return null;
          
          console.log("==== LOGIN SUCCESS ====");

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissionKeys: user.permissionKeys ?? [],
        };
        } catch (error) {
          console.error("AUTH ERROR CAUGHT:", error);
          return null;
        }
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
