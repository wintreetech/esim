# Verification

On 16 November 2026, the authenticated read-only ResellPortal check passed with 3,289 supplier packages. A separate PostgreSQL 18 preview cluster was created under the ignored `.local/postgres` folder, with SCRAM password authentication and a loopback-only listener on port 55432. Both committed migrations and the content seed were applied, and 215 eligible real plans were imported across all 10 launch destinations. The private `.env` now contains the local connection URL; credential values were cleared from `.env.example`.

Chrome checks against the running app at `http://localhost:3000` confirmed 35 Japan plan cards with prices, selection into checkout, and 19 Thailand plans on mobile without horizontal overflow. Captures are `artifacts/live-catalog-japan.png` and `artifacts/live-catalog-mobile.png`. TypeScript and ESLint passed after the local setup helper was added. No supplier mutation, wallet charge, payment or email was performed. The exact authenticated service response and full test-mode fulfillment still need acceptance testing. The earlier verification below describes the initial integration checks.

ResellPortal integration checked locally on 2 November 2026 with Node 24 and Chrome.

| Check                               | Result              |
| ----------------------------------- | ------------------- |
| Strict TypeScript                   | Passed              |
| ESLint                              | Passed, no warnings |
| Unit tests                          | 32 passed           |
| PostgreSQL-engine integration tests | 27 passed           |
| Chrome browser tests                | 5 passed            |
| Next.js production build            | Passed              |

The public ResellPortal MCP endpoint was queried read-only to inspect documentation and actual package formats. The REST authentication boundary was verified to require the API key and secret. At that initial check, authenticated ResellPortal acceptance was not run because the local credentials were blank.

Supplier contract tests cover the supplied request/response examples, headers, test mode, customer reuse/creation, catalog completeness and currency units, real QR-image handling, usage bytes/expiry, ambiguous submissions and unsupported top-ups. A database integration test runs the actual ResellPortal adapter with HTTP responses simulated from the supplied contract through a verified payment, durable reservation and fulfillment. Other database tests exercise duplicate payments, worker claims, failed submissions, crash recovery, operator reconciliation, ownership, refunds and the seed CLI. All committed SQL migrations are applied to disposable PGlite databases. Mocks are restricted to tests and cannot be selected in the running app.

Browser checks verify destination search, no fabricated inventory or buy button without plans, empty-cart behavior, currency persistence, device filtering, protected redirects, responsive layouts and local image loading. They run on an isolated port with real service credentials disabled. All five assertions passed; the managed Windows environment required explicitly closing the owned QA server to finish Playwright teardown. Desktop/mobile captures are under `artifacts/`.

No real Stripe charge, Resend email, Supabase sign-in, authenticated supplier mutation, live wallet purchase or deployment was performed. After credentials are added, run the read-only connection check, synchronize the actual catalog, verify the real GET service envelope/QR hostname and complete the authenticated test-mode acceptance flow in README. API test-mode eSIMs do not provide cellular connectivity.

Original generated travel assets and prompts remain documented in [visual-assets.md](visual-assets.md).
