import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getProvider } from "./provider";
import { calculatePrice, pricingConfig } from "@/lib/pricing/calculate-price";
import { destinationSeeds } from "@/lib/data/destinations";
import { providerName as configuredProvider } from "./config";
export async function syncCatalog() {
  const providerName = configuredProvider(),
    provider = getProvider();
  const destinations = await provider.getDestinations();
  const pricing = pricingConfig();
  // Initial launch allowlist; adding destinations is data-driven, not a new route.
  const allowed = new Set(destinationSeeds.map((d) => d.isoCode));
  let importedPlans = 0,
    deactivatedPlans = 0;
  for (const remote of destinations.filter((d) => allowed.has(d.code))) {
    const { code, ...fields } = remote;
    const destination = await db().destination.upsert({
      where: { isoCode: code },
      create: { ...fields, isoCode: code },
      update: { name: fields.name, description: fields.description },
    });
    const plans = (await provider.getPlans(code)).map((plan) => ({
      ...plan,
      retailPrice: calculatePrice({
        wholesale: plan.wholesalePrice,
        ...pricing,
        taxPercent: 0,
      }).subtotal,
    }));
    importedPlans += plans.length;
    // Fetch and validate the complete response before deactivating stale inventory.
    const deactivated = await db().$transaction(
      async (tx) => {
        const syncedAt = new Date();
        // One parameterized upsert per batch replaces two round trips per plan.
        // Keep all batches and stale-stock retirement atomic for this destination.
        for (let offset = 0; offset < plans.length; offset += 100) {
          const rows = plans.slice(offset, offset + 100).map((p) => {
            const coverage = p.coverage.length
              ? Prisma.sql`ARRAY[${Prisma.join(p.coverage)}]::text[]`
              : Prisma.sql`ARRAY[]::text[]`;
            return Prisma.sql`(
            ${randomUUID()}, ${destination.id}, ${providerName}, ${p.id},
            ${p.name}, ${p.dataAmountMB}, ${p.dataLabel}, ${p.validityDays},
            ${p.network}, ${p.speed}, ${coverage}, ${p.supports5G},
            ${p.supportsHotspot}, ${p.supportsTopup}, ${p.wholesalePrice},
            ${p.retailPrice}, ${p.currency}, ${syncedAt}, ${syncedAt}, ${syncedAt}
          )`;
          });
          const saved = await tx.$queryRaw<
            { id: string; unsafe: boolean }[]
          >(Prisma.sql`
          INSERT INTO "Plan" (
            "id", "destinationId", "provider", "supplierPlanId", "name",
            "dataAmountMB", "dataLabel", "validityDays", "network", "speed",
            "coverage", "supports5G", "supportsHotspot", "supportsTopup",
            "wholesalePrice", "retailPrice", "currency", "syncedAt", "createdAt", "updatedAt"
          ) VALUES ${Prisma.join(rows)}
          ON CONFLICT ("provider", "supplierPlanId") DO UPDATE SET
            "destinationId" = EXCLUDED."destinationId",
            "name" = EXCLUDED."name",
            "dataAmountMB" = EXCLUDED."dataAmountMB",
            "dataLabel" = EXCLUDED."dataLabel",
            "validityDays" = EXCLUDED."validityDays",
            "network" = EXCLUDED."network",
            "speed" = EXCLUDED."speed",
            "coverage" = EXCLUDED."coverage",
            "supports5G" = EXCLUDED."supports5G",
            "supportsHotspot" = EXCLUDED."supportsHotspot",
            "supportsTopup" = EXCLUDED."supportsTopup",
            "wholesalePrice" = EXCLUDED."wholesalePrice",
            "retailPrice" = EXCLUDED."retailPrice",
            "currency" = EXCLUDED."currency",
            "syncedAt" = EXCLUDED."syncedAt",
            "updatedAt" = EXCLUDED."updatedAt",
            "active" = CASE
              WHEN "Plan"."retailOverride" < EXCLUDED."wholesalePrice" + ${pricing.minMargin}
              THEN false ELSE "Plan"."active" END
          RETURNING "id", COALESCE("retailOverride" < "wholesalePrice" + ${pricing.minMargin}, false) AS "unsafe"
        `);
          const unsafe = saved.filter((p) => p.unsafe);
          if (unsafe.length)
            await tx.auditLog.createMany({
              data: unsafe.map((p) => ({
                action: "PLAN_MARGIN_REVIEW_REQUIRED",
                detail: p.id,
              })),
            });
        }
        return tx.plan.updateMany({
          where: {
            destinationId: destination.id,
            provider: providerName,
            active: true,
            supplierPlanId: { notIn: plans.map((p) => p.id) },
          },
          data: { active: false },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    deactivatedPlans += deactivated.count;
  }
  return {
    destinations: destinations.filter((d) => allowed.has(d.code)).length,
    plans: importedPlans,
    deactivatedPlans,
  };
}
