# The Barrel House

The Barrel House is a small full-stack drinks-commerce application. The Phase 1 static catalogue remains the visual foundation; Phase 2 adds a deliberately compact Express/SQLite commerce backend.

## Architecture

- Node.js 24+, Express, and vanilla browser JavaScript.
- SQLite persistence through `sql.js` (WASM), stored at `data/barrel-house.sqlite`.
- `data/products.json` is the seed source for the initial catalogue.
- The whiskey/wine `stock: 10` values in `data/products.json` are development-only seed placeholders, not verified inventory; replace them before any real order flow. Cocktail and healthy-drink entries have zero stock because they are concepts, not orderable products.
- `server.js` owns product availability, stock, quotes, idempotent orders, payment verification, webhooks, reconciliation, and protected admin routes.
- `public/` is the only directory served by Express. Repository source, database, tests, seed data, and package files are intentionally not web-accessible.
- sql.js remains a single-process development/test database. Writes use an atomic replacement plus `.bak` fallback, but production deployment should migrate to a server-grade relational database with managed backups before real commerce.
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
- `DATABASE_PATH`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `DELIVERY_POSTAL_CODES`
- `DELIVERY_FEE`

Use Razorpay sandbox/test credentials only during development. Never commit `.env` or real credentials.

## Data and order flow

The browser sends product IDs and quantities only. The server reloads product prices, active state, and stock from SQLite, recalculates subtotal/delivery/total, validates the customer/address/age confirmation, and creates a `pending` order. Payment is created server-side and the order becomes `confirmed` only after a valid Razorpay signature or verified webhook. Stock is decremented during successful payment confirmation and restored when an admin cancels a paid order.

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

The browser smoke test expects a running server. It covers homepage/category/product navigation, adding to cart, search, checkout validation, mobile navigation, cart persistence after reload, and asserts that the expected checkout error is specifically the order API response rather than an unrelated HTTP 400.

## Hardening notes

- Send a unique `Idempotency-Key` for every checkout attempt; the browser stores one in `sessionStorage` and the server persists the key/fingerprint.
- Razorpay payment order creation is reused for an existing pending attempt. Webhook event IDs are persisted to reject duplicate delivery.
- Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` with Razorpay TEST MODE values only for sandbox testing. No credentials are included here.
- The current no-credential checkout path is intentional for development. It records a reference and clearly reports that online payment is unavailable; Razorpay can be enabled later through the existing payment boundary.
- Configure owner-approved `DELIVERY_POSTAL_CODES` and `DELIVERY_FEE`; empty serviceability is intentional until business rules are supplied.
- Before production, add managed database storage, HTTPS, backups/restore drills, approved legal text, verified inventory, delivery rules, and production payment credentials.

## Business and production blockers

- No approved business contact details, delivery regions, inventory, or legal policy text are present in the repository.
- Age rules, delivery restrictions, returns, privacy, terms, and alcohol-commerce compliance require owner/legal confirmation.
- Razorpay sandbox credentials and webhook configuration are still required for payment testing. No payment is simulated or marked paid locally.
- External product image URLs remain from Phase 1 and require availability, licensing, and local-asset review before production.
- `hgwin.dll`, old CSS files, demo HTML files, and unused image assets remain unreferenced pending an explicit ownership/cleanup decision.
