import "dotenv/config";
import { envBoolean } from "../src/lib/env-boolean";
import { requireTransactworldConfig } from "../src/lib/payments/transactworld-config";
import {
  requireCheckoutSetup,
  checkoutSetupIssues,
} from "../src/lib/payments/config";
import {
  resellPortalTestMode,
  resellPortalLiveOrdersAllowed,
} from "../src/lib/esim/config";

console.log(
  "Read-only payment configuration check. No gateway, supplier or email request is made.",
);
console.log(
  "Payments enabled:",
  envBoolean(process.env.PAYMENTS_ENABLED) ? "yes" : "no",
);
console.log("Supplier test mode:", resellPortalTestMode() ? "yes" : "no");
console.log(
  "Gateway environment:",
  process.env.TW_ENVIRONMENT === "live"
    ? "live"
    : "sandbox (or not yet configured)",
);
console.log(
  "Live supplier orders allowed:",
  resellPortalLiveOrdersAllowed() ? "yes" : "no",
);
console.log("All checkout blockers:");
const issues = checkoutSetupIssues();
if (!issues.length)
  console.log(
    "None detected in environment configuration; verify the gateway account and public callbacks before sales.",
  );
issues.forEach((issue) => console.log(`- ${issue.code}: ${issue.message}`));
for (const key of [
  "MEMBER_ID",
  "WORKING_KEY",
  "RESEND_API_KEY",
  "ORDER_ACCESS_SECRET",
  "CRON_SECRET",
])
  console.log(`${key}: ${process.env[key]?.trim() ? "configured" : "missing"}`);
console.log(
  "EMAIL_FROM:",
  !process.env.EMAIL_FROM ||
    process.env.EMAIL_FROM.includes("your-verified-domain.com")
    ? "needs a verified sender"
    : "configured (verify domain in Resend)",
);
try {
  const c = requireTransactworldConfig();
  console.log("Gateway environment:", c.environment);
  console.log(
    "Approved checkout currencies:",
    c.supportedCurrencies.join(", "),
  );
  console.log(
    "Payment/supplier modes match:",
    (c.environment === "sandbox") === resellPortalTestMode() ? "yes" : "no",
  );
} catch (error) {
  console.log(
    "Gateway setup:",
    error instanceof Error ? error.message : "incomplete",
  );
}
try {
  requireCheckoutSetup();
  console.log("Checkout ready for configured mode: yes");
} catch {
  console.log(
    "Checkout ready for configured mode: no. Complete the settings above before enabling payments.",
  );
}
