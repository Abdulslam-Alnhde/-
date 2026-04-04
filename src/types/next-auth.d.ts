import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      permissionKeys: string[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    permissionKeys: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    permissionKeys: string[];
  }
}
