import "server-only";
import { db } from "@/lib/db";
import { getProvider } from "./provider";
import { calculatePrice, pricingConfig } from "@/lib/pricing/calculate-price";
import { destinationSeeds } from "@/lib/data/destinations";
import { providerName as configuredProvider } from "./config";
export async function syncCatalog() {
  const providerName = configuredProvider(),
    provider = getProvider();
  const destinations = await provider.getDestinations();
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
    const plans = await provider.getPlans(code);
    importedPlans += plans.length;
    // Fetch and validate the complete response before deactivating stale inventory.
    await db().$transaction(async (tx) => {
      for (const p of plans) {
        const retail = calculatePrice({
          wholesale: p.wholesalePrice,
          ...pricingConfig(),
          taxPercent: 0,
        }).subtotal;
        const data = {
          destinationId: destination.id,
          name: p.name,
          dataAmountMB: p.dataAmountMB,
          dataLabel: p.dataLabel,
          validityDays: p.validityDays,
          network: p.network,
          speed: p.speed,
          coverage: p.coverage,
          supports5G: p.supports5G,
          supportsHotspot: p.supportsHotspot,
          supportsTopup: p.supportsTopup,
          wholesalePrice: p.wholesalePrice,
          retailPrice: retail,
          currency: p.currency,
          syncedAt: new Date(),
        };
        const existing = await tx.plan.findUnique({
          where: {
            provider_supplierPlanId: {
              provider: providerName,
              supplierPlanId: p.id,
            },
          },
        });
        const unsafe =
          existing?.retailOverride != null &&
          existing.retailOverride <
            p.wholesalePrice + pricingConfig().minMargin;
        await tx.plan.upsert({
          where: {
            provider_supplierPlanId: {
              provider: providerName,
              supplierPlanId: p.id,
            },
          },
          create: { ...data, provider: providerName, supplierPlanId: p.id },
          update: { ...data, ...(unsafe ? { active: false } : {}) },
        });
        if (unsafe)
          await tx.auditLog.create({
            data: {
              action: "PLAN_MARGIN_REVIEW_REQUIRED",
              detail: existing.id,
            },
          });
      }
      const deactivated = await tx.plan.updateMany({
        where: {
          destinationId: destination.id,
          provider: providerName,
          active: true,
          supplierPlanId: { notIn: plans.map((p) => p.id) },
        },
        data: { active: false },
      });
      deactivatedPlans += deactivated.count;
    });
  }
  return {
    destinations: destinations.filter((d) => allowed.has(d.code)).length,
    plans: importedPlans,
    deactivatedPlans,
  };
}
