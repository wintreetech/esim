import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import type { ConnectionOptions } from "node:tls";
import pg from "pg";
import { databaseConfig } from "@/lib/database-config";
import { supabaseRootCa } from "@/lib/supabase-ca";

function parsedConfig(url: string) {
  const client = new pg.Client(databaseConfig(url));
  return (
    client as unknown as {
      connectionParameters: {
        ssl: ConnectionOptions | false;
        password: string;
        host: string;
        port: number;
      };
    }
  ).connectionParameters;
}

describe("database TLS configuration", () => {
  it.each([5432, 6543])(
    "keeps Supabase certificate verification and CA trust after pg parses port %s",
    (port) => {
      const config = parsedConfig(
        `postgresql://postgres.project:example%40%23@aws-1-ap-northeast-2.pooler.supabase.com:${port}/postgres?sslmode=require`,
      );
      expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
      expect((config.ssl as ConnectionOptions).ca).toContain(supabaseRootCa);
      expect(
        (config.ssl as ConnectionOptions).checkServerIdentity,
      ).toBeUndefined();
      expect(config.password).toBe("example@#");
      expect(config.port).toBe(port);
    },
  );

  it("also trusts the certificate for a direct Supabase hostname", () => {
    expect(
      databaseConfig(
        "postgresql://postgres:example@db.project.supabase.co/postgres",
      ).ssl,
    ).toMatchObject({ rejectUnauthorized: true });
  });

  it("never allows URL flags to disable Supabase verification", () => {
    const config = parsedConfig(
      "postgresql://postgres:example@aws-1-ap-northeast-2.pooler.supabase.com/postgres?sslmode=no-verify&ssl=false&uselibpqcompat=true&application_name=roamly",
    );
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
    const url = new URL(
      databaseConfig(
        "postgresql://postgres:example@aws-1-ap-northeast-2.pooler.supabase.com/postgres?sslmode=require&application_name=roamly",
      ).connectionString!,
    );
    expect(url.searchParams.get("application_name")).toBe("roamly");
    expect(url.searchParams.has("sslmode")).toBe(false);
  });

  it("preserves local PostgreSQL SSL configuration", () => {
    const url =
      "postgresql://roamly:example@127.0.0.1:55432/roamly?sslmode=disable";
    expect(databaseConfig(url).connectionString).toBe(url);
    expect(parsedConfig(url).ssl).toBe(false);
  });

  it.each([
    "db.example.com",
    "supabase.com.example.com",
    "aws.pooler.supabase.com.example.com",
  ])("does not add Supabase trust for %s", (host) => {
    expect(
      databaseConfig(`postgresql://user:example@${host}/db?sslmode=verify-full`)
        .ssl,
    ).toBeUndefined();
  });

  it("preserves explicit certificate file configuration", () => {
    const url =
      "postgresql://postgres:example@db.project.supabase.co/postgres?sslmode=verify-full&sslrootcert=custom-ca.crt";
    expect(databaseConfig(url)).toMatchObject({ connectionString: url });
    expect(databaseConfig(url).ssl).toBeUndefined();
  });

  it("reports malformed URLs without leaking credentials", () => {
    expect(() =>
      databaseConfig("postgresql://user:private@#@db.example.com/db"),
    ).toThrow(
      "Invalid DATABASE_URL. Copy the complete PostgreSQL URI and percent-encode the password.",
    );
  });

  it("bundles the expected Supabase public root certificate", () => {
    const cert = new X509Certificate(supabaseRootCa);
    expect(cert.ca).toBe(true);
    expect(cert.fingerprint256).toBe(
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
    );
  });
});
