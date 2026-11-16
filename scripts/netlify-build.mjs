import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this script with npm run build:netlify.");
  process.exit(1);
}
const production = process.env.CONTEXT === "production";
if (production) {
  const required = [
    "DATABASE_URL",
    "DIRECT_DATABASE_URL",
    "RESELLPORTAL_API_KEY",
    "RESELLPORTAL_API_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    console.error(
      `Missing production environment variables: ${missing.join(", ")}.`,
    );
    console.error(
      "Set production values in Netlify, including build and function scopes, then redeploy.",
    );
    process.exit(1);
  }
}

// Only the production branch initializes inventory. Deploy Previews never run
// migrations or alter catalog records in a shared production database.
const steps = production
  ? ["db:deploy", "db:seed", "db:sync", "build"]
  : ["build"];
for (const step of steps) {
  console.log(`Netlify build: ${step}`);
  const result = spawnSync(process.execPath, [npmCli, "run", step], {
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(`Netlify build stopped at ${step}.`);
    process.exit(result.status || 1);
  }
}
