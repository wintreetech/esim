import { z } from "zod";
export const destinationSchema = z.object({
  code: z.string().min(2),
  name: z.string(),
  slug: z.string(),
  region: z.string(),
  flagEmoji: z.string(),
  imageUrl: z.string().min(1),
  description: z.string(),
});
export const providerPlanSchema = z.object({
  id: z.string(),
  destinationCode: z.string(),
  name: z.string(),
  dataAmountMB: z.number().int().positive(),
  dataLabel: z.string(),
  validityDays: z.number().int().positive(),
  network: z.string().nullable(),
  speed: z.string().nullable(),
  coverage: z.array(z.string()),
  supports5G: z.boolean().nullable(),
  supportsHotspot: z.boolean().nullable(),
  supportsTopup: z.boolean(),
  wholesalePrice: z.number().int().nonnegative(),
  currency: z.literal("USD"),
});
export const providerOrderSchema = z.object({
  orderId: z.string(),
  esimId: z.string(),
  iccid: z.string(),
  activationCode: z.string().nullable(),
  qrCodeData: z.string().nullable(),
  qrCodeUrl: z.url().nullable(),
  activationUrl: z.url().nullable(),
  smdpAddress: z.string().nullable(),
  status: z.enum(["READY", "PENDING"]),
  expiresAt: z.string().datetime().nullable(),
  testMode: z.boolean(),
  clientId: z.string().optional(),
  packageCode: z.string().optional(),
});
export const usageSchema = z.object({
  dataTotalMb: z.number().finite().nonnegative(),
  dataUsedMb: z.number().finite().nonnegative().nullable(),
  status: z.string(),
  expiresAt: z.string().datetime().nullable(),
});
export const topupResultSchema = z.object({
  id: z.string(),
  status: z.enum(["COMPLETED", "PENDING"]),
});
export type ProviderDestination = z.infer<typeof destinationSchema>;
export type EsimPlan = z.infer<typeof providerPlanSchema>;
export type ProviderOrder = z.infer<typeof providerOrderSchema>;
export type CreateEsimOrderResult = ProviderOrder;
export type EsimUsage = z.infer<typeof usageSchema>;
export type CreateEsimOrderInput = {
  supplierPlanId: string;
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  clientId?: string;
};
export type TopUpInput = {
  esimId: string;
  supplierPlanId: string;
  reference: string;
};
export type TopUpResult = z.infer<typeof topupResultSchema>;
export interface EsimProvider {
  readonly supportsIdempotentOrders: boolean;
  prepareOrder?(input: CreateEsimOrderInput): Promise<{ clientId: string }>;
  getDestinations(): Promise<ProviderDestination[]>;
  getPlans(destinationCode: string): Promise<EsimPlan[]>;
  createOrder(input: CreateEsimOrderInput): Promise<CreateEsimOrderResult>;
  getOrder(orderId: string): Promise<ProviderOrder>;
  getUsage(esimId: string): Promise<EsimUsage>;
  topUp(input: TopUpInput): Promise<TopUpResult>;
}
export class ProviderError extends Error {
  constructor(
    public code: string,
    public retryable = true,
    public outcomeUnknown = false,
  ) {
    super("The eSIM provider could not complete this request.");
  }
}
