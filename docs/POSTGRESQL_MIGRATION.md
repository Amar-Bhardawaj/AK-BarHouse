# PostgreSQL migration

Phase 9 adds the PostgreSQL production runtime in `server-postgres.js`, a pooled `pg` connection, and the repeatable migration runner in `db/postgres.js`.

## Schema

`db/migrations/001_initial.sql` creates `schema_migrations`, `products`, `customers`, `addresses`, `orders`, `order_items`, `payment_events`, and `admin_actions`. It preserves product readiness, stock, order/payment states, provider IDs, idempotency, reconciliation, webhook uniqueness, timestamps, foreign keys, checks, and indexes.

## Runtime selection

- `NODE_ENV=production` or any configured `DATABASE_URL` starts `server-postgres.js` through `server-entry.js`.
- Production fails if `DATABASE_URL` is absent; it cannot silently use sql.js.
- Local tests continue to use the existing isolated sql.js path until PostgreSQL is available in the test environment.
- PostgreSQL development seeding is explicit through `ALLOW_DEVELOPMENT_PRODUCTS=true`; production does not seed the development catalogue automatically.

## Data migration

There is deliberately no automatic import of the local SQLite file. Development customers, addresses, orders, and order items must not be promoted into production. A future operator-run import must be explicit, reviewed, and limited to approved product data unless separately authorized.

Before any import, validate row counts, totals, foreign keys, state values, idempotency keys, payment events, and reconciliation records. Keep the source database read-only as a rollback reference.

## Transaction and concurrency requirements

PostgreSQL order creation runs in one transaction and locks selected product rows with `FOR UPDATE`. Unique constraints protect customer email, order number, public token, idempotency key, provider order ID, and webhook event ID. Admin status changes and audit records share a transaction.

Payment provider verification and full paid-order reconciliation remain deferred until Razorpay TEST credentials and provider verification are enabled. No unpaid order is marked paid or fulfilled.

## Rollback

Stop writes, restore the last verified PostgreSQL backup/snapshot, and redeploy the last compatible application commit. Do not run bidirectional writes between SQLite and PostgreSQL.
