# Production database initialization

1. Provision a new empty managed PostgreSQL database.
2. Set `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, non-placeholder admin credentials, and approved business configuration.
3. Start the application. The migration runner locates `db/migrations/` from the installed application and uses a PostgreSQL advisory lock, so overlapping instances cannot apply the same migration concurrently. Each version is applied transactionally and recorded once.
4. Verify `/api/health` reports `database: postgresql`.
5. Load only approved production product records through an explicit operator-reviewed process. Do not copy the development SQLite database.
6. Set `production_ready` only for owner-verified products; keep development/demo products unavailable.
7. Configure and verify delivery rules, legal copy, and business details.
8. Run the smoke and security checks against the new database.
9. Configure managed backups and verify a restore before accepting real orders.
10. Take and verify the initial backup/snapshot.

The local `data/barrel-house.sqlite` and `.bak` files contain development/test state and are not production database sources.

The explicit product-only helper is `node scripts/import-products-to-postgres.mjs`. It requires verified PostgreSQL TLS; in production it additionally requires `CONFIRM_PRODUCT_IMPORT=yes`, an explicit regular-file `PRODUCTS_FILE` path to an owner-reviewed export outside `public/`, and rejects empty, placeholder, unapproved, negative-stock, or unpriced records. The development `data/products.json` is not a production export. The helper never imports customers, addresses, orders, order items, payment events, or admin actions.

## Recovery expectations

The hosting/database provider must provide automated backups, a defined retention period, point-in-time recovery where available, access-controlled backup storage, and periodic restore drills. The repository does not claim that any provider backup is configured.

## Backup and restore runbook

Use the provider's managed backup/PITR facility when available. For an operator-created logical backup, run from a controlled host with `DATABASE_URL` supplied by the secret manager; never paste it into a command committed to Git or into logs:

```powershell
pg_dump --format=custom --file=barrel-house-YYYYMMDD-HHMM.dump "$env:DATABASE_URL"
```

Record the backup timestamp and verify the dump through the provider's protected storage. For a restore drill, provision a separate empty PostgreSQL database, set its connection string only in the environment, and restore without touching production:

```powershell
pg_restore --list .\barrel-house-YYYYMMDD-HHMM.dump
pg_restore --clean --if-exists --no-owner --dbname="$env:RESTORE_DATABASE_URL" .\barrel-house-YYYYMMDD-HHMM.dump
```

After restoring, record the following evidence against the isolated database and retain it with the drill record:

```powershell
psql "$env:RESTORE_DATABASE_URL" -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
psql "$env:RESTORE_DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
psql "$env:RESTORE_DATABASE_URL" -c "SELECT 'products' AS table_name, COUNT(*) FROM products UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'order_items', COUNT(*) FROM order_items UNION ALL SELECT 'payment_events', COUNT(*) FROM payment_events;"
psql "$env:RESTORE_DATABASE_URL" -c "SELECT COUNT(*) AS orphaned_order_items FROM order_items oi LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL;"
```

Compare the required schema objects, migration versions, and business row counts with the source snapshot. Start the same application commit against the isolated restore, verify `/api/health`, and exercise the checkout/admin smoke checks without using real customers or payment credentials. Record the dump checksum, timestamps, database/provider identity, commands, results, and operator sign-off in access-controlled storage.

A production recovery stops writes, restores the last verified snapshot or dump, verifies the application commit is compatible, and then resumes service. Do not restore development SQLite data into production.
