import { z } from "zod";

export const compatibilityMaxAge = 30 * 24 * 60 * 60 * 1000;
export const deviceCheckSchema = z.object({
  model: z.string().trim().min(2).max(120),
  esim: z.enum(["", "yes", "no", "unsure"]),
  unlocked: z.enum(["", "yes", "no", "unsure"]),
  checkedAt: z.iso.datetime(),
});
export type DeviceCheck = z.infer<typeof deviceCheckSchema>;
export const confirmedDeviceSchema = deviceCheckSchema
  .extend({
    esim: z.literal("yes"),
    unlocked: z.literal("yes"),
  })
  .refine((check) => {
    const age = Date.now() - Date.parse(check.checkedAt);
    return age >= -5 * 60 * 1000 && age <= compatibilityMaxAge;
  }, "Please check your device again before purchasing.");

export function deviceCheckStatus(check: unknown) {
  const parsed = deviceCheckSchema.safeParse(check);
  if (!parsed.success) return "incomplete";
  if (parsed.data.esim === "no" || parsed.data.unlocked === "no")
    return "blocked";
  return confirmedDeviceSchema.safeParse(parsed.data).success
    ? "ready"
    : "incomplete";
}
