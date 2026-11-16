import "dotenv/config";
import { z } from "zod";
import { ResellPortalClient } from "../src/lib/esim/resellportal-client";
import { ResellPortalCatalog } from "../src/lib/esim/resellportal-catalog";
import {
  resellPortalConfigured,
  resellPortalTestMode,
} from "../src/lib/esim/config";
import { resellPortalClientsSchema } from "../src/lib/esim/resellportal-schemas";
import { ProviderError } from "../src/lib/esim/types";

async function main() {
  if (!resellPortalConfigured()) {
    console.error(
      "Add RESELLPORTAL_API_KEY and RESELLPORTAL_API_SECRET to .env first. Do not paste them into chat.",
    );
    process.exitCode = 1;
    return;
  }
  const client = new ResellPortalClient(),
    catalog = new ResellPortalCatalog(client);
  await client.get("/balance", z.unknown());
  const packages = await catalog.packages();
  const clients = await client.get("/clients", resellPortalClientsSchema);
  const destinations = await catalog.getDestinations();
  const counts = [];
  for (const d of destinations)
    counts.push({
      destination: d.name,
      packages: (await catalog.getPlans(d.code)).length,
    });
  console.log(
    JSON.stringify(
      {
        authenticated: true,
        mode: resellPortalTestMode() ? "test" : "live",
        walletChecked: true,
        totalSupplierPackages: packages.length,
        clientCount: clients.clients.length,
        launchCatalog: counts,
        mutationsPerformed: 0,
      },
      null,
      2,
    ),
  );
  const index = process.argv.indexOf("--service-id");
  if (index !== -1) {
    const id = process.argv[index + 1];
    if (!id || !/^(?:\d+|test_svc_[a-zA-Z0-9_-]+)$/.test(id))
      throw new Error("Supply a valid service ID.");
    const service = await client.get(
      `/services/${encodeURIComponent(id)}`,
      z.unknown(),
    );
    const paths: string[] = [],
      qrHosts = new Set<string>();
    const visit = (value: unknown, prefix = "", depth = 0): void => {
      if (depth > 5 || !value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        paths.push(`${prefix}: array(${value.length})`);
        return;
      }
      for (const [key, item] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(`${path}: ${item === null ? "null" : typeof item}`);
        visit(item, path, depth + 1);
      }
    };
    const hosts = (value: unknown, depth = 0): void => {
      if (depth > 5 || !value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (key === "qr_code_url" && typeof item === "string") {
          try {
            qrHosts.add(new URL(item).hostname);
          } catch {
            /* Not a valid image URL. */
          }
        } else hosts(item, depth + 1);
      }
    };
    visit(service);
    hosts(service);
    console.log(
      "Service response fields (values and credentials omitted):",
      JSON.stringify(paths, null, 2),
    );
    console.log("QR image hostnames:", JSON.stringify([...qrHosts]));
  }
}
main().catch((error) => {
  console.error(
    error instanceof ProviderError
      ? error.code
      : "Connection check failed. Review the configuration.",
  );
  process.exitCode = 1;
});
