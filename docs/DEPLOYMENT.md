# Deployment preparation

## Phase 9 runtime

`npm start` uses `server-entry.js`. When `NODE_ENV=production` or `DATABASE_URL` is configured, it starts the PostgreSQL runtime and cannot fall back to the local sql.js database.

Required production settings include `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, certificate-verifying database TLS, non-placeholder admin credentials, `ALLOW_DEVELOPMENT_PRODUCTS=false`, approved delivery configuration, and HTTPS termination with the correct `TRUST_PROXY` value. `npm start` refuses incomplete configuration whenever production mode or `DATABASE_URL` selects the PostgreSQL runtime.

The PostgreSQL runtime exposes `/api/health`, serves only `public/`, closes its pool during shutdown, and keeps Razorpay deferred until test credentials and provider verification are configured.

The application is not deployed by this repository. The intended production shape is:

`Customer → HTTPS/domain → Node.js/Express → PostgreSQL → managed backups/storage → future Razorpay`

## Runtime

- Node.js 24.x (`package.json` enforces `>=24 <25`).
- Start command: `npm start`.
- No build step is required for the current vanilla frontend.
- Express serves only `public/` and exposes API routes under `/api`.
- The process handles `SIGINT` and `SIGTERM` for graceful shutdown.

## Required production settings

Set secrets through the host's environment manager, never in Git:

- `SHUTDOWN_TIMEOUT_MS=10000` or a host-appropriate lower value; it bounds graceful shutdown.
- `NODE_ENV=production`
- `DATABASE_URL` for the persistent PostgreSQL database. Do not set `DATABASE_PATH` as a production persistence mechanism.
- `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=true` unless the managed provider documents an equivalent verified TLS configuration.
- `ADMIN_USERNAME` and a non-placeholder `ADMIN_PASSWORD`.
- `TRUST_PROXY=true` only when the hosting proxy is trusted and configured.
- Owner-approved `DELIVERY_POSTAL_CODES`, `DELIVERY_FEE`, and any minimum-order rule.
- Verified product data with development products disabled (`ALLOW_DEVELOPMENT_PRODUCTS=false`).

Razorpay variables remain deferred and must not be populated until the payment account is approved. The CSP includes only the current Razorpay script/API origins so the deferred flow remains functional; do not broaden payment origins without a provider security review.

## Operations required before launch

Configure HTTPS at the hosting edge before exposing the app; set `TRUST_PROXY=true` only when that proxy is trusted and forwards the correct client protocol. Configure persistent database storage, log collection, error alerts, `/api/health` monitoring, backup scheduling, restore drills, process restart policy, and access control. Confirm that the database and backup paths are outside the static `public/` directory. The application sends HSTS, CSP, frame, MIME-sniffing, referrer, and permissions-policy headers; keep reverse-proxy security headers compatible with them.

## Owner-supplied launch inputs

The owner must provide and approve, without repository defaults being treated as production data:

- Real product names, SKUs/IDs, prices, stock, descriptions, active state, and licensed image URLs/assets.
- Business name/contact email, phone, physical/business address, support contact, and operating details.
- Serviceable delivery PINs/areas, delivery fee, and minimum-order rule.
- Approved age, returns/refunds, privacy, terms, disclaimer, and alcohol-commerce/legal wording.

## Deployment sequence

1. Provision a new persistent managed PostgreSQL database and store `DATABASE_URL` plus admin credentials in the host secret manager.
2. Set the required production environment listed above; leave all Razorpay variables unset while payment remains deferred.
3. Run `npm ci --omit=dev` with Node.js 24.x, then start with `npm start` from the repository root. Migration discovery is tied to the installed application path, not the process working directory.
4. Verify `GET /api/health` returns `ok: true` and `database: postgresql` through the HTTPS endpoint.
5. Prepare an owner-reviewed JSON export outside `public/`, set every product's `production_ready` to `true`, and run `CONFIRM_PRODUCT_IMPORT=yes PRODUCTS_FILE=<approved-export> node scripts/import-products-to-postgres.mjs`. The helper rejects an omitted export, empty, placeholder, unapproved, negative-stock, or unpriced production input; never use the development `data/products.json` as the production export.
6. Configure monitoring to poll `/api/health`; it must return HTTP 200 with `ok: true` and `database: postgresql`. A 503 means the process is not ready.
7. Configure the host to send `SIGTERM` and allow at least `SHUTDOWN_TIMEOUT_MS` plus a small margin before force-killing the process. Verify a restart and termination in staging.
8. Complete and retain the backup/restore evidence in `docs/PRODUCTION_DATABASE.md` before accepting orders; keep the last compatible commit available for rollback.
