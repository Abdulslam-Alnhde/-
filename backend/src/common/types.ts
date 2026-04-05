/** Internal API: trusted caller identity from the Next.js BFF (x-user-* headers). */
import type { Role, User } from "@prisma/client";

export type ApiActor = {
  userId: string;
  role: Role;
  permissionKeys: string[];
  dbUser: User | null;
};

/** Use DB row when present; otherwise session-derived fields (e.g. emergency admin). */
export function actingSubject(actor: ApiActor) {
  if (actor.dbUser) return actor.dbUser;
  return {
    id: actor.userId,
    role: actor.role,
    permissionKeys: actor.permissionKeys,
  } as Pick<User, "id" | "role" | "permissionKeys"> &
    Partial<Omit<User, "id" | "role" | "permissionKeys">>;
}
