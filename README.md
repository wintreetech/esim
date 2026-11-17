# Roamly + ResellPortal

A Next.js App Router travel eSIM storefront with PostgreSQL/Prisma, Supabase Auth, TransactWorld hosted checkout and Resend. **ResellPortal is the runtime supplier.** There is no dummy catalog, mock-provider runtime branch, invented QR code, or seeded sample price. The ten launch destinations retain their original editorial content; plans and prices appear only after a successful authenticated supplier sync.

## What to configure

A gitignored `.env` has been prepared locally. Fill in the blank credentials there; never paste API secrets or passwords into chat. `.env.example` documents every setting. Restart the development server after changing environment variables.

For a client preview on Windows with PostgreSQL installed, run `npm run db:local`. It creates a separate password-protected PostgreSQL cluster in the ignored `.local/postgres` folder, listens only on `127.0.0.1:55432`, and fills the blank `DATABASE_URL` in `.env`. Existing PostgreSQL services and other databases are untouched. Then run `npm run db:deploy`, `npm run db:seed`, and `npm run db:sync`, and restart `npm run dev`. Run `npm run db:local` again after restarting your computer to start the preview database. This local URL works on this computer; deployment needs a hosted PostgreSQL URL in the hosting environment.

| Setting                                                     | Needed for                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESELLPORTAL_API_KEY`, `RESELLPORTAL_API_SECRET`           | ResellPortal Tools > API Access; normal credentials work with test mode. No separate sandbox account is required.                                      |
| `RESELLPORTAL_BASE_URL`                                     | Already set to `https://panel.resellportal.com/wp-json/resellportal/v1`. The dashboard and MCP URLs are not the REST API base URL.                     |
| `DATABASE_URL`                                              | PostgreSQL connection, such as Supabase or Neon. Use a server-only pooled connection in production.                                                    |
| `DIRECT_DATABASE_URL`                                       | Optional direct connection for Prisma migrations when the application uses a transaction pooler.                                                       |
| `MEMBER_ID`, `WORKING_KEY`, `TW_ENVIRONMENT`                | TransactWorld merchant ID, signing key and `sandbox` or `live` environment. The hosted checkout contract is adapted from LexiHive.                     |
| `PAYMENTS_ENABLED`, `TW_SUPPORTED_CURRENCIES`               | Set `yes` only after configuration; list currencies approved for this merchant. Display currencies do not imply payment approval.                      |
| `TW_MERCHANT_USERNAME`, `TW_PARTNER_ID`, `TW_AUTH_TOKEN`    | Merchant authentication identity where required; optional short-lived Inquiry token override. Tokens normally refresh automatically.                   |
| `RESEND_API_KEY`, `EMAIL_FROM`                              | Send Roamly installation emails from a verified domain.                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Customer and admin email-link sign-in. Guest checkout also works.                                                                                      |
| `NEXT_PUBLIC_APP_URL`                                       | Local origin, then the final HTTPS domain; also used for CSRF, payment redirects and private order links.                                              |
| `ADMIN_EMAIL`                                               | Support contact and the exact verified account to promote to ADMIN.                                                                                    |
| `ORDER_ACCESS_SECRET`, `CRON_SECRET`                        | Random signing/worker secrets. The local file has been populated where these were blank; values are not logged.                                        |
| `RESELLPORTAL_QR_ALLOWED_HOSTS`                             | Exact hostname(s) used by the provider's QR images. Defaults to `panel.resellportal.com`; add the real carrier image hostname before live fulfillment. |

`PAYMENT_PROVIDER=transactworld` selects the current gateway. The old payment adapter and webhook remain for legacy orders; new TransactWorld checkouts need no Stripe keys. `SUPABASE_SERVICE_ROLE_KEY` is reserved and unused. Never put provider, database, payment, email, or signing secrets in a `NEXT_PUBLIC_*` variable.

## Test mode and live orders

Default local settings:

```dotenv
ESIM_PROVIDER=resellportal
PAYMENT_PROVIDER=transactworld
PAYMENTS_ENABLED=no
TW_ENVIRONMENT=sandbox
RESELLPORTAL_TEST_MODE=yes
RESELLPORTAL_ALLOW_LIVE_ORDERS=no
```

Every supplier mutation sends `test_mode` explicitly and uses `X-RP-Test-Mode: 1` in test mode. Every order suppresses the supplier's welcome email with `skip_client_email: true`; client creation also requests `send_setup_email: false`. Roamly delivers its own installation email. Returned portal passwords are discarded, not stored or shown.

Test mode authenticates and validates through the real API but creates no real service or wallet charge. It cannot provide cellular data. Test emails and account pages are labeled and do not send a pretend installable QR code. Read endpoints always use actual authenticated catalog/client/service data.

Boolean settings accept `yes`/`no` and existing `true`/`false` spellings, ignoring case and outer whitespace. Missing or misspelled test-mode values keep test mode enabled; missing or misspelled opt-ins keep payments/live purchases disabled. Live wallet purchases require **both** `RESELLPORTAL_TEST_MODE=no` and `RESELLPORTAL_ALLOW_LIVE_ORDERS=yes`. Payment and supplier modes must match: sandbox payments use supplier test mode; live payments use real eSIMs. Orders retain their supplier mode and separate sandbox/live payment references, so changing settings cannot turn an old test order into a live purchase. A real installation test requires a separately authorized live purchase.

No live supplier order was placed during implementation. Before switching to live, complete authenticated test-mode acceptance, set up QR image hosts, review prices/tax/legal policies, and explicitly authorize any real test purchase. The wallet needs enough balance for the selected package's wholesale price; test-mode validation does not require funding.

## Install and connect

Prerequisites: Node.js 22.12+ (Node 24 recommended), npm, PostgreSQL, a ResellPortal account with API Access, TransactWorld, Resend and Supabase Auth.

```powershell
npm ci
# Fill .env. If it does not exist:
# Copy-Item .env.example .env
npm run db:deploy
npm run db:seed
npm run resellportal:check
npm run db:sync
npm run dev
```

Open http://localhost:3000. Without database configuration the site shows destination content with zero plans and no prices or Buy buttons. A configured but unavailable database produces an error instead of silently displaying fabricated inventory.

For an optional local PostgreSQL server, run `docker compose up -d` with Docker Desktop running and set `DATABASE_URL=postgresql://roamly:roamly@localhost:5432/roamly` in `.env`.

`db:deploy` applies committed migrations. The new integration migration deactivates legacy `mock`/`supplier` plans and preserves historical orders, payments and eSIMs. `db:seed` upserts destination/device content only; it never creates plans, wholesale costs, retail prices, users or coupons. `db:sync` imports the authenticated ResellPortal catalog and derives retail prices server-side. Use `npm run db:migrate -- --name change_name` for future schema changes.

### Netlify with Supabase PostgreSQL

Set `DATABASE_URL` to the complete Supabase transaction-pooler URI (port 6543), and `DIRECT_DATABASE_URL` to the session-pooler URI (port 5432). Replace the password placeholder with your percent-encoded database password. In Netlify, the Value field contains only the URI, without the variable name or surrounding quotes. Make both variables available to the production build and functions. Set `NODE_VERSION=24` and `NEXT_PUBLIC_APP_URL` to the final HTTPS site URL.

The app, seed CLI and admin promotion CLI share `src/lib/database-config.ts`. For Supabase hosts, it adds the bundled public Supabase Root 2021 CA to Node's trusted roots and retains certificate and hostname verification. This fixes `P1011: self-signed certificate in certificate chain` on hosts whose default trust store does not contain Supabase's root. URL SSL options are normalized before constructing the pg pool so they cannot overwrite the configured trust store. Other database providers and local PostgreSQL retain their own connection settings. Explicit certificate-file URL settings are preserved. The public CA expires on 26 April 2031; its download source and fingerprint are recorded in `src/lib/supabase-ca.ts`.

The committed `netlify.toml` sets the root directory, publish directory `.next`, Node 24, build command `npm run build:netlify`, and the explicit `@netlify/plugin-nextjs` adapter. The adapter is pinned to the tested version 5.16.7 in `package.json`/`package-lock.json`; update and validate it deliberately when upgrading Next.js. It packages the SSR handler, API routes and public assets. A Next.js `.next` directory requires this server runtime to serve dynamic pages. Keep Netlify's automatic build processing enabled.

`build:netlify` verifies the required database/supplier environment variables and runs migrations, content seeding, the real catalog import and the Next.js build for the production context. Deploy Previews and other contexts run the build only, preserving a shared production catalog. The file configuration overrides dashboard build values, so no one-off initialization command or later reset is needed. Environment changes still require a new deployment. These commands do not place supplier orders. Keep `RESELLPORTAL_TEST_MODE=true` and `RESELLPORTAL_ALLOW_LIVE_ORDERS=false` during preview acceptance.

After pushing the configuration and lockfile, trigger a production deploy with the build cache cleared. Confirm the deploy log applies `@netlify/plugin-nextjs` and packages `___netlify-server-handler`. If a deployment is marked Published but every route returns Netlify's generic 404 page, inspect the runtime packaging and effective publish directory before changing database credentials. Public assets should be copied into the adapter's static output and dynamic routes handled by the generated function.

Netlify does not execute `vercel.json` cron definitions. Native functions in `netlify/functions` schedule payment recovery and fulfillment every minute and catalog refresh every six hours. They run only for the published production deploy, using runtime `context.deploy` metadata, and authenticate with Functions-scoped `CRON_SECRET`. Authenticated `?background=1` requests return 202 and use Next.js `after()`, keeping the scheduler invocation below its 30-second limit. Verify all three Scheduled badges and worker logs after deploying. Checkout rejects supplier prices older than 24 hours.

### Connection check

`npm run resellportal:check` performs **read-only** requests to `/balance`, `/clients` and `/esim-packages`, then reports authentication, package counts and mode. It never places an order, creates a client or sends an email. Credentials, customer details, wallet values and portal passwords are not printed.

To inspect a service you already own:

```powershell
npm run resellportal:check -- --service-id 789
```

This prints response field names/types and QR image hostnames, excluding field values, activation secrets and signed URL tokens. Use it to confirm the exact GET service envelope and configure `RESELLPORTAL_QR_ALLOWED_HOSTS`. The supplied API examples define POST order responses; a real authenticated GET service response still needs acceptance verification with your account. Unknown/ambiguous service payloads are rejected instead of guessed into installable details.

## Real supplier flow

1. Server reloads active, recently synchronized ResellPortal plans from PostgreSQL and calculates the price. Browser totals and stale legacy cart data are ignored. The cart uses a new storage key to retire the old sample cart.
2. The browser POSTs a server-signed form to TransactWorld's exact hosted checkout endpoint. Signed notifications and returns trigger authenticated Inquiry; only a matching captured payment records money, advances the order to PAID and creates a durable provisioning job in one Prisma transaction. A short status `Y`, preauthorization or redirect alone cannot trigger fulfillment.
3. The worker looks up the supplier client by purchase email. If absent, it calls documented `POST /clients` with name/email and setup email disabled. Client IDs are stored for the supplier order; portal passwords are not.
4. Before purchasing, the worker durably marks the local reservation SUBMITTING. It sends `POST /orders` with `client_id`, `product_key: "esim"`, `package_code`, test mode and email suppression.
5. The returned `service_id` is stored immediately. `esim_details` supplies the actual ICCID and QR image URL. Pending services are read through `GET /services/{id}`; no second purchase is made to poll status.
6. Ready details are stored and the order is fulfilled. A separate email job fetches the actual QR image privately and attaches it using CID. Private order pages embed the image from the server. A QR-image URL is never encoded as though it were an LPA activation payload.
7. Authenticated owners or signed guest links can view their order. Usage refresh calls `GET /services/{id}/usage`; exact byte amounts are converted to MB for display. An unissued eSIM (409) and unavailable carrier data (503) have distinct customer messages. Test services do not pretend to have live usage.

ResellPortal documents no outbound reseller webhooks in its public knowledge base; supplier status is polled. Payment capture is independently verified through TransactWorld Inquiry. No ResellPortal top-up endpoint is invented: imported plans have `supportsTopup=false`, and `ENABLE_TOPUPS=no` until a real supported contract is supplied.

### Retries and wallet protection

No supplier idempotency guarantee was included in the provided contract. Sending an undocumented `Idempotency-Key` header would not prove that an order cannot be charged twice. This integration therefore uses a durable local submission state:

- A known service ID is safe to poll with GET.
- An explicit rejected request can be retried after the operator fixes the cause.
- A timed-out POST, unknown response, or crashed SUBMITTING reservation becomes RECONCILE_REQUIRED. Automatic retries and the ordinary admin Retry button cannot issue another supplier purchase for that reservation.
- Admin may link an already-created service after the server verifies the same client, package and test/live mode. The remote service ID is unique per provider.
- If the operator has checked supplier services **and wallet transactions** and verified no purchase exists, a separate explicit confirmation and reconciliation note can authorize one new attempt. This action is audited. Do not use it merely because a response was slow.

Paid failures remain visible with payment intact; they are not silently discarded. Refund money through the merchant dashboard, then reconcile the independently verified full refund in admin. Partial refunds and ambiguous reversals require operator review. Refund/payment event ordering is protected by PostgreSQL transaction locks. A supplier purchase already in flight may require direct supplier reconciliation.

## Catalog and pricing

`GET /esim-packages` is the documented complete catalog endpoint; omitting `location` retrieves the full inventory. The importer validates `total_packages` against actual rows before changing inventory. If pagination or response fields change, it fails safely rather than deactivating unseen plans.

Only the ten launch destinations are published. Country plans require a matching single-country location. Europe regional plans must be explicitly named Europe; a guessed `location=EU` query is not used (the public catalog returned no such location). Coverage codes are stored when supplied. Unsupported daily/FUP or unparseable allowances are excluded rather than represented as a fixed total bundle or unlimited data.

`price` is normalized from supplier USD dollars to integer USD cents. Retail uses the existing markup, fixed markup and minimum margin rules, with optional admin overrides, coupons and tax. Wholesale values never enter public DTOs or browser stores. Plan network/hotspot fields are nullable: no hotspot or carrier claim is manufactured when the catalog only supplies a speed label. No stock plans are hard-coded.

Configuration: `MARKUP_PERCENT`, `FIXED_MARKUP_CENTS`, `MIN_MARGIN_CENTS` and `TAX_PERCENT`. Review them for the business before launch. Currency conversion and final amounts are calculated server-side. No tax-compliance engine is supplied.

### Currency conversion and readable checkout

USD, EUR and AUD are offered throughout the storefront. INR is removed from the selector and new checkout validation; previous saved INR preferences reset to USD, and historical INR orders remain readable. Checkout accepts only the currencies approved for the merchant and listed in `TW_SUPPORTED_CURRENCIES`. The server fetches the free [Frankfurter v2 API](https://frankfurter.dev/) at `https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,AUD`; no API key is required. Frankfurter publishes central-bank reference rates once or a few times per working day; these are not second-by-second market quotes. Responses are cached for five minutes, and open pages refresh every five minutes or after returning to the window. The footer displays the reference date and last check time.

The response is validated for all three target currencies, correct base, distinct quotes, positive finite rates, publication dates and response age. During a brief upstream outage, previously validated display rates may be shown with a stale label for at most one hour. Without usable rates, converted prices are unavailable and USD remains supported. Converted checkout requires a current server snapshot. USD checkout does not depend on the rate API.

Converted item amounts are rounded once to integer minor units, then summed so displayed items equal the subtotal. The browser sends the last reviewed quote total as a consistency check, and the server recalculates from trusted inventory and rates; it never accepts a client price as authoritative. If the total changes, checkout returns 409, refreshes the quote and requires another review. The selected rate, source, publication date and check time are recorded in an `EXCHANGE_RATE_LOCKED` audit entry. Existing pending checkouts retain their original stored amount when retried.

Essential text is at least 14px, body text is 16px, and mobile plan/destination cards use a single readable column. Payment-brand artwork is served locally in the footer and checkout, with its license and source documented in `docs/visual-assets.md`.

The catalog cron refreshes every six hours and checkout requires a sync within the last 24 hours. Sync preserves manual visibility/price overrides, deactivates removed SKUs, and disables overrides made unsafe by a new wholesale cost. Extend `src/lib/data/destinations.ts` to expand launch destinations; page routes and provider interfaces remain data-driven.

Catalog writes use parameterized PostgreSQL upserts in batches of at most 100 plans, with a 30-second transaction limit and a 10-second acquisition wait per destination. This avoids the default five-second interactive-transaction failure caused by two remote database round trips per plan. All batches, margin-review audit entries and stale-plan deactivation commit together for a destination; a failed batch rolls back that destination's changes. Existing plan IDs, order references, creation dates, retail overrides and manually hidden status are preserved.

## TransactWorld setup

The normal checkout uses these switches for live payments and wallet-funded eSIM fulfilment:

```dotenv
PAYMENT_PROVIDER=transactworld
PAYMENTS_ENABLED=yes
TW_ENVIRONMENT=live
RESELLPORTAL_TEST_MODE=no
RESELLPORTAL_ALLOW_LIVE_ORDERS=yes
```

These switches have been enabled in the private local environment at the user's request. Netlify variables are configured separately. Use the public HTTPS site URL for NEXT_PUBLIC_APP_URL, store-approved merchant credentials, approved payment currencies, a verified email sender and worker secrets. Configuration switches alone do not validate credentials. The previously saved merchant details were rejected during authentication and must be replaced with the store's approved credentials. No charged purchase has been made.

The separate sandbox preview and its callbacks have been removed. PAYMENTS_ENABLED is the main yes/no checkout switch; turning it off closes new checkout without changing existing paid orders. The example environment retains safe disabled/sandbox defaults. Live callbacks must be publicly reachable; localhost cannot receive external payment notifications.

```powershell
npm run payments:check
npm run payments:verify
```

`payments:check` prints every environment blocker without secrets or network requests. `payments:verify` authenticates the merchant only; it never submits a payment or supplier order. Normal store checkout also verifies merchant Inquiry access before creating a payable order. Production and live checkout require `NEXT_PUBLIC_APP_URL` to be a public HTTPS origin, such as `https://roamly11.netlify.app`.

Hosted forms automatically send per-order return and notification URLs under `/api/payments/transactworld/return/{reference}` and `/api/payments/transactworld/notify/{reference}`. Configure/approve the public site and callbacks with the merchant account. Requests use `MD5(memberId|totype|amount|reference|redirectUrl|workingKey)`; full-status returns and short-status notifications use `MD5(paymentId|reference|amount|status|workingKey)`. The key is never sent to the browser. Authenticated Inquiry must independently confirm `capturesuccess`, short status `Y`, exact amount/currency and references before fulfillment; callback signatures alone never activate an eSIM.

Inquiry tokens are kept only in memory, refreshed after 55 minutes or an authentication rejection, and can use `TW_MERCHANT_USERNAME` / `TW_PARTNER_ID` when required by the merchant account. An optional `TW_AUTH_TOKEN` overrides automatic authentication temporarily. Failed verification leaves the order pending; the scheduled payment worker retries using merchant-reference Inquiry. TransactWorld forms have no assumed local expiry, so cleanup never treats their age as proof of non-payment. Review genuinely abandoned reservations in the merchant dashboard.

Sources: [Standard Checkout](https://docs.transactworld.com/integration/standard-checkout.php), [Backoffice Inquiry](https://docs.transactworld.com/integration/backoffice.php), [authentication](https://docs.transactworld.com/integration/transaction-AuthToken.php). Public HTTPS callback delivery, approved currencies and real merchant authentication still require account acceptance. No real charge or email was made during implementation.

## Supabase, Resend and admin

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the correct Supabase project's API settings. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains supported. Server-side aliases are accepted, but secret/service-role keys are rejected for account sign-in. These account settings are separate from `DATABASE_URL` and from Netlify's environment: changing Netlify does not populate a local `.env`.

Enable Supabase email auth and configure the app origin plus `/auth/callback` as an allowed PKCE callback. Configure production SMTP. The site verifies identity server-side and reads ADMIN/CUSTOMER roles from Prisma rather than editable auth metadata. The database migration enables RLS on application tables without public policies; Prisma must use a privileged server-only database connection. Do not expose plans/costs, orders, jobs or activation details through anonymous Supabase APIs.

The default magic-link flow exchanges a code at `/auth/callback` and opens `/account/orders`. Open the link in the browser where it was requested. The documented token-hash email template is also supported through `/auth/confirm?token_hash=...&type=email`; the endpoint always redirects to local account orders rather than accepting arbitrary destinations. The login form allows another link after a 60-second cooldown. Verify Supabase's SMTP configuration for real customer addresses, not only organization members.

Verify a Resend sender domain and set `RESEND_API_KEY`/`EMAIL_FROM`. A ready-email failure does not undo a provisioned service. Ready emails use stable idempotency keys and a seven-day signed guest link. Anyone with that private link can access that order; token cookies are HttpOnly, SameSite and Secure in production. QR details are not publicly cacheable or sent as referrers. An authenticated customer can also recover guest purchases by signing in with the same verified email.

Account order history now paginates all purchases instead of stopping at 100. Fulfilled orders include a customer email-resend button in the history and private order page. Resends go only to the original purchase email, require verified account ownership or a valid private order cookie, apply a one-minute per-order cooldown and refuse active email-worker leases. They increment the email idempotency version and queue only that order's EMAIL job; they never enqueue or run a new supplier purchase. Unpaid/refunded orders cannot request installation emails. Email delivery still requires a verified sender; the current Resend domain was reported as `not_started` during the read-only check.

The compatibility page is an interactive model-group search plus manual eSIM/unlock checks, with manufacturer settings instructions and links. Its curated reference is available without a database connection. It does not remotely scan phones or assert a model's carrier lock status.

`/admin/setup` lists all configuration blockers for a verified administrator. `/api/status` exposes only the release identifier, currencies and availability booleans, allowing deployment verification without exposing credentials or customer data. Local source changes are not published until committed/pushed and deployed; `.env` values must be configured separately in Netlify.

Sign in once with the intended admin email, set `ADMIN_EMAIL`, then:

```powershell
npm run admin:promote
```

The script only promotes an existing verified account and logs the action. `/admin` supports orders, supplier reconciliation, retries, resends, refund status, destinations, prices, customers and coupons. No default admin password or automatically privileged email is created.

## Scheduling and deployment

Netlify native schedules (and equivalent `vercel.json` entries) run `/api/cron/payments` and `/api/cron/fulfill` every minute, plus `/api/cron/catalog` every six hours. All require `Authorization: Bearer CRON_SECRET`. Native wrappers use the published deployment context and Netlify's primary site URL; redirects are rejected so worker credentials cannot be forwarded. The immediate callback `after()` kick is an optimization; durable jobs survive process exits. Monitor payment verification, failed/stale jobs and supplier balance. For higher volume, use a dedicated queue/worker.

Deploy through the configured Netlify build with Node 24, hosted database credentials, TransactWorld settings, worker secrets and verified email sender. Environment changes require redeployment; local `.env` is not uploaded automatically. Confirm the three scheduled functions and public merchant callbacks before live sales. Source changes do not publish the site or authorize a wallet-funded purchase.

## Architecture

```text
src/lib/esim/config.ts                 Credential/mode guards
src/lib/esim/resellportal-client.ts    Server-only REST transport and safe error handling
src/lib/esim/resellportal-schemas.ts   Provided API contract validation
src/lib/esim/resellportal-catalog.ts   Package normalization and complete-inventory checks
src/lib/esim/resellportal-provider.ts  Clients, orders, service reads and usage
src/lib/esim/qr-image.ts               Private, bounded, allowlisted QR image delivery
src/lib/esim/sync.ts                   Prisma catalog synchronization
src/lib/orders                        Checkout, verified payments, durable fulfillment/reconciliation
src/lib/pricing                       Markup, discounts, tax and margin floor
src/lib/order-access.ts                Private guest signatures and ownership checks
prisma                                Schema, migrations, destination/device seed
```

Mocks exist only under `tests/fixtures`, are injected by the test runner, and cannot be selected in the running application. Unsupported legacy providers fail closed.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Unit tests validate the supplied ResellPortal contracts, authentication headers, test-mode flags, client creation, package mapping, unknown outcomes, real QR-image handling, carrier usage and mode protection. Integration tests apply **all committed migrations** to a disposable PostgreSQL engine (PGlite), exercise payment/order/retry/refund behavior and the actual seed CLI, and never call the live supplier. PGlite does not replace concurrency/load validation on production-like PostgreSQL.

Browser tests run an isolated storefront on port 3100 with service credentials explicitly disabled. They verify no fabricated inventory, search, empty cart behavior, currency persistence, compatibility, protected redirects, mobile layouts and local image delivery. External account acceptance must still be run after credentials are configured.

## Before live sales

- Configure the actual API keys, database, payment webhook, sender domain, authentication and final domain. Run the read-only connection check and an authenticated test-mode flow.
- Verify the actual GET service response, client matching, test-client behavior and QR image hostnames with your account. Public MCP access cannot substitute for authenticated acceptance. If a test-created `test_cli_*` cannot be used by an order, test with an existing real client email/ID; test mode itself does not persist clients.
- Review retail rules, tax, FX, device variants and coverage. Legal pages are deliberately marked drafts requiring professional review.
- Establish support and alerts for paid failures, wallet balance, queue age, email delivery and refunds. Resend idempotency is limited to its provider retention window; a very late ambiguous email retry can repeat an email, not a supplier purchase.
- Keep secrets out of source control, set the trusted proxy correctly for IP rate limiting, review retention/backups and consent for optional analytics. Original generated imagery and prompts remain in `docs/visual-assets.md`.
- Top-ups remain disabled because no ResellPortal eSIM top-up API was documented. Add only a verified vendor contract, not a made-up endpoint.

Device compatibility uses a model search plus customer-confirmed eSIM and carrier-unlock checks. These are saved in the browser for 30 days, required and validated again by checkout, and recorded as customer self-reports in the order audit. Changing the model clears both answers. The website does not remotely inspect phone hardware or carrier locks; manufacturer instructions are linked on the checker.
