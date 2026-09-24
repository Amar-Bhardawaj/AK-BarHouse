import assert from "node:assert/strict";
import test from "node:test";
import { closePostgres, createPostgresPool, migratePostgres } from "../db/postgres.js";

const available = Boolean(process.env.DATABASE_URL);

test("PostgreSQL migration and constraints", { skip: !available ? "DATABASE_URL is not configured in this environment" : false }, async () => {
    const pool = createPostgresPool(), concurrentPool = createPostgresPool();
    try {
        await Promise.all([migratePostgres(pool), migratePostgres(concurrentPool)]);
        await migratePostgres(pool);
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('products','orders','order_items','payment_events','admin_actions')");
        assert.equal(tables.rows.length, 5);
        await assert.rejects(pool.query("INSERT INTO products (id,name,slug,category,description,type,origin,image,stock,created_at,updated_at) VALUES ('test','x','test','x','x','x','x','x',-1,NOW(),NOW())"));
    } finally { await Promise.all([closePostgres(pool), closePostgres(concurrentPool)]); }
});
