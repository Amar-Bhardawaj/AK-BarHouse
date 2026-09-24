# PostgreSQL migration plan

This is a planning document only. The current application continues to use sql.js.

## Current schema to preserve

- `products`: product identity, catalogue fields, price, stock, active state, placeholder state, and `production_ready`.
- `customers`: customer identity with unique email.
- `addresses`: customer-owned delivery addresses.
- `orders`: totals, currency, order state, payment state, provider identifiers, shipping snapshot, idempotency fields, stock/reconciliation state, and timestamps.
- `order_items`: order/product relationships with name, price, quantity, and subtotal snapshots.
- `payment_events`: unique provider event IDs for webhook idempotency.
- `admin_actions`: operational audit records.

Primary keys, foreign keys, unique constraints, order/payment state rules, idempotency uniqueness, and indexes must remain intact.

## Migration sequence

1. Freeze writes and create verified copies of the SQLite database and `.bak` file.
2. Create PostgreSQL tables with explicit foreign keys, check constraints, indexes, and UTC timestamp columns.
3. Import products first, then customers, addresses, orders, and order items; import payment events and admin actions last.
4. Validate row counts, totals, foreign-key relationships, idempotency keys, and order/payment states.
5. Run checkout, inventory, admin, webhook-idempotency, and reconciliation tests against PostgreSQL.
6. Switch `DATABASE_URL` through a controlled deployment and retain the SQLite backup read-only for rollback reference.

## Code that must change later

The sql.js `SQL.Database` initialization, `db.prepare` helpers, `db.export()` persistence, atomic file replacement, SQLite `PRAGMA` setup, and SQLite-specific migration code in `server.js` must be replaced with a PostgreSQL connection pool, parameterized queries, database transactions, and migration tooling.

## Rollback

Rollback requires stopping writes, restoring the previous application version, and switching back to the last verified database snapshot. Do not attempt bidirectional live writes between SQLite and PostgreSQL.
