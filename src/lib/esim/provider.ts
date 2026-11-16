import "server-only";
import { ResellPortalProvider } from "./resellportal-provider";
import { providerName, RESELLPORTAL_PROVIDER } from "./config";
import { ProviderError, type EsimProvider } from "./types";
export function getProvider(name = providerName()): EsimProvider {
  if (name === RESELLPORTAL_PROVIDER) return new ResellPortalProvider();
  throw new ProviderError("LEGACY_PROVIDER_DISABLED", false);
}
