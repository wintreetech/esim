// Unknown values retain the caller's safe default; only explicit yes/no or
// true/false values change settings that can charge a supplier wallet.
export function envBoolean(value: string | undefined, fallback = false) {
  switch (value?.trim().toLowerCase()) {
    case "yes":
    case "true":
      return true;
    case "no":
    case "false":
      return false;
    default:
      return fallback;
  }
}
