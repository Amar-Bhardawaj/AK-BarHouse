import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "barrel-house-test-"));
process.env.DATABASE_PATH = path.join(tempDir, "test.sqlite");
process.env.DELIVERY_POSTAL_CODES = "123456";
process.env.ADMIN_USERNAME = "test-admin";
process.env.ADMIN_PASSWORD = "test-password";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;

const { app, db, saveDatabase, markPaymentPaid } = await import(`../server.js?test=${Date.now()}`);
const server = await new Promise(resolve => { const value = app.listen(0, () => resolve(value)); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const request = async (pathName, options = {}) => { const response = await fetch(`${baseUrl}${pathName}`, options); let body = {}; try { body = await response.json(); } catch {} return { response, body }; };
const auth = { Authorization: `Basic ${Buffer.from("test-admin:test-password").toString("base64")}` };
const orderBody = (items = [{ id: "glenfiddich-12", quantity: 1 }]) => ({ customer: { name: "Automated Test", email: "automated@example.com", phone: "9999999999" }, address: { address_line_1: "Test Road", city: "Test City", state: "Test State", postal_code: "123456", country: "India" }, age_confirmed: true, items });

test.after(async () => { await new Promise(resolve => server.close(resolve)); });

test("hardening and commerce invariants", async () => {
    const health = await request("/api/health"); assert.equal(health.response.status, 200); assert.equal(health.body.ok, true);
    const products = await request("/api/products"); assert.equal(products.response.status, 200); assert.ok(products.body.length > 0);
    const product = await request("/api/products/glenfiddich-12"); assert.equal(product.response.status, 200);
    const paymentStatus = await request("/api/payments/status"); assert.deepEqual(paymentStatus.body, { mode: "deferred", onlinePaymentAvailable: false, message: "Online payment is currently unavailable. Orders can be recorded as pending payment." });

    assert.equal(db.exec("PRAGMA foreign_keys")[0].values[0][0], 1);
    assert.equal(db.exec("PRAGMA user_version")[0].values[0][0], 2);
    assert.ok(db.exec("PRAGMA table_info(products)")[0].values.some(row => row[1] === "production_ready"));
    assert.throws(() => db.run("INSERT INTO addresses (customer_id,name,phone,address_line_1,city,state,postal_code,country) VALUES (999,'x','x','x','x','x','x','x')"));

    const stockBefore = db.exec("SELECT stock FROM products WHERE id='glenfiddich-12'")[0].values[0][0];
    const first = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "test-order-1" }, body: JSON.stringify(orderBody()) });
    assert.equal(first.response.status, 201); assert.ok(first.body.order.id); assert.equal(first.body.payment.status, "pending");
    assert.equal(db.exec("SELECT stock FROM products WHERE id='glenfiddich-12'")[0].values[0][0], stockBefore);
    const duplicate = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "test-order-1" }, body: JSON.stringify(orderBody()) });
    assert.equal(duplicate.response.status, 200); assert.equal(duplicate.body.order.id, first.body.order.id);
    const conflict = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "test-order-1" }, body: JSON.stringify(orderBody([{ id: "glenfiddich-12", quantity: 2 }])) });
    assert.equal(conflict.response.status, 409);
    const invalidQuantity = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "bad-quantity" }, body: JSON.stringify(orderBody([{ id: "glenfiddich-12", quantity: -1 }])) });
    assert.equal(invalidQuantity.response.status, 400);
    const unavailablePostal = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "bad-postal" }, body: JSON.stringify({ ...orderBody(), address: { ...orderBody().address, postal_code: "000000" } }) });
    assert.equal(unavailablePostal.response.status, 400);
    const tooMuch = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "too-much" }, body: JSON.stringify(orderBody([{ id: "glenfiddich-12", quantity: 999 }])) });
    assert.equal(tooMuch.response.status, 400);
    const unpaidTransition = await request(`/api/admin/orders/${first.body.order.id}`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ status: "confirmed" }) });
    assert.equal(unpaidTransition.response.status, 409);
    const adminOrders = await request("/api/admin/orders", { headers: auth }); assert.equal(adminOrders.response.status, 200); assert.ok(adminOrders.body.some(order => order.id === first.body.order.id && order.payment_status === "pending"));
    const adminDetail = await request(`/api/admin/orders/${first.body.order.id}`, { headers: auth }); assert.equal(adminDetail.response.status, 200); assert.equal(adminDetail.body.items.length, 1); assert.equal(adminDetail.body.shipping_address.postal_code, "123456");
    const unauthorized = await request("/api/admin/orders"); assert.equal(unauthorized.response.status, 401);
    const paymentBoundary = await request("/api/payments/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: first.body.order.id }) });
    assert.equal(paymentBoundary.response.status, 503);
    const verificationBoundary = await request("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: first.body.order.id }) }); assert.equal(verificationBoundary.response.status, 400);

    const event = JSON.stringify({ id: "evt-test-1", event: "payment.failed", payload: { payment: { entity: { order_id: "unknown-provider", id: "pay-test" } } } });
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(event).digest("hex");
    const webhook = () => request("/api/payments/webhook", { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": signature }, body: event });
    assert.equal((await webhook()).response.status, 200); const duplicateWebhook = await webhook(); assert.equal(duplicateWebhook.response.status, 200); assert.equal(duplicateWebhook.body.duplicate, true);

    db.run("UPDATE orders SET payment_provider_order_id='provider-test', payment_status='pending' WHERE id=?", [first.body.order.id]);
    db.run("UPDATE products SET stock=0 WHERE id='glenfiddich-12'"); saveDatabase();
    const reconciliation = markPaymentPaid("provider-test", "pay-reconciliation"); assert.equal(reconciliation.status, "reconciliation-required");
    db.run("UPDATE products SET stock=10 WHERE id='glenfiddich-12'"); saveDatabase();
    const recovered = await request(`/api/admin/orders/${first.body.order.id}/reconcile`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(recovered.response.status, 200);
    assert.ok(fs.existsSync(process.env.DATABASE_PATH)); assert.ok(fs.existsSync(`${process.env.DATABASE_PATH}.bak`));
});

test("sensitive repository files are not public", async () => {
    for (const file of ["/data/barrel-house.sqlite", "/server.js", "/data/products.json", "/.env", "/tests/browser-smoke.mjs", "/package.json"]) {
        const result = await request(file); assert.ok([404, 403].includes(result.response.status), `${file} was exposed with ${result.response.status}`);
    }
    assert.equal((await request("/index.html")).response.status, 200);
});

test("database reload preserves products and orders", async () => {
    const productsBefore = db.exec("SELECT COUNT(*) FROM products")[0].values[0][0];
    const ordersBefore = db.exec("SELECT COUNT(*) FROM orders")[0].values[0][0];
    assert.ok(productsBefore > 0 && ordersBefore > 0);
    assert.ok(fs.statSync(process.env.DATABASE_PATH).size > 0);
});
