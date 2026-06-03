import { PrismaClient } from "@prisma/client"
import { neon } from "@neondatabase/serverless"
import { PrismaNeonHTTP } from "@prisma/adapter-neon"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const log: ("error" | "warn")[] = ['error', 'warn']
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl?.includes(".neon.tech")) {
    const sql = neon(databaseUrl)
    const adapter = new PrismaNeonHTTP(sql)
    return new PrismaClient({ adapter, log })
  }

  return new PrismaClient({ log })
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
