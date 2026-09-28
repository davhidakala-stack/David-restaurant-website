const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApplication } = require("./server.js");

async function startApplication(options) {
    const app = createApplication(options);
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const address = app.server.address();
    return { ...app, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function postJson(url, data) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
}

test("checkout trusts server prices, verifies Paystack, and queues refund review", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "david-restaurant-"));
    let initializedPayment;
    const app = await startApplication({
        databasePath: path.join(directory, "test.sqlite"),
        env: {
            PAYSTACK_SECRET_KEY: "test_secret",
            SUPPORT_EMAIL: "care@example.com",
            ADMIN_TOKEN: "staff-test-token",
            PUBLIC_BASE_URL: "http://127.0.0.1"
        },
        fetchImpl: async (url, options) => {
            if (String(url).endsWith("/transaction/initialize")) {
                initializedPayment = JSON.parse(options.body);
                return Response.json({
                    status: true,
                    data: { authorization_url: "https://paystack.test/checkout" }
                });
            }
            return Response.json({
                status: true,
                data: {
                    status: "success",
                    reference: initializedPayment.reference,
                    amount: initializedPayment.amount,
                    currency: "NGN"
                }
            });
        }
    });
    t.after(async () => {
        await new Promise((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
        app.db.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    const checkoutResponse = await postJson(`${app.baseUrl}/api/checkout`, {
        items: [{ name: "Swallow and Soup", price: "₦1", quantity: 1 }],
        customer: {
            name: "Alex Customer",
            email: "alex@example.com",
            phone: "08000000000",
            address: "1 Food Street, Lagos"
        }
    });
    assert.equal(checkoutResponse.status, 200);
    assert.equal(initializedPayment.amount, 350000);
    assert.equal(initializedPayment.currency, "NGN");
    assert.equal((await checkoutResponse.json()).authorizationUrl, "https://paystack.test/checkout");

        const unpaidRefund = await postJson(`${app.baseUrl}/api/refund-requests`, {
            reference: initializedPayment.reference,
            email: "alex@example.com",
            message: "Please review this order for a refund."
        });
        assert.equal(unpaidRefund.status, 404);

    const invalidCart = await postJson(`${app.baseUrl}/api/checkout`, {
        items: [{ name: "Unknown food", price: "₦1", quantity: 1 }],
        customer: {
            name: "Alex Customer",
            email: "alex@example.com",
            phone: "08000000000",
            address: "1 Food Street, Lagos"
        }
    });
    assert.equal(invalidCart.status, 400);

    const verifyResponse = await fetch(
        `${app.baseUrl}/api/payments/verify?reference=${encodeURIComponent(initializedPayment.reference)}`
    );
    assert.equal(verifyResponse.status, 200);
    assert.equal((await verifyResponse.json()).paid, true);

    const refundResponse = await postJson(`${app.baseUrl}/api/refund-requests`, {
        reference: initializedPayment.reference,
        email: "alex@example.com",
        message: "Please review this order for a refund."
    });
    assert.equal(refundResponse.status, 201);
    const refund = await refundResponse.json();
    assert.match(refund.message, /No refund has been issued/);

        const supportResponse = await postJson(`${app.baseUrl}/api/support-requests`, {
            email: "alex@example.com",
            message: "I need help with the delivery details."
        });
        assert.equal(supportResponse.status, 201);

    const unauthorized = await fetch(`${app.baseUrl}/api/admin/requests`);
    assert.equal(unauthorized.status, 401);
    const inbox = await fetch(`${app.baseUrl}/api/admin/requests`, {
        headers: { Authorization: "Bearer staff-test-token" }
    });
    assert.equal(inbox.status, 200);
    const tickets = await inbox.json();
        assert.equal(tickets.requests.length, 2);
    assert.equal(tickets.requests[0].ticketId, refund.ticketId);
});

test("checkout stays disabled in practice when Paystack is not configured", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "david-restaurant-"));
    const app = await startApplication({
        databasePath: path.join(directory, "test.sqlite"),
        env: {},
        fetchImpl: async () => { throw new Error("Paystack should not be called"); }
    });
    t.after(async () => {
        await new Promise((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
        app.db.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    const response = await postJson(`${app.baseUrl}/api/checkout`, {
        items: [{ name: "Jollof rice", quantity: 1 }],
        customer: {
            name: "Alex Customer",
            email: "alex@example.com",
            phone: "08000000000",
            address: "1 Food Street, Lagos"
        }
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not set up yet/i);
});