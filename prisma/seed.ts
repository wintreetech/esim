import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { destinationSeeds } from "../src/lib/data/destinations";
import { deviceSeeds } from "../src/lib/data/devices";
import { databaseConfig } from "../src/lib/database-config";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before seeding.");
const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseConfig(process.env.DATABASE_URL)),
});
async function main() {
  for (const destination of destinationSeeds)
    await prisma.destination.upsert({
      where: { slug: destination.slug },
      create: destination,
      update: destination,
    });
  for (const device of deviceSeeds)
    await prisma.device.upsert({
      where: { brand_model: { brand: device.brand, model: device.model } },
      create: { ...device, supportsEsim: true },
      update: device,
    });
  await prisma.plan.updateMany({
    where: { provider: { in: ["mock", "supplier"] } },
    data: { active: false },
  });
  console.log(
    "Seeded destination content and device examples. No plans or prices were fabricated. Run npm run db:sync to import ResellPortal inventory.",
  );
}
main().finally(() => prisma.$disconnect());
