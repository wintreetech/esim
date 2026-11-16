import "dotenv/config";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import pg from "pg";

const exec = promisify(execFile);
const root = process.cwd();
const localRoot = path.join(root, ".local");
const dataDir = path.join(localRoot, "postgres");
const port = 55432;

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.platform !== "win32" || process.env.NODE_ENV === "production")
    throw new Error("This helper is for a Windows local preview only.");

  const existing = process.env.DATABASE_URL?.trim();
  let password: string;
  if (existing) {
    const url = new URL(existing);
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== String(port) ||
      url.pathname !== "/roamly" ||
      url.username !== "roamly"
    )
      throw new Error(
        "DATABASE_URL already points elsewhere; it was preserved.",
      );
    password = decodeURIComponent(url.password);
  } else {
    if (await exists(path.join(dataDir, "PG_VERSION")))
      throw new Error(
        "Existing preview database found. Restore its DATABASE_URL from your private .env backup.",
      );
    password = randomBytes(24).toString("hex");
  }

  const installations = path.join(
    process.env.ProgramFiles || "C:\\Program Files",
    "PostgreSQL",
  );
  const versions = (await readdir(installations))
    .filter((v) => /^\d+$/.test(v))
    .sort((a, b) => Number(b) - Number(a));
  const initialized = await exists(path.join(dataDir, "PG_VERSION"));
  const version = initialized
    ? (await readFile(path.join(dataDir, "PG_VERSION"), "utf8")).trim()
    : versions[0];
  if (!version)
    throw new Error(
      "Install PostgreSQL for Windows, then run this command again.",
    );
  const bin = path.join(installations, version, "bin");
  if (!(await exists(path.join(bin, "pg_ctl.exe"))))
    throw new Error(
      "The PostgreSQL binaries for this preview database are missing.",
    );

  await mkdir(localRoot, { recursive: true });
  if (!initialized) {
    console.log("Creating the local preview cluster.");
    const passwordFile = path.join(localRoot, "init-password.tmp");
    try {
      await writeFile(passwordFile, password, { flag: "wx" });
      await exec(
        path.join(bin, "initdb.exe"),
        [
          "-D",
          dataDir,
          "-U",
          "roamly",
          "--pwfile",
          passwordFile,
          "--auth",
          "scram-sha-256",
          "--encoding",
          "UTF8",
          "--locale",
          "C",
        ],
        { windowsHide: true },
      );
    } finally {
      await rm(passwordFile, { force: true });
    }
    const url = `postgresql://roamly:${password}@127.0.0.1:${port}/roamly?sslmode=disable`;
    const envFile = path.join(root, ".env");
    const content = await readFile(envFile, "utf8");
    await writeFile(
      envFile,
      /^DATABASE_URL=/m.test(content)
        ? content.replace(
            /^DATABASE_URL=[^\r\n]*/m,
            () => `DATABASE_URL=${url}`,
          )
        : `${content}\nDATABASE_URL=${url}\n`,
    );
  }

  let running = false;
  console.log("Checking the local preview server.");
  try {
    await exec(path.join(bin, "pg_ctl.exe"), ["status", "-D", dataDir], {
      windowsHide: true,
    });
    running = true;
  } catch {
    // Only start this project's cluster; installed database services are untouched.
  }
  if (!running) {
    console.log("Starting the local preview server.");
    await exec(
      path.join(bin, "pg_ctl.exe"),
      [
        "start",
        "-D",
        dataDir,
        "-l",
        path.join(localRoot, "postgres.log"),
        "-o",
        `-h 127.0.0.1 -p ${port}`,
        "-w",
      ],
      { windowsHide: true },
    );
  }

  console.log("Preparing the preview database.");
  const client = new pg.Client({
    host: "127.0.0.1",
    port,
    user: "roamly",
    password,
    database: "postgres",
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["roamly"],
    );
    if (!result.rowCount) await client.query('CREATE DATABASE "roamly"');
  } finally {
    await client.end();
  }
  console.log(
    "Local preview PostgreSQL is ready on 127.0.0.1:55432. DATABASE_URL is saved privately in .env.",
  );
  console.log(
    "Next: npm run db:deploy, npm run db:seed, npm run db:sync, then npm run dev.",
  );
}

main().catch((error: unknown) => {
  if (error && typeof error === "object" && "code" in error)
    console.error("Database setup error code:", String(error.code));
  console.error(
    "Local preview database setup failed. Your other PostgreSQL services were not modified. Check the local PostgreSQL installation and .local/postgres.log.",
  );
  process.exitCode = 1;
});
