# Production database initialization

1. Provision a new empty managed PostgreSQL database.
2. Set `NODE_ENV=production`, `DATABASE_URL`, database SSL settings, non-placeholder admin credentials, and approved business configuration.
3. Start the application. The migration runner applies `db/migrations/*.sql` exactly once per version.
4. Verify `/api/health` reports `database: postgresql`.
5. Load only approved production product records through an explicit operator-reviewed process. Do not copy the development SQLite database.
6. Set `production_ready` only for owner-verified products; keep development/demo products unavailable.
7. Configure and verify delivery rules, legal copy, and business details.
8. Run the smoke and security checks against the new database.
9. Configure managed backups and verify a restore before accepting real orders.
10. Take and verify the initial backup/snapshot.

The local `data/barrel-house.sqlite` and `.bak` files contain development/test state and are not production database sources.

The explicit product-only helper is `node scripts/import-products-to-postgres.mjs`. It requires `DATABASE_URL`; in production it additionally requires `CONFIRM_PRODUCT_IMPORT=yes`. It never imports customers, addresses, orders, order items, payment events, or admin actions.

## Recovery expectations

The hosting/database provider must provide automated backups, a defined retention period, point-in-time recovery where available, access-controlled backup storage, and periodic restore drills. The repository does not claim that any provider backup is configured.
