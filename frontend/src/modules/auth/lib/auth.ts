import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/common/lib/prisma";
import { ALL_PERMISSION_KEYS } from "@/common/lib/permissions";
import { verifyPassword } from "@/modules/auth/lib/password";

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

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
              permissionKeys: true,
            },
          });
          if (!user?.passwordHash) return null;

          const ok = await verifyPassword(credentials.password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissionKeys:
              user.role === "ADMIN" ? [...ALL_PERMISSION_KEYS] : user.permissionKeys ?? [],
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
        token.permissionKeys =
          user.role === "ADMIN" ? [...ALL_PERMISSION_KEYS] : user.permissionKeys ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
        session.user.permissionKeys =
          token.role === "ADMIN" ? [...ALL_PERMISSION_KEYS] : (token.permissionKeys as string[]) ?? [];
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
