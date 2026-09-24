import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");

export function createPostgresPool(env = process.env) {
    if (!env.DATABASE_URL) throw new Error("PostgreSQL requires DATABASE_URL.");
    return new Pool({
        connectionString: env.DATABASE_URL,
        ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
        max: Number(env.DATABASE_POOL_MAX || 10),
        idleTimeoutMillis: Number(env.DATABASE_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(env.DATABASE_CONNECTION_TIMEOUT_MS || 5000),
        allowExitOnIdle: false
    });
}

export async function migratePostgres(pool) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
        const migrationFiles = (await fs.readdir(migrationsDirectory)).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
        const applied = new Set((await client.query("SELECT version FROM schema_migrations ORDER BY version")).rows.map(row => row.version));
        for (const file of migrationFiles) {
            const version = Number(file.split("_", 1)[0]);
            if (applied.has(version)) continue;
            await client.query(await fs.readFile(path.join(migrationsDirectory, file), "utf8"));
            await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

export async function closePostgres(pool) { await pool.end(); }
