const checkoutForm = document.querySelector("#checkout-form");
const checkoutMessage = document.querySelector("#checkout-message");
const submitButton = checkoutForm?.querySelector("button[type=submit]");
let checkoutProducts = [];
let checkoutQuote = null;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const money = value => `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
function readCheckoutCart() {
    try {
        const value = JSON.parse(localStorage.getItem("barrel-house-cart") || "[]");
        return Array.isArray(value) ? value.filter(item => item && typeof item.id === "string" && Number.isInteger(item.quantity) && item.quantity > 0) : [];
    } catch { localStorage.removeItem("barrel-house-cart"); return []; }
}
let checkoutCart = readCheckoutCart();
function showMessage(message, state = "error") { checkoutMessage.textContent = message; checkoutMessage.className = `form-message is-${state}`; }
function setQuotePending() { for (const id of ["checkout-subtotal", "checkout-delivery", "checkout-total"]) document.querySelector(`#${id}`).textContent = "—"; }
function setBusy(isBusy) { if (!submitButton) return; submitButton.disabled = isBusy; submitButton.setAttribute("aria-busy", String(isBusy)); submitButton.textContent = isBusy ? "Recording order…" : "Record pending order"; }
function renderSummary() {
    const items = checkoutCart.map(item => ({ ...item, product: checkoutProducts.find(product => product.id === item.id) })).filter(item => item.product?.available);
    const summary = document.querySelector("#checkout-items");
    if (!items.length) { summary.innerHTML = `<p class="muted">Your collection is empty or no longer available. <a href="index.html">Return to the collection.</a></p>`; if (submitButton) submitButton.disabled = true; return; }
    summary.innerHTML = items.map(item => `<div class="checkout-item"><span>${escapeHtml(item.product.name)} × ${item.quantity}</span><strong>${money(item.product.price * item.quantity)}</strong></div>`).join("");
}
async function loadSummary() {
    setQuotePending();
    document.querySelector("#checkout-items").innerHTML = `<p class="loading-state">Preparing your order summary…</p>`;
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Collection could not be loaded.");
    checkoutProducts = await response.json();
    const valid = new Set(checkoutProducts.filter(product => product.available).map(product => product.id));
    checkoutCart = checkoutCart.filter(item => valid.has(item.id));
    localStorage.setItem("barrel-house-cart", JSON.stringify(checkoutCart));
    renderSummary();
    const quoteResponse = await fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: checkoutCart }) });
    const data = await quoteResponse.json();
    if (!quoteResponse.ok) throw new Error(data.error || "The order quote could not be loaded.");
    checkoutQuote = data;
    setQuotePending();
    document.querySelector("#checkout-subtotal").textContent = money(data.subtotal);
    document.querySelector("#checkout-delivery").textContent = data.serviceable ? money(data.delivery_fee) : "Service area to be confirmed";
    document.querySelector("#checkout-total").textContent = money(data.total);
    document.querySelector("#delivery-status").textContent = data.serviceable ? "Delivery is available for configured postal codes." : "Delivery areas have not been configured yet.";
}
async function createPayment(order) {
    const response = await fetch("/api/payments/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Payment setup failed.");
    await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = resolve; script.onerror = () => reject(new Error("Razorpay checkout could not load.")); document.head.append(script); });
    const checkout = new Razorpay({ key: data.keyId, amount: data.amount, currency: data.currency, name: "The Barrel House", description: `Order ${data.orderNumber}`, order_id: data.razorpayOrderId, handler: async payment => { try { const verify = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id, ...payment }) }); const result = await verify.json(); if (!verify.ok) throw new Error(result.error || "Payment verification failed."); localStorage.removeItem("barrel-house-cart"); location.href = `confirmation.html?order=${encodeURIComponent(result.orderNumber)}&token=${encodeURIComponent(result.publicToken)}`; } catch (error) { showMessage(error.message); setBusy(false); } }, modal: { ondismiss: () => { showMessage("Payment was cancelled. Your order remains pending and has not been charged.", "info"); setBusy(false); } } });
    checkout.open();
}
async function handleDeferredOrder(order) { localStorage.removeItem("barrel-house-cart"); location.href = `confirmation.html?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.publicToken)}&mode=deferred`; }

checkoutForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitButton?.disabled) return;
    if (!checkoutForm.reportValidity()) return;
    setBusy(true);
    showMessage("Validating availability, delivery, and order details…", "info");
    const data = new FormData(checkoutForm);
    const payload = { customer: { name: data.get("name"), email: data.get("email"), phone: data.get("phone") }, address: { address_line_1: data.get("address_line_1"), address_line_2: data.get("address_line_2"), city: data.get("city"), state: data.get("state"), postal_code: data.get("postal_code"), country: data.get("country") }, age_confirmed: document.querySelector("#age-confirmed").checked, items: checkoutCart };
    const idempotencyKey = sessionStorage.getItem("barrel-house-checkout-key") || crypto.randomUUID();
    sessionStorage.setItem("barrel-house-checkout-key", idempotencyKey);
    try {
        const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Order validation failed. Check the highlighted details and try again.");
        const paymentStatus = await fetch("/api/payments/status").then(statusResponse => statusResponse.json());
        if (paymentStatus.mode === "deferred") return handleDeferredOrder(result.order);
        await createPayment(result.order);
    } catch (error) { showMessage(error.message); setBusy(false); }
});

loadSummary().catch(error => { setQuotePending(); showMessage(error.message); if (submitButton) submitButton.disabled = true; });
