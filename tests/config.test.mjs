import assert from "node:assert/strict";
import test from "node:test";
import { createConfig, validateProductionConfig, validateProductionProductImport } from "../config.js";

test("production configuration does not enable development products by default", () => {
    const config = createConfig({ NODE_ENV: "production", CURRENCY: "INR" });
    assert.equal(config.production, true);
    assert.equal(config.allowDevelopmentProducts, false);
    assert.equal(config.business.email, "");
    assert.deepEqual(config.delivery.postalCodes, []);
});

test("development configuration remains usable for local seed testing", () => {
    const config = createConfig({ NODE_ENV: "development", DELIVERY_POSTAL_CODES: "123456", DELIVERY_FEE: "75" });
    assert.equal(config.allowDevelopmentProducts, true);
    assert.deepEqual(config.delivery.postalCodes, ["123456"]);
    assert.equal(config.delivery.fee, 75);
});

test("production configuration rejects unsafe or incomplete settings", () => {
    assert.throws(() => validateProductionConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://example", ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "replace-this-before-use" }), /Production configuration is incomplete/);
    assert.doesNotThrow(() => validateProductionConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
        ADMIN_USERNAME: "owner-admin",
        ADMIN_PASSWORD: "owner-secret",
        ALLOW_DEVELOPMENT_PRODUCTS: "false",
        DELIVERY_POSTAL_CODES: "000000"
    }));
});

test("production product import rejects development or incomplete records", () => {
    assert.doesNotThrow(() => validateProductionProductImport([{ id: "approved", stock: 3, price: 2500, placeholder: false, production_ready: true }], { NODE_ENV: "production" }));
    assert.throws(() => validateProductionProductImport([{ id: "development", stock: 10, price: 4200, production_ready: false }], { NODE_ENV: "production" }), /unapproved or invalid/);
    assert.throws(() => validateProductionProductImport([{ id: "missing-price", stock: 3, price: null, production_ready: true }], { NODE_ENV: "production" }), /unapproved or invalid/);
    assert.doesNotThrow(() => validateProductionProductImport([], { NODE_ENV: "development" }));
});
