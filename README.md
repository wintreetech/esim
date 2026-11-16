# Roamly + ResellPortal

A Next.js App Router travel eSIM storefront with PostgreSQL/Prisma, Supabase Auth, Stripe Checkout and Resend. **ResellPortal is the runtime supplier.** There is no dummy catalog, mock-provider runtime branch, invented QR code, or seeded sample price. The ten launch destinations retain their original editorial content; plans and prices appear only after a successful authenticated supplier sync.

## What to configure

A gitignored `.env` has been prepared locally. Fill in the blank credentials there; never paste API secrets or passwords into chat. `.env.example` documents every setting. Restart the development server after changing environment variables.

For a client preview on Windows with PostgreSQL installed, run `npm run db:local`. It creates a separate password-protected PostgreSQL cluster in the ignored `.local/postgres` folder, listens only on `127.0.0.1:55432`, and fills the blank `DATABASE_URL` in `.env`. Existing PostgreSQL services and other databases are untouched. Then run `npm run db:deploy`, `npm run db:seed`, and `npm run db:sync`, and restart `npm run dev`. Run `npm run db:local` again after restarting your computer to start the preview database. This local URL works on this computer; deployment needs a hosted PostgreSQL URL in the hosting environment.

| Setting                                                     | Needed for                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESELLPORTAL_API_KEY`, `RESELLPORTAL_API_SECRET`           | ResellPortal Tools > API Access; normal credentials work with test mode. No separate sandbox account is required.                                      |
| `RESELLPORTAL_BASE_URL`                                     | Already set to `https://panel.resellportal.com/wp-json/resellportal/v1`. The dashboard and MCP URLs are not the REST API base URL.                     |
| `DATABASE_URL`                                              | PostgreSQL connection, such as Supabase or Neon. Use a server-only pooled connection in production.                                                    |
| `DIRECT_DATABASE_URL`                                       | Optional direct connection for Prisma migrations when the application uses a transaction pooler.                                                       |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                | Receive and verify customer payments before supplier provisioning. Use Stripe test keys during integration.                                            |
| `RESEND_API_KEY`, `EMAIL_FROM`                              | Send Roamly installation emails from a verified domain.                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Customer and admin email-link sign-in. Guest checkout also works.                                                                                      |
| `NEXT_PUBLIC_APP_URL`                                       | Local origin, then the final HTTPS domain; also used for CSRF, payment redirects and private order links.                                              |
| `ADMIN_EMAIL`                                               | Support contact and the exact verified account to promote to ADMIN.                                                                                    |
| `ORDER_ACCESS_SECRET`, `CRON_SECRET`                        | Random signing/worker secrets. The local file has been populated where these were blank; values are not logged.                                        |
| `RESELLPORTAL_QR_ALLOWED_HOSTS`                             | Exact hostname(s) used by the provider's QR images. Defaults to `panel.resellportal.com`; add the real carrier image hostname before live fulfillment. |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is reserved for future embedded payment UI; hosted Stripe Checkout does not need Stripe.js. `SUPABASE_SERVICE_ROLE_KEY` is reserved and unused. Never put provider, database, payment, email, or signing secrets in a `NEXT_PUBLIC_*` variable.

## Test mode and live orders

Default local settings:

```dotenv
ESIM_PROVIDER=resellportal
RESELLPORTAL_TEST_MODE=true
RESELLPORTAL_ALLOW_LIVE_ORDERS=false
```

Every supplier mutation sends `test_mode` explicitly and uses `X-RP-Test-Mode: 1` in test mode. Every order suppresses the supplier's welcome email with `skip_client_email: true`; client creation also requests `send_setup_email: false`. Roamly delivers its own installation email. Returned portal passwords are discarded, not stored or shown.

Test mode authenticates and validates through the real API but creates no real service or wallet charge. It cannot provide cellular data. Test emails and account pages are labeled and do not send a pretend installable QR code. Read endpoints always use actual authenticated catalog/client/service data.

Live wallet purchases require **both** `RESELLPORTAL_TEST_MODE=false` and `RESELLPORTAL_ALLOW_LIVE_ORDERS=true`. Stripe and supplier modes must match in both directions: a Stripe test payment must never spend live wallet funds, and a live Stripe charge must not deliver a supplier test result. The selected supplier mode is captured on each order; changing environment mode cannot turn an old test checkout into a live supplier purchase.

No live supplier order was placed during implementation. Before switching to live, complete authenticated test-mode acceptance, set up QR image hosts, review prices/tax/legal policies, and explicitly authorize any real test purchase. The wallet needs enough balance for the selected package's wholesale price; test-mode validation does not require funding.

## Install and connect

Prerequisites: Node.js 22.12+ (Node 24 recommended), npm, PostgreSQL, a ResellPortal account with API Access, Stripe, Resend and Supabase Auth.

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

Netlify does not execute `vercel.json` cron definitions. Before accepting live payments, configure a scheduler to call the authenticated fulfillment endpoint every minute and the catalog endpoint every six hours. Checkout rejects supplier prices older than 24 hours.

### Connection check

`npm run resellportal:check` performs **read-only** requests to `/balance`, `/clients` and `/esim-packages`, then reports authentication, package counts and mode. It never places an order, creates a client or sends an email. Credentials, customer details, wallet values and portal passwords are not printed.

To inspect a service you already own:

```powershell
npm run resellportal:check -- --service-id 789
```

This prints response field names/types and QR image hostnames, excluding field values, activation secrets and signed URL tokens. Use it to confirm the exact GET service envelope and configure `RESELLPORTAL_QR_ALLOWED_HOSTS`. The supplied API examples define POST order responses; a real authenticated GET service response still needs acceptance verification with your account. Unknown/ambiguous service payloads are rejected instead of guessed into installable details.

## Real supplier flow

1. Server reloads active, recently synchronized ResellPortal plans from PostgreSQL and calculates the price. Browser totals and stale legacy cart data are ignored. The cart uses a new storage key to retire the old sample cart.
2. Stripe hosted Checkout collects payment. A signed payment webhook records the payment, advances the order to PAID and creates a durable provisioning job in one Prisma transaction.
3. The worker looks up the supplier client by purchase email. If absent, it calls documented `POST /clients` with name/email and setup email disabled. Client IDs are stored for the supplier order; portal passwords are not.
4. Before purchasing, the worker durably marks the local reservation SUBMITTING. It sends `POST /orders` with `client_id`, `product_key: "esim"`, `package_code`, test mode and email suppression.
5. The returned `service_id` is stored immediately. `esim_details` supplies the actual ICCID and QR image URL. Pending services are read through `GET /services/{id}`; no second purchase is made to poll status.
6. Ready details are stored and the order is fulfilled. A separate email job fetches the actual QR image privately and attaches it using CID. Private order pages embed the image from the server. A QR-image URL is never encoded as though it were an LPA activation payload.
7. Authenticated owners or signed guest links can view their order. Usage refresh calls `GET /services/{id}/usage`; exact byte amounts are converted to MB for display. An unissued eSIM (409) and unavailable carrier data (503) have distinct customer messages. Test services do not pretend to have live usage.

ResellPortal documents no outbound reseller webhooks in its public knowledge base; supplier status is polled. Stripe webhooks remain the payment authority. The integration does not invent a ResellPortal top-up endpoint: imported plans have `supportsTopup=false`, and `ENABLE_TOPUPS` remains false until a real supported top-up contract is supplied.

### Retries and wallet protection

No supplier idempotency guarantee was included in the provided contract. Sending an undocumented `Idempotency-Key` header would not prove that an order cannot be charged twice. This integration therefore uses a durable local submission state:

- A known service ID is safe to poll with GET.
- An explicit rejected request can be retried after the operator fixes the cause.
- A timed-out POST, unknown response, or crashed SUBMITTING reservation becomes RECONCILE_REQUIRED. Automatic retries and the ordinary admin Retry button cannot issue another supplier purchase for that reservation.
- Admin may link an already-created service after the server verifies the same client, package and test/live mode. The remote service ID is unique per provider.
- If the operator has checked supplier services **and wallet transactions** and verified no purchase exists, a separate explicit confirmation and reconciliation note can authorize one new attempt. This action is audited. Do not use it merely because a response was slow.

Paid failures remain visible with payment intact; they are not silently discarded. Refund money through Stripe, then let the full-refund webhook update the order or reconcile that existing refund in admin. Refund/payment event ordering is protected by PostgreSQL transaction locks. A supplier purchase already in flight may require direct supplier reconciliation.

## Catalog and pricing

`GET /esim-packages` is the documented complete catalog endpoint; omitting `location` retrieves the full inventory. The importer validates `total_packages` against actual rows before changing inventory. If pagination or response fields change, it fails safely rather than deactivating unseen plans.

Only the ten launch destinations are published. Country plans require a matching single-country location. Europe regional plans must be explicitly named Europe; a guessed `location=EU` query is not used (the public catalog returned no such location). Coverage codes are stored when supplied. Unsupported daily/FUP or unparseable allowances are excluded rather than represented as a fixed total bundle or unlimited data.

`price` is normalized from supplier USD dollars to integer USD cents. Retail uses the existing markup, fixed markup and minimum margin rules, with optional admin overrides, coupons and tax. Wholesale values never enter public DTOs or browser stores. Plan network/hotspot fields are nullable: no hotspot or carrier claim is manufactured when the catalog only supplies a speed label. No stock plans are hard-coded.

Configuration: `MARKUP_PERCENT`, `FIXED_MARKUP_CENTS`, `MIN_MARGIN_CENTS`, `TAX_PERCENT` and fixed `USD_INR_RATE`. Review them for the business before launch. Currency conversion and final amounts are calculated server-side. No live exchange-rate API or tax-compliance engine is supplied.

The catalog cron refreshes every six hours and checkout requires a sync within the last 24 hours. Sync preserves manual visibility/price overrides, deactivates removed SKUs, and disables overrides made unsafe by a new wholesale cost. Extend `src/lib/data/destinations.ts` to expand launch destinations; page routes and provider interfaces remain data-driven.

Catalog writes use parameterized PostgreSQL upserts in batches of at most 100 plans, with a 30-second transaction limit and a 10-second acquisition wait per destination. This avoids the default five-second interactive-transaction failure caused by two remote database round trips per plan. All batches, margin-review audit entries and stale-plan deactivation commit together for a destination; a failed batch rolls back that destination's changes. Existing plan IDs, order references, creation dates, retail overrides and manually hidden status are preserved.

## Stripe setup

Use Stripe test credentials while `RESELLPORTAL_TEST_MODE=true`. Run the official Stripe CLI:

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy its `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, restart Next.js, and purchase an actual imported plan with a Stripe test card such as `4242 4242 4242 4242`, future expiry and any CVC. A generic Stripe fixture event does not contain a valid application order and is intentionally rejected.

For production, register `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `charge.refunded`. A browser success redirect never provisions an eSIM. Event, payment, amount, currency, session, supplier-mode and duplicate-delivery checks run server-side.

## Supabase, Resend and admin

Enable Supabase email auth and configure the app origin plus `/auth/callback` as an allowed PKCE callback. Configure production SMTP. The site verifies identity server-side and reads ADMIN/CUSTOMER roles from Prisma rather than editable auth metadata. The database migration enables RLS on application tables without public policies; Prisma must use a privileged server-only database connection. Do not expose plans/costs, orders, jobs or activation details through anonymous Supabase APIs.

Verify a Resend sender domain and set `RESEND_API_KEY`/`EMAIL_FROM`. A ready-email failure does not undo a provisioned service. Ready emails use stable idempotency keys and a seven-day signed guest link. Anyone with that private link can access that order; token cookies are HttpOnly, SameSite and Secure in production. QR details are not publicly cacheable or sent as referrers. An authenticated customer can also recover guest purchases by signing in with the same verified email.

Sign in once with the intended admin email, set `ADMIN_EMAIL`, then:

```powershell
npm run admin:promote
```

The script only promotes an existing verified account and logs the action. `/admin` supports orders, supplier reconciliation, retries, resends, refund status, destinations, prices, customers and coupons. No default admin password or automatically privileged email is created.

## Scheduling and deployment

`vercel.json` schedules `/api/cron/fulfill` every minute and `/api/cron/catalog` every six hours. Both require `Authorization: Bearer CRON_SECRET`. Use a Vercel plan or external scheduler that supports these intervals and 300-second functions. The immediate webhook `after()` kick is an optimization; durable database jobs survive process exits. Monitor failed/stale jobs and supplier balance. For higher volume, move to a dedicated queue/worker.

Deploy this Next.js project to Vercel with Node 24 and `npm run build`. Configure the same secrets there, use the final HTTPS domain, apply `npm run db:deploy` before serving the new version, seed destination content, then synchronize real supplier inventory. Set up callbacks, Stripe webhook, cron and email DNS. No publication/deployment or wallet-funded purchase is performed by source changes alone.

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
