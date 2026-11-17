import "server-only";
import { db } from "./db";
import { destinationSeeds } from "./data/destinations";
import { calculatePrice, pricingConfig } from "./pricing/calculate-price";
import { providerName } from "./esim/config";
export type PublicPlan = {
  id: string;
  name: string;
  dataAmountMB: number;
  dataLabel: string;
  validityDays: number;
  network: string | null;
  speed: string | null;
  coverage: string[];
  supports5G: boolean | null;
  supportsHotspot: boolean | null;
  supportsTopup: boolean;
  retailPrice: number;
  destinationSlug: string;
  destinationName: string;
  flagEmoji: string;
};
export type PublicDestination = {
  id: string;
  name: string;
  slug: string;
  isoCode: string;
  region: string;
  flagEmoji: string;
  imageUrl: string;
  description: string;
  plans: PublicPlan[];
};
export async function getCatalog(): Promise<PublicDestination[]> {
  if (!process.env.DATABASE_URL)
    return destinationSeeds.map((d) => ({
      ...d,
      id: d.slug,
      plans: [],
    }));
  const destinations = await db().destination.findMany({
    where: { active: true },
    include: {
      plans: {
        where: { active: true, provider: providerName() },
        orderBy: { dataAmountMB: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return destinations.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    isoCode: d.isoCode,
    region: d.region,
    flagEmoji: d.flagEmoji,
    imageUrl: d.imageUrl,
    description: d.description,
    plans: d.plans.map((p) => ({
      id: p.id,
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
      retailPrice: calculatePrice({
        wholesale: p.wholesalePrice,
        retailOverride: p.retailOverride ?? p.retailPrice,
        ...pricingConfig(),
      }).total,
      destinationSlug: d.slug,
      destinationName: d.name,
      flagEmoji: d.flagEmoji,
    })),
  }));
}
export async function catalogContext() {
  return {
    destinations: await getCatalog(),
  };
}
