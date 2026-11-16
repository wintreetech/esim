import "server-only";
import { createHash } from "node:crypto";
import { destinationSeeds } from "@/lib/data/destinations";
const bases = [350, 500, 400, 300, 350, 300, 350, 450, 400, 550];
const planSizes = [
  { mb: 1024, label: "1 GB", days: 7, multiplier: 1 },
  { mb: 3072, label: "3 GB", days: 15, multiplier: 2.2 },
  { mb: 5120, label: "5 GB", days: 30, multiplier: 3.1 },
  { mb: 10240, label: "10 GB", days: 30, multiplier: 5.2 },
];
import {
  ProviderError,
  type EsimProvider,
  type CreateEsimOrderInput,
  type TopUpInput,
  type ProviderOrder,
} from "@/lib/esim/types";
export class MockEsimProvider implements EsimProvider {
  get supportsIdempotentOrders() {
    return true;
  }
  async getDestinations() {
    return destinationSeeds.map((d) => ({
      code: d.isoCode,
      name: d.name,
      slug: d.slug,
      region: d.region,
      flagEmoji: d.flagEmoji,
      imageUrl: d.imageUrl,
      description: d.description,
    }));
  }
  async getPlans(code: string) {
    const d = destinationSeeds.find((d) => d.isoCode === code);
    if (!d) return [];
    return planSizes.map((s) => ({
      id: `mock-${code}-${s.mb}`,
      destinationCode: code,
      name: `${s.label} / ${s.days} days`,
      dataAmountMB: s.mb,
      dataLabel: s.label,
      validityDays: s.days,
      network: "Test network",
      speed: "4G / 5G",
      coverage: [code],
      supports5G: true,
      supportsHotspot: true,
      supportsTopup: true,
      wholesalePrice: Math.round(
        bases[destinationSeeds.indexOf(d)] * s.multiplier,
      ),
      currency: "USD" as const,
    }));
  }
  async createOrder(input: CreateEsimOrderInput): Promise<ProviderOrder> {
    const parts = input.supplierPlanId.split("-");
    const plans = await this.getPlans(parts[1]);
    if (!plans.some((p) => p.id === input.supplierPlanId))
      throw new ProviderError("INVALID_PLAN", false);
    return this.getOrder(input.reference);
  }
  async getOrder(id: string): Promise<ProviderOrder> {
    const hash = createHash("sha256").update(id).digest("hex");
    const activationCode = `MOCK-NOT-A-REAL-ESIM-${hash.slice(0, 16)}`;
    return {
      orderId: id,
      esimId: `mock_${hash.slice(0, 24)}`,
      iccid: `890000${BigInt(`0x${hash.slice(0, 11)}`)
        .toString()
        .padStart(14, "0")
        .slice(0, 14)}`,
      activationCode,
      qrCodeData: `LPA:1$mock.invalid$${activationCode}`,
      qrCodeUrl: null,
      activationUrl: null,
      testMode: true,
      smdpAddress: "mock.invalid",
      status: "READY",
      expiresAt: null,
    };
  }
  async getUsage() {
    return {
      dataTotalMb: 0,
      dataUsedMb: null,
      status: "MOCK_NO_CONNECTIVITY",
      expiresAt: null,
    };
  }
  async topUp(input: TopUpInput) {
    return {
      id: `mock_topup_${createHash("sha256").update(input.reference).digest("hex").slice(0, 20)}`,
      status: "COMPLETED" as const,
    };
  }
}
