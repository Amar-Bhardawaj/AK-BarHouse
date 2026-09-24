import assert from "node:assert/strict";
import test from "node:test";
import { createConfig } from "../config.js";

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
