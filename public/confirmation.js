const target = document.querySelector("#confirmation");
const params = new URLSearchParams(location.search);
const order = params.get("order");
const token = params.get("token");
const fallbackDeferred = params.get("mode") === "deferred";
const formatStatus = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const money = value => `₹ ${Number(value || 0).toLocaleString("en-IN")}`;

if (!order || !token) {
    target.innerHTML = `<span class="eyebrow">Order status</span><h1>Order details unavailable</h1><p class="muted">The confirmation link is incomplete.</p><a class="button" href="index.html">Return home</a>`;
    target.removeAttribute("aria-busy");
} else {
    if (fallbackDeferred) target.innerHTML = `<span class="eyebrow">Order recorded</span><h1>Pending payment order</h1><p>Loading your order details…</p>`;
    fetch(`/api/orders/public/${encodeURIComponent(order)}?token=${encodeURIComponent(token)}`)
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (!ok) throw new Error(data.error);
            const pendingCopy = data.payment_status === "pending" || (fallbackDeferred && !data.payment_status);
            const items = (data.items || []).map(item => `<li>${escapeHtml(item.product_name_snapshot)} × ${Number(item.quantity)} <strong>${money(item.subtotal)}</strong></li>`).join("");
            const address = data.address?.city ? `${escapeHtml(data.address.city)}, ${escapeHtml(data.address.state)} ${escapeHtml(data.address.postal_code)}` : "Delivery details recorded";
            target.innerHTML = `<span class="eyebrow">Order recorded</span><h1>${pendingCopy ? "Pending payment order" : "Payment verified"}</h1><p>Your order reference is <strong>${escapeHtml(data.order_number)}</strong>.</p><div class="status-grid"><div><span>Order status</span><strong>${escapeHtml(formatStatus(data.status))}</strong></div><div><span>Payment</span><strong>${escapeHtml(formatStatus(data.payment_status))}</strong></div></div><h2>Items</h2><ul class="confirmation-items">${items || "<li>Item details unavailable</li>"}</ul><div class="checkout-total"><strong>Total</strong><strong>${money(data.total)}</strong></div><p>Delivery to: ${address}</p>${pendingCopy ? "<p class=\"payment-notice\"><strong>Payment is not yet confirmed.</strong> Your order is recorded as pending payment. No payment was taken and inventory was not deducted.</p>" : "<p class=\"success-notice\">Payment has been verified. Further order updates will follow the configured process.</p>"}<div class="utility-actions"><a class="button" href="index.html">Return to The Barrel House</a><a class="button secondary" href="whiskey.html">Continue browsing</a></div>`;
        })
        .catch(error => { target.innerHTML = `<span class="eyebrow">Order status</span><h1>Unable to load order</h1><p class="muted">${escapeHtml(error.message)}</p><a class="button" href="index.html">Return home</a>`; })
        .finally(() => target.removeAttribute("aria-busy"));
}
