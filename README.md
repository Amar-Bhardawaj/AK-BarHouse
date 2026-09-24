# The Barrel House

The Barrel House is a small full-stack drinks-commerce application. The Phase 1 static catalogue remains the visual foundation; Phase 9 adds a PostgreSQL production runtime while retaining an isolated sql.js path for local regression tests.

## Architecture

- Node.js 24+, Express, and vanilla browser JavaScript.
- PostgreSQL persistence through the maintained `pg` driver and a bounded connection pool in production.
- The existing sql.js/WASM database remains development/test compatibility only; it is not a production fallback.
- `data/products.json` is the seed source for the initial catalogue.
- The whiskey/wine `stock: 10` values in `data/products.json` are development-only seed placeholders, not verified inventory; replace them before any real order flow. Cocktail and healthy-drink entries have zero stock because they are concepts, not orderable products.
- `server.js` owns the compatibility test runtime; `server-postgres.js` owns the PostgreSQL production runtime with the same public API and state protections.
- `public/` is the only directory served by Express. Repository source, database, tests, seed data, and package files are intentionally not web-accessible.
- PostgreSQL order creation uses transactions and row locks for inventory. Versioned SQL migrations live under `db/migrations/`; production initialization and backup expectations are documented in `docs/PRODUCTION_DATABASE.md`.
- `script.js`, `checkout.js`, and `confirmation.js` provide the browser experience.
- Razorpay is an integration boundary only; credentials are never committed or exposed except for the public test key returned to the checkout SDK.
- When Razorpay credentials are absent, checkout runs in payment-deferred mode: it records a pending-payment order, does not call Razorpay, does not mark payment paid, and does not deduct stock.

There are no microservices, framework migration, payment credentials, or production business assumptions.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Open `http://localhost:3000/index.html`.

For local order-flow testing, set `DELIVERY_POSTAL_CODES=000000` (or another owner-approved test code) in `.env`. The default is empty so the application does not assume nationwide serviceability.

## Environment variables

See `.env.example`:

- `PORT`
- `NODE_ENV`
- `TRUST_PROXY`
- `STORE_NAME`
- `BUSINESS_EMAIL`, `BUSINESS_PHONE`, `BUSINESS_ADDRESS`, `SUPPORT_EMAIL`
- `CURRENCY`
- `AGE_VERIFICATION_REQUIRED`
- `ALLOW_DEVELOPMENT_PRODUCTS`
- `DATABASE_PATH`
- `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`
- `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONNECTION_TIMEOUT_MS`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `DELIVERY_POSTAL_CODES`
- `DELIVERY_FEE`
- `MINIMUM_ORDER_VALUE`

Use Razorpay sandbox/test credentials only during development. Never commit `.env` or real credentials.

## Data and order flow

The browser sends product IDs and quantities only. The active runtime reloads product prices, active state, and stock from the configured database, recalculates subtotal/delivery/total, validates the customer/address/age confirmation, and creates a `pending` order. Payment is created server-side and the order becomes `confirmed` only after valid provider verification. Stock is not deducted for pending orders.

Order states: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`. Payment-captured orders that cannot reserve stock enter `reconciliation_status=required` and must be recovered from Admin before fulfilment.

Payment states: `pending`, `paid`, `failed`, `refunded`.

## Admin

Open `http://localhost:3000/admin.html` and use the configured Basic Auth credentials. The minimal dashboard can view/update product stock, inspect order details, reconcile paid orders, and update order status. Admin mutation routes reject missing or placeholder credentials, rate-limit failed authentication, log actions, and enforce paid/reconciled fulfilment transitions. Use HTTPS in production; Basic Auth is not appropriate over plain HTTP.

## Tests

```powershell
npm test
npm run test:e2e
npm audit
npm ci --dry-run
```

The browser smoke test expects a running server. It covers homepage/category/product navigation, adding to cart, search, payment-deferred checkout, pending-order confirmation, admin order visibility, mobile navigation, cart persistence after reload, keyboard focus, and horizontal-overflow checks at 360px, 390px, and 412px. Start the test server with an owner-approved test code such as `DELIVERY_POSTAL_CODES=999999` and pass `TEST_POSTAL_CODE=999999` to exercise the complete deferred order flow.

## Hardening notes

- Send a unique `Idempotency-Key` for every checkout attempt; the browser stores one in `sessionStorage` and the server persists the key/fingerprint.
- Razorpay payment order creation is reused for an existing pending attempt. Webhook event IDs are persisted to reject duplicate delivery.
- Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` with Razorpay TEST MODE values only for sandbox testing. No credentials are included here.
- The current no-credential checkout path is intentional for development. It records a reference and clearly reports that online payment is unavailable; Razorpay can be enabled later through the existing payment boundary.
- Configure owner-approved `DELIVERY_POSTAL_CODES` and `DELIVERY_FEE`; empty serviceability is intentional until business rules are supplied.
- `ALLOW_DEVELOPMENT_PRODUCTS=true` is for local testing only. Production must leave it false and populate `products.production_ready` only through a verified product-data process.
- Before production, add managed database storage, HTTPS, backups/restore drills, approved legal text, verified inventory, delivery rules, and production payment credentials.

## Phase 6 production-readiness notes

The repository is technically testable but is not production-ready. Before deployment, the owner must supply verified product records (including prices, stock, identifiers, descriptions, active state, and licensed images), approved delivery postal codes and fees, business contact details, and legally approved privacy, terms, returns, age, alcohol-commerce, and disclaimer content. The current values in `data/products.json` are development seed data; cocktail and healthy-drink rows are explicitly non-orderable concepts.

Production should run behind HTTPS with `NODE_ENV=production`, `DATABASE_URL`, non-placeholder admin credentials, and `TRUST_PROXY=true` only when the hosting proxy is correctly configured. `npm start` selects PostgreSQL in production, applies migrations, adds baseline security headers, disables the Express fingerprint header, validates required production settings, and closes the PostgreSQL pool gracefully on termination.

The PostgreSQL runtime removes the single-process database limitation. The local sql.js design still loads the whole compatibility database into one Node process and persists exported SQLite bytes to disk; it is not a production fallback. PostgreSQL migration and clean initialization are documented in `docs/POSTGRESQL_MIGRATION.md` and `docs/PRODUCTION_DATABASE.md`.

Deployment still requires a Node.js host with persistent writable storage, HTTPS/domain termination, environment-secret management, log/alert collection, backup verification, health monitoring, and a controlled process manager. No deployment configuration or production credentials are included in this repository.

## Business and production blockers

- No approved business contact details, delivery regions, inventory, or legal policy text are present in the repository.
- Age rules, delivery restrictions, returns, privacy, terms, and alcohol-commerce compliance require owner/legal confirmation.
- Razorpay sandbox credentials and webhook configuration are still required for payment testing. No payment is simulated or marked paid locally.
- External product image URLs remain from Phase 1 and require availability, licensing, and local-asset review before production.
- `hgwin.dll`, old CSS files, demo HTML files, and unused image assets remain unreferenced pending an explicit ownership/cleanup decision.
