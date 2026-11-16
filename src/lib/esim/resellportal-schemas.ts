import { z } from "zod";

export const supplierId = z
  .union([z.number().int().positive(), z.string().min(1).max(150)])
  .transform(String);
export const resellPortalPackageSchema = z.object({
  package_code: z.string().min(1).max(150),
  name: z.string().min(1),
  price: z.number().finite().nonnegative(),
  description: z.string().optional(),
  location: z.string().min(1),
  data_volume: z.string().min(1),
  duration: z.string().min(1),
  speed: z.string().nullish(),
});
export const resellPortalCatalogSchema = z.object({
  success: z.literal(true),
  total_packages: z.number().int().nonnegative(),
  packages: z.array(resellPortalPackageSchema),
});
export const resellPortalClientsSchema = z.object({
  success: z.literal(true),
  clients: z.array(
    z.object({ id: supplierId, name: z.string(), email: z.email() }),
  ),
});
export const resellPortalClientCreatedSchema = z.object({
  success: z.literal(true),
  client_id: supplierId,
});
export const resellPortalEsimDetailsSchema = z.object({
  qr_code_url: z.url().nullish(),
  activation_url: z.url().nullish(),
  iccid: z.string().nullish(),
  esim_status: z.string().nullish(),
});
export const resellPortalOrderSchema = z.object({
  success: z.literal(true),
  service_id: supplierId,
  esim_details: resellPortalEsimDetailsSchema.nullish(),
  test_mode: z.boolean().optional(),
  would_charge: z.number().optional(),
});
export const resellPortalUsageSchema = z.object({
  success: z.literal(true),
  service_id: supplierId,
  usage: z.object({
    status: z.string(),
    esim_status: z.string(),
    total_bytes: z.number().int().nonnegative(),
    used_bytes: z.number().int().nonnegative(),
    expires_at: z
      .union([z.string().datetime({ offset: true }), z.literal("")])
      .nullish(),
  }),
});
export type ResellPortalPackage = z.infer<typeof resellPortalPackageSchema>;
