import { PrismaClient } from "@prisma/client"
import { Pool, neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const log: ("error" | "warn")[] = ['error', 'warn']
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl?.includes(".neon.tech")) {
    neonConfig.webSocketConstructor = ws
    const pool = new Pool({ connectionString: databaseUrl })
    const adapter = new PrismaNeon(pool)
    return new PrismaClient({ adapter, log })
  }

  return new PrismaClient({ log })
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
