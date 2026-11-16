import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConfig } from "./database-config";
const globalDb = globalThis as unknown as { roamlyDb?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  if (!globalDb.roamlyDb)
    globalDb.roamlyDb = new PrismaClient({
      adapter: new PrismaPg(databaseConfig(process.env.DATABASE_URL)),
    });
  return globalDb.roamlyDb;
}
