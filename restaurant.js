const CART_KEY = "restaurantCart";

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem(CART_KEY));
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addCart(button) {
    const card = button.closest(".new-card, .food-card");
    const name = card?.querySelector(".food-name")?.textContent.trim();
    const price = card?.querySelector(".food-price")?.textContent.trim();
    if (!name || !price) return;

    const cart = getCart();
    const existingItem = cart.find((item) => item.name === name);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ name, price, quantity: 1 });

    saveCart(cart);
    window.location.href = "order.html";
}

function formatPrice(price) {
    return Number(String(price).replace(/[^0-9.]/g, "")) || 0;
}

function makeQuantityButton(label, index, amount, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", () => changeQuantity(index, amount));
    return button;
}

function renderCart() {
    const cart = getCart();
    const itemsContainer = document.getElementById("cartItems");
    const totalElement = document.getElementById("cartTotal");
    const checkoutButton = document.getElementById("checkoutButton");
    const emptyMessage = document.getElementById("emptyCart");
    if (!itemsContainer || !totalElement) return;

    itemsContainer.replaceChildren();
    let total = 0;
    cart.forEach((item, index) => {
        const quantity = Number.isInteger(item.quantity) ? item.quantity : 0;
        const unitPrice = formatPrice(item.price);
        const itemTotal = unitPrice * quantity;
        total += itemTotal;

        const row = document.createElement("div");
        row.className = "cart-item";
        const details = document.createElement("div");
        const name = document.createElement("h3");
        name.textContent = String(item.name || "Food item");
        const unit = document.createElement("p");
        unit.textContent = `₦${unitPrice.toLocaleString()} each`;
        details.append(name, unit);

        const actions = document.createElement("div");
        actions.className = "cart-item-actions";
        const count = document.createElement("span");
        count.textContent = String(quantity);
        const subtotal = document.createElement("strong");
        subtotal.textContent = `₦${itemTotal.toLocaleString()}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-item";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => removeFromCart(index));
        actions.append(
            makeQuantityButton("-", index, -1, `Decrease ${name.textContent} quantity`),
            count,
            makeQuantityButton("+", index, 1, `Increase ${name.textContent} quantity`),
            subtotal,
            remove
        );
        row.append(details, actions);
        itemsContainer.appendChild(row);
    });

    totalElement.textContent = `₦${total.toLocaleString()}`;
    if (emptyMessage) emptyMessage.hidden = cart.length > 0;
    if (checkoutButton) checkoutButton.disabled = cart.length === 0;
}

function changeQuantity(index, amount) {
    const cart = getCart();
    if (!cart[index]) return;
    cart[index].quantity += amount;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    saveCart(cart);
    renderCart();
}

function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
}

async function readApiResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
}

async function submitOrder(event) {
    event.preventDefault();
    const cart = getCart();
    if (cart.length === 0) return;

    const form = document.getElementById("checkoutForm");
    const button = document.getElementById("checkoutButton");
    const status = document.getElementById("checkoutStatus");
    button.disabled = true;
    status.textContent = "Connecting to secure payment...";

    try {
        const response = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: cart,
                customer: {
                    name: document.getElementById("fullName").value,
                    email: document.getElementById("email").value,
                    phone: document.getElementById("phone").value,
                    address: document.getElementById("address").value
                }
            })
        });
        const data = await readApiResponse(response);
        if (!data.authorizationUrl) throw new Error("Payment page was not returned. Please try again.");
        window.location.assign(data.authorizationUrl);
    } catch (error) {
        status.textContent = error.message;
        button.disabled = cart.length === 0;
    }
}

async function verifyPaymentReturn() {
    const reference = new URLSearchParams(window.location.search).get("reference") ||
        new URLSearchParams(window.location.search).get("trxref");
    if (!reference) return;

    const status = document.getElementById("checkoutStatus");
    status.textContent = "Verifying your payment...";
    try {
        const response = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
        const data = await readApiResponse(response);
        if (!data.paid) {
            status.textContent = data.message || "Payment was not confirmed. Your cart is still saved.";
            return;
        }

        localStorage.removeItem(CART_KEY);
        renderCart();
        document.getElementById("checkoutForm").hidden = true;
        document.getElementById("orderConfirmation").hidden = false;
        document.getElementById("confirmedReference").textContent = `Payment reference: ${reference}`;
        document.getElementById("refundSection").hidden = false;
        document.getElementById("refundEmail").value = document.getElementById("email").value;
        document.getElementById("refundForm").dataset.reference = reference;
        status.textContent = "";
        window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
        status.textContent = `${error.message} Keep this page open or retry using your payment reference: ${reference}`;
    }
}

async function submitServiceRequest(event, endpoint, fields, statusId) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById(statusId);
    const submit = form.querySelector("button[type='submit']");
    const payload = Object.fromEntries(fields.map(([key, id]) => [key, document.getElementById(id).value]));
    if (endpoint === "/api/refund-requests") payload.reference = form.dataset.reference;

    submit.disabled = true;
    status.textContent = "Sending your request...";
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await readApiResponse(response);
        status.textContent = `${data.message || "Your request was received."} Ticket: ${data.ticketId}. Contact: ${data.supportEmail}`;
        if (endpoint === "/api/refund-requests") form.reset();
        else form.reset();
    } catch (error) {
        status.textContent = error.message;
    } finally {
        submit.disabled = false;
    }
}

async function initializeCheckout() {
    renderCart();
    const supportLink = document.getElementById("supportEmailLink");
    try {
        const config = await readApiResponse(await fetch("/api/config"));
        supportLink.textContent = config.supportEmail;
        supportLink.href = `mailto:${config.supportEmail}`;
        if (!config.paymentReady) {
            document.getElementById("checkoutStatus").textContent =
                "Online payment setup is incomplete. Contact customer care to place an order.";
        }
    } catch {
        document.getElementById("checkoutStatus").textContent =
            "Start the restaurant server to enable secure checkout and order requests.";
    }

    document.getElementById("refundForm").addEventListener("submit", (event) =>
        submitServiceRequest(event, "/api/refund-requests", [
            ["email", "refundEmail"], ["message", "refundReason"]
        ], "refundStatus")
    );
    document.getElementById("supportForm").addEventListener("submit", (event) =>
        submitServiceRequest(event, "/api/support-requests", [
            ["email", "supportEmail"], ["message", "supportMessage"]
        ], "supportStatus")
    );
    await verifyPaymentReturn();
}

document.addEventListener("DOMContentLoaded", initializeCheckout);


