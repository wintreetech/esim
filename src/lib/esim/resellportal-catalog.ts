import "server-only";
import { destinationSeeds } from "@/lib/data/destinations";
import { ProviderError, type EsimPlan } from "./types";
import { ResellPortalClient } from "./resellportal-client";
import {
  resellPortalCatalogSchema,
  type ResellPortalPackage,
} from "./resellportal-schemas";

export function normalizePackage(
  p: ResellPortalPackage,
): Omit<EsimPlan, "destinationCode"> | null {
  // Daily/FUP bundles must not be misrepresented as a fixed total allowance.
  if (/FUP|daily|\/\s*day|per\s+day/i.test(`${p.name} ${p.data_volume}`))
    return null;
  const data = p.data_volume.trim().match(/^(\d+(?:\.\d+)?)\s*(MB|GB|TB)$/i);
  const days = p.duration.trim().match(/^(\d+)\s*days?$/i);
  if (!data || !days) return null;
  const mb =
    Number(data[1]) *
    ({ MB: 1, GB: 1024, TB: 1024 * 1024 }[data[2].toUpperCase()] || 0);
  const price = Math.round(p.price * 100);
  if (
    !Number.isSafeInteger(mb) ||
    mb <= 0 ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    Number(days[1]) <= 0
  )
    return null;
  return {
    id: p.package_code,
    name: p.name,
    dataAmountMB: mb,
    dataLabel: p.data_volume,
    validityDays: Number(days[1]),
    network: null,
    speed: p.speed || null,
    coverage: p.location
      .split(/[,;]/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
    supports5G: p.speed ? /\b5G\b/i.test(p.speed) : null,
    supportsHotspot: null,
    // No eSIM top-up endpoint is documented for this integration.
    supportsTopup: false,
    wholesalePrice: price,
    currency: "USD",
  };
}

export class ResellPortalCatalog {
  private catalog?: Promise<ResellPortalPackage[]>;
  constructor(private readonly client = new ResellPortalClient()) {}

  packages() {
    return (this.catalog ??= this.client
      .get("/esim-packages", resellPortalCatalogSchema)
      .then((result) => {
        // The documented endpoint returns all packages when location is omitted. If the
        // provider starts paginating, fail safely rather than delete unseen inventory.
        if (result.total_packages !== result.packages.length)
          throw new ProviderError("RESELLPORTAL_CATALOG_INCOMPLETE", false);
        if (
          new Set(result.packages.map((p) => p.package_code)).size !==
          result.packages.length
        )
          throw new ProviderError(
            "RESELLPORTAL_DUPLICATE_PACKAGE_CODES",
            false,
          );
        return result.packages;
      }));
  }

  async getDestinations() {
    await this.packages();
    return destinationSeeds.map(({ isoCode, ...d }) => ({
      ...d,
      code: isoCode,
    }));
  }

  async getPlans(destinationCode: string): Promise<EsimPlan[]> {
    const packages = await this.packages();
    return packages.flatMap((p) => {
      const matches =
        destinationCode === "EU"
          ? /^Europe\b/i.test(p.name)
          : p.location.trim().toUpperCase() === destinationCode;
      if (!matches) return [];
      const plan = normalizePackage(p);
      return plan ? [{ ...plan, destinationCode }] : [];
    });
  }
}
