import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConfig } from "../src/lib/database-config";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before promoting an admin.");
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email)
  throw new Error("Set ADMIN_EMAIL to the exact verified account email first.");
const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseConfig(process.env.DATABASE_URL)),
});
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    throw new Error(
      "Sign in with this email first. This script only promotes an existing verified account.",
    );
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    prisma.auditLog.create({
      data: { actorId: user.id, action: "ADMIN_PROMOTED_BY_OPERATOR" },
    }),
  ]);
  console.log("Existing account promoted to ADMIN.");
} finally {
  await prisma.$disconnect();
}
