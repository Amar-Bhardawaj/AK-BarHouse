let products = [];
const cartKey = "barrel-house-cart";
const categoryNames = { whiskey: "Whiskey", wine: "Wine", cocktails: "Cocktails", healthy: "Healthy drinks" };
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function readCart() {
    try {
        const value = JSON.parse(localStorage.getItem(cartKey) || "[]");
        return Array.isArray(value) ? value.filter(item => item && typeof item.id === "string" && Number.isInteger(item.quantity) && item.quantity > 0) : [];
    } catch {
        localStorage.removeItem(cartKey);
        return [];
    }
}

let cart = readCart();
function formatPrice(value) { return value == null ? "Details to be confirmed" : `₹ ${Number(value).toLocaleString("en-IN")}`; }
function getProduct(id) { return products.find(product => product.id === id); }
function productCard(product) {
    const action = product.available
        ? `<button class="button small" type="button" data-add-to-cart="${escapeHtml(product.id)}">Add to collection</button>`
        : `<a class="button secondary small" href="product.html?id=${encodeURIComponent(product.id)}">View details</a>`;
    const availability = product.available ? "Available to order" : (product.price == null ? "Details to be confirmed" : "Currently unavailable");
    return `<article class="product-card"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='3.jpg'"><div class="product-card-body"><h3><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3><p>${escapeHtml(product.description)}</p><div class="product-meta"><span>${escapeHtml(product.type)}</span><span>${escapeHtml(product.abv || "ABV to confirm")}</span></div><div class="product-footer"><div><span class="price">${formatPrice(product.price)}</span><small class="availability">${availability}</small></div><div class="card-actions">${action}</div></div></div></article>`;
}
function renderProducts(list, target) { if (target) target.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty-state"><h3>No matches yet</h3><p>Try a different name, category, or search term.</p></div>`; }
async function loadProducts() {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Products could not be loaded.");
    products = await response.json();
    const valid = new Set(products.filter(product => product.available).map(product => product.id));
    const before = cart.length;
    cart = cart.filter(item => valid.has(item.id));
    if (before !== cart.length) saveCart();
}
function saveCart() { localStorage.setItem(cartKey, JSON.stringify(cart)); }
function addToCart(id) { const product = getProduct(id); if (!product?.available) return; const item = cart.find(entry => entry.id === id); if (item) item.quantity += 1; else cart.push({ id, quantity: 1 }); saveCart(); renderCart(); openCart(); }
function changeQuantity(id, amount) { const item = cart.find(entry => entry.id === id); if (!item) return; item.quantity += amount; cart = cart.filter(entry => entry.quantity > 0); saveCart(); renderCart(); }
function renderCart() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll("[data-cart-count]").forEach(node => node.textContent = count);
    const target = document.querySelector("[data-cart-items]"), totalNode = document.querySelector("[data-cart-total]"), panel = document.querySelector(".cart-panel");
    if (!target || !totalNode) return;
    let checkoutLink = panel?.querySelector("[data-cart-checkout]");
    if (panel && !checkoutLink) { checkoutLink = document.createElement("a"); checkoutLink.className = "button cart-checkout"; checkoutLink.href = "checkout.html"; checkoutLink.dataset.cartCheckout = "true"; checkoutLink.textContent = "Continue to checkout"; panel.append(checkoutLink); }
    let total = 0;
    const rows = cart.map(item => {
        const product = getProduct(item.id);
        if (!product?.available) return "";
        total += product.price * item.quantity;
        return `<div class="cart-row"><div><strong>${escapeHtml(product.name)}</strong><small>${formatPrice(product.price)} × ${item.quantity}</small></div><div class="quantity-controls"><button type="button" aria-label="Decrease ${escapeHtml(product.name)}" data-cart-change="${escapeHtml(product.id)}" data-amount="-1">−</button><span aria-live="polite">${item.quantity}</span><button type="button" aria-label="Increase ${escapeHtml(product.name)}" data-cart-change="${escapeHtml(product.id)}" data-amount="1">+</button></div></div>`;
    }).filter(Boolean);
    target.innerHTML = rows.length ? rows.join("") : `<p class="muted">Your collection is empty.</p>`;
    totalNode.textContent = formatPrice(total);
    if (checkoutLink) checkoutLink.hidden = !rows.length;
}
function openCart() { const drawer = document.querySelector("[data-cart]"); drawer?.classList.add("is-open"); drawer?.setAttribute("aria-hidden", "false"); document.querySelector("[data-close-cart]")?.focus(); }
function closeCart() { const drawer = document.querySelector("[data-cart]"); drawer?.classList.remove("is-open"); drawer?.setAttribute("aria-hidden", "true"); }
function setupNavigation() {
    const toggle = document.querySelector("[data-nav-toggle]"), nav = document.querySelector("[data-site-nav]");
    toggle?.addEventListener("click", () => { const open = nav?.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", String(Boolean(open))); });
    nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { nav.classList.remove("is-open"); toggle?.setAttribute("aria-expanded", "false"); }));
    document.querySelectorAll("[data-open-cart]").forEach(button => button.addEventListener("click", openCart));
    document.querySelectorAll("[data-close-cart]").forEach(button => button.addEventListener("click", closeCart));
    document.querySelector("[data-cart-backdrop]")?.addEventListener("click", closeCart);
    document.addEventListener("click", event => { const addButton = event.target.closest("[data-add-to-cart]"); if (addButton) addToCart(addButton.dataset.addToCart); const changeButton = event.target.closest("[data-cart-change]"); if (changeButton) changeQuantity(changeButton.dataset.cartChange, Number(changeButton.dataset.amount)); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") { closeCart(); nav?.classList.remove("is-open"); toggle?.setAttribute("aria-expanded", "false"); } });
}
function setupCatalog() {
    const target = document.querySelector("[data-product-grid]"); if (!target) return;
    const category = document.body.dataset.category, searchInput = document.querySelector("[data-catalog-search]"), select = document.querySelector("[data-category-filter]"), form = searchInput?.closest("form"), initialQuery = new URLSearchParams(location.search).get("q");
    if (initialQuery && searchInput) searchInput.value = initialQuery;
    const update = () => { const term = (searchInput?.value || "").trim().toLowerCase(), selected = select?.value || category || "all"; renderProducts(products.filter(product => (selected === "all" || product.category === selected) && (!term || `${product.name} ${product.category} ${product.type} ${product.origin}`.toLowerCase().includes(term))), target); };
    searchInput?.addEventListener("input", update); select?.addEventListener("change", update); form?.addEventListener("submit", event => { event.preventDefault(); update(); }); update();
}
function setupFeatured() { const target = document.querySelector("[data-featured-products]"); if (!target) return; const query = (new URLSearchParams(location.search).get("q") || "").toLowerCase(); renderProducts(query ? products.filter(product => `${product.name} ${product.category} ${product.type} ${product.origin}`.toLowerCase().includes(query)) : products.filter(product => ["glenfiddich-12", "cabernet-sauvignon", "old-fashioned"].includes(product.id)), target); }
function setupProductDetail() {
    const target = document.querySelector("[data-product-detail]"); if (!target) return;
    const product = getProduct(new URLSearchParams(location.search).get("id"));
    if (!product) { target.innerHTML = `<div class="empty-state"><h1>Product not found</h1><p>This item is unavailable or the link is incomplete.</p><a class="button" href="index.html">Return home</a></div>`; return; }
    const availability = product.available ? "Available to order" : (product.price == null ? "Details to be confirmed" : "Currently unavailable");
    target.innerHTML = `<div class="detail-layout"><img class="detail-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='3.jpg'"><div class="detail-copy"><span class="eyebrow">${escapeHtml(categoryNames[product.category] || product.category)}</span><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p><ul class="detail-list"><li><span>Type</span><strong>${escapeHtml(product.type)}</strong></li><li><span>Origin</span><strong>${escapeHtml(product.origin)}</strong></li><li><span>ABV</span><strong>${escapeHtml(product.abv || "To confirm")}</strong></li><li><span>Price</span><strong class="price">${formatPrice(product.price)}</strong></li><li><span>Availability</span><strong>${availability}</strong></li></ul>${product.available ? `<button class="button" type="button" data-add-to-cart="${escapeHtml(product.id)}">Add to collection</button>` : `<p class="muted">This item is not currently available to order.</p>`}</div></div>`;
}
async function init() {
    setupNavigation();
    document.querySelectorAll("[data-product-grid], [data-featured-products], [data-product-detail]").forEach(node => { node.setAttribute("aria-busy", "true"); if (!node.children.length) node.innerHTML = `<div class="loading-state">Loading the collection…</div>`; });
    try { await loadProducts(); setupFeatured(); setupCatalog(); setupProductDetail(); renderCart(); }
    catch (error) { document.querySelectorAll("[data-product-grid], [data-featured-products], [data-product-detail]").forEach(node => node.innerHTML = `<div class="empty-state"><h3>Collection unavailable</h3><p>We could not load the collection. Please try again shortly.</p></div>`); console.error(error); }
    finally { document.querySelectorAll("[data-product-grid], [data-featured-products], [data-product-detail]").forEach(node => node.removeAttribute("aria-busy")); }
}
init();
