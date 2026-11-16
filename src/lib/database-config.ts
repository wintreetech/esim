import { rootCertificates } from "node:tls";
import type { PoolConfig } from "pg";
import { supabaseRootCa } from "./supabase-ca";

// Shared by the app and trusted CLIs, including the seed process.
export function databaseConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
  };
  let url: URL;
  try {
    url = new URL(connectionString);
    if (
      !/^(postgres|postgresql):$/.test(url.protocol) ||
      !url.hostname ||
      url.hash
    )
      throw new Error();
  } catch {
    // URL parser errors can include the entire URL, including its password.
    throw new Error(
      "Invalid DATABASE_URL. Copy the complete PostgreSQL URI and percent-encode the password.",
    );
  }
  const isSupabase =
    url.hostname.endsWith(".pooler.supabase.com") ||
    /^db\.[a-z0-9-]+\.supabase\.co$/.test(url.hostname);
  if (!isSupabase) return config;

  // Explicit client certificates/root-certificate files remain operator controlled.
  if (
    ["sslcert", "sslkey", "sslrootcert"].some((key) =>
      url.searchParams.has(key),
    )
  )
    return config;

  // node-postgres parses connectionString last. Its URL SSL settings would
  // overwrite the trusted CA object unless removed before creating the pool.
  for (const key of ["ssl", "sslmode", "uselibpqcompat"])
    url.searchParams.delete(key);
  return {
    ...config,
    connectionString: url.toString(),
    ssl: {
      ca: [...rootCertificates, supabaseRootCa],
      rejectUnauthorized: true,
    },
  };
}
