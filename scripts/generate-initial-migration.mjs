import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const folder = "prisma/migrations/20261030000000_initial";
mkdirSync(folder, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) throw new Error(result.stderr);
const tables = [
  "User",
  "Destination",
  "Plan",
  "Order",
  "OrderItem",
  "Esim",
  "Payment",
  "SupplierOrder",
  "TopUp",
  "Coupon",
  "Device",
  "AuditLog",
  "WebhookEvent",
  "PaymentReversal",
  "FulfillmentJob",
  "RateLimit",
];
writeFileSync(
  `${folder}/migration.sql`,
  `${result.stdout}\n-- Supabase/PostgREST must not expose credentials, costs, orders or activation data.\n-- The application uses its server-only database owner connection, bypassing RLS.\n${tables.map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join("\n")}\n`,
);
writeFileSync(
  "prisma/migrations/migration_lock.toml",
  'provider = "postgresql"\n',
);
