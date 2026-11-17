import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      STRIPE_SECRET_KEY: "",
      RESEND_API_KEY: "",
      RESELLPORTAL_API_KEY: "",
      RESELLPORTAL_API_SECRET: "",
    },
  },
  reporter: "list",
});
