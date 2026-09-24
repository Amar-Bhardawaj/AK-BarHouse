# Clean production database procedure

The checked-out development database may contain test customer, address, order, and admin-audit records. It must never be copied into production.

For the current sql.js development deployment:

1. Stop the application.
2. Set a new empty `DATABASE_PATH` outside `public/`.
3. Do not copy `data/barrel-house.sqlite` or `data/barrel-house.sqlite.bak` into that location.
4. Start once so the schema and seed catalogue are initialized.
5. Set `ALLOW_DEVELOPMENT_PRODUCTS=false` for any environment that must not sell unverified seed data.
6. Verify that the new database has no customers, addresses, orders, order items, payment events, or admin actions.
7. Create verified product records through the approved data-management process before accepting orders.
8. Back up the clean initialized database according to the hosting provider's protected backup policy.

The first production order must not be created until product, inventory, delivery, legal, and operational configuration has been approved by the owner.
