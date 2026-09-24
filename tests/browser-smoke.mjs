import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(5000);
const consoleErrors = [];
const httpErrors = [];
const securityErrors = [];
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("response", response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
page.on("console", message => { if (/Content Security Policy/i.test(message.text())) securityErrors.push(message.text()); });

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${baseUrl}/index.html`);
assert.equal(await page.locator(".category-card img").count(), 4);
for (const image of await page.locator(".category-card img").all()) {
    assert.ok(await image.evaluate(node => node.complete && node.naturalWidth > 0));
    assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit), "cover");
}
await page.locator("[data-featured-products] .product-card img").first().waitFor({ state: "visible" });
assert.ok(await page.locator("[data-featured-products] .product-card img").first().evaluate(node => node.complete && node.naturalWidth > 0));
await page.getByRole("link", { name: "Whiskey" }).first().click();
await page.getByRole("link", { name: "Glenfiddich 12 Year Old" }).click();
await page.getByRole("button", { name: "Add to collection" }).click();
assert.match(await page.locator(".cart-panel").innerText(), /Glenfiddich 12 Year Old/);
assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close collection");
await page.keyboard.press("Escape");
assert.equal(await page.locator("[data-cart].is-open").count(), 0);
assert.equal(await page.evaluate(() => document.activeElement?.dataset.addToCart), "glenfiddich-12");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}/whiskey.html`);
await page.getByRole("button", { name: "Toggle navigation" }).click();
assert.equal(await page.locator(".site-nav.is-open").count(), 1);
assert.equal(await page.getByRole("button", { name: "Toggle navigation" }).getAttribute("aria-expanded"), "true");
await page.reload();
assert.equal(await page.locator("[data-cart-count]").first().innerText(), "1");

await page.setViewportSize({ width: 1280, height: 900 });
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
await page.locator("#postal-code").fill(process.env.TEST_POSTAL_CODE || "999999");
await page.locator("#country").fill("India");
await page.locator("#age-confirmed").check();
await page.getByRole("button", { name: "Record pending order" }).click();
await page.waitForURL(/confirmation\.html\?order=/, { timeout: 10000 });
assert.match(await page.locator("h1").innerText(), /Pending payment order/);
assert.match(await page.locator("body").innerText(), /Online payment is currently unavailable|pending payment/i);
assert.equal(await page.locator("script[src*='razorpay']").count(), 0);

for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${baseUrl}/index.html`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Horizontal overflow at ${width}px`);
    const categoryBox = await page.locator(".category-card").first().boundingBox();
    assert.ok(categoryBox && categoryBox.width > 0 && categoryBox.height > 0, `Category card unavailable at ${width}px`);
    const closeTarget = await page.getByRole("button", { name: "Close collection" }).boundingBox().catch(() => null);
    if (closeTarget) assert.ok(closeTarget.width >= 44 && closeTarget.height >= 44, `Cart target too small at ${width}px`);
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => document.activeElement !== document.body), `Keyboard focus did not move at ${width}px`);
}

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${baseUrl}/admin.html`);
await page.locator("#admin-pass").fill(process.env.TEST_ADMIN_PASSWORD || "test-password");
await page.getByRole("button", { name: "Open dashboard" }).click();
await page.locator("#admin-dashboard").waitFor({ state: "visible" });
await page.locator("[data-view-order]").first().click();
assert.match(await page.locator("#admin-order-detail").innerText(), /Order/);

assert.equal(consoleErrors.length, 0, `Unexpected browser console errors: ${consoleErrors.join(" | ")}`);
assert.equal(securityErrors.length, 0, `Content Security Policy violations: ${securityErrors.join(" | ")}`);
assert.equal(httpErrors.length, 0, `Unexpected HTTP errors: ${JSON.stringify(httpErrors)}`);
await browser.close();
console.log("Browser smoke tests passed.");
