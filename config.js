function booleanValue(value, fallback) {
    if (value === undefined || value === "") return fallback;
    return value.toLowerCase() === "true";
}

function nonNegativeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
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
