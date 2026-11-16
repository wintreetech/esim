import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { roamlyDb?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  if (!globalDb.roamlyDb)
    globalDb.roamlyDb = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 5000,
      }),
    });
  return globalDb.roamlyDb;
}
