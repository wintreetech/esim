export function confirmedDevice() {
  return {
    model: "iPhone 13 Pro",
    esim: "yes" as const,
    unlocked: "yes" as const,
    checkedAt: new Date().toISOString(),
  };
}
