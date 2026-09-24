# Deployment preparation

The application is not deployed by this repository. The intended production shape is:

`Customer → HTTPS/domain → Node.js/Express → PostgreSQL → managed backups/storage → future Razorpay`

## Runtime

- Node.js 24 or the version selected and tested by the hosting provider.
- Start command: `npm start`.
- No build step is required for the current vanilla frontend.
- Express serves only `public/` and exposes API routes under `/api`.
- The process handles `SIGINT` and `SIGTERM` for graceful shutdown.

## Required production settings

Set secrets through the host's environment manager, never in Git:

- `NODE_ENV=production`
- `DATABASE_PATH` for the current development architecture, or a future `DATABASE_URL` after PostgreSQL migration.
- `ADMIN_USERNAME` and a non-placeholder `ADMIN_PASSWORD`.
- `TRUST_PROXY=true` only when the hosting proxy is trusted and configured.
- Owner-approved `DELIVERY_POSTAL_CODES`, `DELIVERY_FEE`, and any minimum-order rule.
- Verified product data with development products disabled.

Razorpay variables remain deferred and must not be populated until the payment account is approved.

## Operations required before launch

Configure HTTPS, persistent database storage, log collection, error alerts, health checks, backup scheduling, restore drills, process restart policy, and access control. Confirm that the database and backup paths are outside the static `public/` directory.
