function booleanValue(value, fallback) {
    if (value === undefined || value === "") return fallback;
    return value.toLowerCase() === "true";
}

function nonNegativeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function isPlaceholder(value) {
    return ["replace-this-before-use", "change-me", "changeme", "password", "test-password"].includes(String(value || "").toLowerCase());
}

export function validateProductionDatabaseConfig(env = process.env) {
    const missing = [];
    if (env.NODE_ENV !== "production") missing.push("NODE_ENV=production");
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (env.DATABASE_SSL !== "true") missing.push("DATABASE_SSL=true");
    if (env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "true") missing.push("DATABASE_SSL_REJECT_UNAUTHORIZED=true");
    if (missing.length) throw new Error(`Production database configuration is incomplete: ${missing.join(", ")}.`);
}

export function validateProductionConfig(env = process.env) {
    const missing = [];
    if (env.NODE_ENV !== "production") missing.push("NODE_ENV=production");
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (env.DATABASE_SSL !== "true") missing.push("DATABASE_SSL=true");
    if (env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "true") missing.push("DATABASE_SSL_REJECT_UNAUTHORIZED=true");
    if (!env.ADMIN_USERNAME || isPlaceholder(env.ADMIN_USERNAME)) missing.push("ADMIN_USERNAME");
    if (!env.ADMIN_PASSWORD || isPlaceholder(env.ADMIN_PASSWORD)) missing.push("ADMIN_PASSWORD");
    if (booleanValue(env.ALLOW_DEVELOPMENT_PRODUCTS, false)) missing.push("ALLOW_DEVELOPMENT_PRODUCTS=false");
    if (!(env.DELIVERY_POSTAL_CODES || "").trim()) missing.push("DELIVERY_POSTAL_CODES");
    if (missing.length) throw new Error(`Production configuration is incomplete: ${missing.join(", ")}.`);
}

export function validateProductionProductImport(products, env = process.env) {
    if (env.NODE_ENV !== "production") return;
    if (!Array.isArray(products) || products.length === 0) throw new Error("Production product import requires at least one approved product.");
    const invalid = products.find(product => !product || product.placeholder || product.production_ready !== true || !Number.isInteger(product.stock) || product.stock < 0 || !Number.isFinite(product.price) || product.price < 0);
    if (invalid) throw new Error(`Production product import contains unapproved or invalid product data: ${invalid?.id || "unknown"}.`);
}

export function createConfig(env = process.env) {
    const production = env.NODE_ENV === "production";
    return {
        environment: env.NODE_ENV || "development",
        production,
        storeName: env.STORE_NAME || "The Barrel House",
        currency: env.CURRENCY || "INR",
        business: {
            email: env.BUSINESS_EMAIL || "",
            phone: env.BUSINESS_PHONE || "",
            address: env.BUSINESS_ADDRESS || "",
            supportEmail: env.SUPPORT_EMAIL || ""
        },
        delivery: {
            postalCodes: (env.DELIVERY_POSTAL_CODES || "").split(",").map(value => value.trim()).filter(Boolean),
            fee: nonNegativeNumber(env.DELIVERY_FEE),
            minimumOrderValue: nonNegativeNumber(env.MINIMUM_ORDER_VALUE)
        },
        ageVerificationRequired: booleanValue(env.AGE_VERIFICATION_REQUIRED, true),
        allowDevelopmentProducts: booleanValue(env.ALLOW_DEVELOPMENT_PRODUCTS, !production),
        payment: {
            razorpayConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
            webhookConfigured: Boolean(env.RAZORPAY_WEBHOOK_SECRET)
        }
    };
}
