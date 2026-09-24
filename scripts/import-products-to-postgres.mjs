import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProductionDatabaseConfig, validateProductionProductImport } from "../config.js";
import { createPostgresPool, migratePostgres, closePostgres } from "../db/postgres.js";

if (process.env.NODE_ENV === "production") validateProductionDatabaseConfig();
if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PRODUCT_IMPORT !== "yes") {
    throw new Error("Set CONFIRM_PRODUCT_IMPORT=yes for an explicit production product import.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (process.env.NODE_ENV === "production" && !process.env.PRODUCTS_FILE) throw new Error("PRODUCTS_FILE is required for an explicit production product import.");

const root = path.dirname(fileURLToPath(import.meta.url));
const productsFile = path.resolve(process.env.PRODUCTS_FILE || path.join(root, "..", "data", "products.json"));
if (process.env.NODE_ENV === "production") {
    const publicDir = path.resolve(root, "..", "public") + path.sep;
    if (productsFile.startsWith(publicDir)) throw new Error("PRODUCTS_FILE must be outside the public static directory.");
    const productStat = await fs.stat(productsFile);
    if (!productStat.isFile()) throw new Error("PRODUCTS_FILE must identify a regular file.");
}
const products = JSON.parse(await fs.readFile(productsFile, "utf8"));
validateProductionProductImport(products);
const pool = createPostgresPool();
try {
    await migratePostgres(pool);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const product of products) {
            await client.query(`INSERT INTO products (id,name,slug,category,description,type,origin,abv,price,image,stock,active,placeholder,production_ready,created_at,updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
                ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,slug=EXCLUDED.slug,category=EXCLUDED.category,description=EXCLUDED.description,type=EXCLUDED.type,origin=EXCLUDED.origin,abv=EXCLUDED.abv,price=EXCLUDED.price,image=EXCLUDED.image,stock=EXCLUDED.stock,active=EXCLUDED.active,placeholder=EXCLUDED.placeholder,production_ready=EXCLUDED.production_ready,updated_at=NOW()`, [product.id, product.name, product.id, product.category, product.description, product.type, product.origin, product.abv, product.price, product.image, product.stock || 0, Boolean(product.active), Boolean(product.placeholder), Boolean(product.production_ready)]);
        }
        await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    console.log(`Imported ${products.length} product records only. Customer and order data were not imported.`);
} finally { await closePostgres(pool); }
