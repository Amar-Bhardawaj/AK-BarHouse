import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
const httpErrors = [];
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("response", response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

await page.goto(`${baseUrl}/index.html`);
await page.getByRole("link", { name: "Whiskey" }).first().click();
await page.getByRole("link", { name: "Glenfiddich 12 Year Old" }).click();
await page.getByRole("button", { name: "Add to collection" }).click();
assert.match(await page.locator(".cart-panel").innerText(), /Glenfiddich 12 Year Old/);

await page.goto(`${baseUrl}/index.html`);
await page.getByLabel("Search products").fill("cabernet");
await page.getByRole("button", { name: "Search" }).click();
await page.getByRole("link", { name: "Cabernet Sauvignon" }).click();
assert.match(await page.locator("h1").innerText(), /Cabernet Sauvignon/);

await page.goto(`${baseUrl}/checkout.html`);
await page.locator("#customer-name").fill("Browser Test");
await page.locator("#customer-email").fill("browser@example.com");
await page.locator("#customer-phone").fill("9999999999");
await page.locator("#address-line-1").fill("Test Road");
await page.locator("#city").fill("Test City");
await page.locator("#state").fill("Test State");
await page.locator("#postal-code").fill("999999");
await page.locator("#country").fill("India");
await page.locator("#age-confirmed").check();
await page.getByRole("button", { name: "Create pending order" }).click();
await page.waitForTimeout(300);
assert.match(await page.locator("#checkout-message").innerText(), /not configured|serviceable/i);
assert.ok(httpErrors.some(error => error.url.endsWith("/api/orders") && error.status === 400), "Checkout validation did not return the expected order error.");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}/whiskey.html`);
await page.getByRole("button", { name: "Toggle navigation" }).click();
assert.equal(await page.locator(".site-nav.is-open").count(), 1);
await page.reload();
assert.equal(await page.locator("[data-cart-count]").first().innerText(), "1");

assert.ok(consoleErrors.every(error => error.includes("status of 400") || error.includes("400 (Bad Request)")), `Unexpected browser console errors: ${consoleErrors.join(" | ")}`);
assert.ok(httpErrors.every(error => error.url.includes("/api/orders") && error.status === 400), `Unexpected HTTP errors: ${JSON.stringify(httpErrors)}`);
await browser.close();
console.log("Browser smoke tests passed.");
