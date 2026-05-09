/** Colleges service — database access for college lookup/list. */
import { prisma } from "@/lib/prisma";

export async function listColleges() {
  return prisma.college.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
