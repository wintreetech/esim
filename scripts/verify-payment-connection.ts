import "dotenv/config";
import { createGatewayTokenManager } from "../src/lib/payments/transactworld-token";
import { requireTransactworldConfig } from "../src/lib/payments/transactworld-config";

// Authentication only. Never call Checkout, payments, orders or supplier APIs.
// A canonical URL is supplied only for constructing the configuration object;
// this command does not validate or change the deployed callback configuration.
if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"))
  process.env.NEXT_PUBLIC_APP_URL = "https://roamly11.netlify.app";
let providerCode: string | undefined, httpStatus: number | undefined;
let responseFields: string[] = [],
  responseFormat = "unknown";
const hints: string[] = [];
const manager = createGatewayTokenManager(async (input, init) => {
  const response = await fetch(input, init);
  httpStatus = response.status;
  responseFormat = response.headers.get("content-type")?.includes("json")
    ? "JSON"
    : "non-JSON";
  try {
    const body = await response.clone().json();
    const candidate = String(body?.result?.code ?? "");
    if (/^[A-Za-z0-9._-]{1,32}$/.test(candidate)) providerCode = candidate;
    responseFields = Object.keys(body || {})
      .filter((key) => /^[A-Za-z_.-]{1,40}$/.test(key))
      .slice(0, 15);
    const text = JSON.stringify(body).toLowerCase();
    for (const [pattern, hint] of [
      [
        "username",
        "Provider mentions merchant username; check TW_MERCHANT_USERNAME.",
      ],
      ["partnerid", "Provider mentions partner ID; check TW_PARTNER_ID."],
      [
        "invalid",
        "Provider reports an invalid authentication request or credentials.",
      ],
      ["required", "Provider reports a required authentication field."],
    ])
      if (text.includes(pattern)) hints.push(hint);
  } catch {}
  return response;
});
try {
  const c = requireTransactworldConfig();
  console.log(
    `Checking ${c.environment} merchant authentication only. No payment or eSIM purchase will be submitted.`,
  );
  await manager({ ...c, authToken: "" });
  console.log(
    "Merchant authentication: successful. The token was not printed or stored.",
  );
  console.log(
    "Checkout callbacks, approved currencies and email delivery still require separate acceptance checks.",
  );
} catch {
  console.log("Merchant authentication: not verified.");
  if (httpStatus) console.log(`Provider HTTP status: ${httpStatus}`);
  if (providerCode) console.log(`Provider result code: ${providerCode}`);
  console.log(
    `Provider response format: ${responseFormat}; fields: ${responseFields.join(", ") || "none parsed"}`,
  );
  hints.forEach((hint) => console.log(hint));
  console.log(
    "Check the member ID, working key, environment and any required merchant username/partner ID. No payment was submitted.",
  );
  process.exitCode = 1;
}
