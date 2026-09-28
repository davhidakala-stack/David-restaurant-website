const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

class ValidationError extends Error {}

const ROOT = __dirname;
const catalog = new Map([
    ["Swallow and Soup", 3500],
    ["Ewa,MoiMoi and Egg", 4000],
    ["Grilled Chicken", 2500],
    ["Jollof rice", 3000],
    ["Chunky Burger", 3500],
    ["Grilled Burger with fries and coke", 4000],
    ["Crunchy Size Burger", 6500],
    ["Chongqing Chicken", 13500],
    ["Mapo Tofu Rice", 14000],
    ["Pad See Ew", 16500],
    ["italian spring roll", 6500],
    ["cookies with strawberries", 5000],
    ["Sweets", 6500]
]);

function jsonResponse(response, status, data) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(data));
}

async function readJson(request) {
    let body = "";
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 20000) {
            throw new Error("Request is too large.");
        }
    }
    return JSON.parse(body || "{}");
}

function validEmail(value) {
    return typeof value === "string" && value.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function cleanCustomer(customer) {
    if (!customer || typeof customer !== "object") {
        throw new ValidationError("Enter your delivery details.");
    }
    const name = String(customer.name || "").trim();
    const email = String(customer.email || "").trim().toLowerCase();
    const phone = String(customer.phone || "").trim();
    const address = String(customer.address || "").trim();
    if (name.length < 2 || name.length > 100 || !validEmail(email) ||
        phone.length < 7 || phone.length > 30 || address.length < 5 || address.length > 500) {
        throw new ValidationError("Enter a valid name, email, phone number, and delivery address.");
    }
    return { name, email, phone, address };
}

function cleanItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
        throw new ValidationError("Your cart is empty or contains too many items.");
    }
    const quantities = new Map();
    for (const item of items) {
        if (!item || typeof item.name !== "string" || !catalog.has(item.name) ||
            !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
            throw new ValidationError("Your cart contains an invalid food item or quantity.");
        }
        quantities.set(item.name, (quantities.get(item.name) || 0) + item.quantity);
    }
    const normalized = Array.from(quantities, ([name, quantity]) => ({
        name,
        unitPriceNaira: catalog.get(name),
        quantity
    }));
    const totalNaira = normalized.reduce(
        (total, item) => total + item.unitPriceNaira * item.quantity, 0
    );
    if (!Number.isSafeInteger(totalNaira) || totalNaira <= 0) {
        throw new ValidationError("The order total is invalid.");
    }
    return { items: normalized, totalNaira, amountKobo: totalNaira * 100 };
}

function createApplication(options = {}) {
    const env = options.env || process.env;
    const databasePath = options.databasePath || env.DATABASE_PATH || path.join(ROOT, "data", "restaurant.sqlite");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath);
    db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            reference TEXT NOT NULL UNIQUE,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            delivery_address TEXT NOT NULL,
            items_json TEXT NOT NULL,
            amount_kobo INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customer_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL,
            order_id TEXT REFERENCES orders(id),
            customer_email TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_review',
            created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS one_refund_request_per_order
            ON customer_requests(order_id) WHERE kind = 'refund';
    `);

    const paystackFetch = options.fetchImpl || fetch;
    const server = http.createServer(async (request, response) => {
        const baseUrl = `http://${request.headers.host || "localhost"}`;
        const url = new URL(request.url, baseUrl);
        const supportEmail = env.SUPPORT_EMAIL || "davhidakala@gmail.com";

        try {
            if (request.method === "GET" && url.pathname === "/api/config") {
                return jsonResponse(response, 200, {
                    paymentReady: Boolean(env.PAYSTACK_SECRET_KEY),
                    supportEmail
                });
            }

            if (request.method === "POST" && url.pathname === "/api/checkout") {
                const body = await readJson(request);
                const customer = cleanCustomer(body.customer);
                const order = cleanItems(body.items);
                if (!env.PAYSTACK_SECRET_KEY) {
                    return jsonResponse(response, 503, {
                        error: "Online payment is not set up yet. Please contact customer care."
                    });
                }

                const orderId = crypto.randomUUID();
                const reference = `david-${crypto.randomUUID().replaceAll("-", "")}`;
                const createdAt = new Date().toISOString();
                db.prepare(`INSERT INTO orders
                    (id, reference, customer_name, customer_email, customer_phone,
                     delivery_address, items_json, amount_kobo, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'initializing', ?)`)
                    .run(orderId, reference, customer.name, customer.email, customer.phone,
                        customer.address, JSON.stringify(order.items), order.amountKobo, createdAt);

                let gatewayResponse;
                try {
                    gatewayResponse = await paystackFetch("https://api.paystack.co/transaction/initialize", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: customer.email,
                            amount: order.amountKobo,
                            currency: "NGN",
                            reference,
                            callback_url: `${env.PUBLIC_BASE_URL || "http://localhost:3000"}/payment/return`,
                            metadata: {
                                order_id: orderId,
                                customer_name: customer.name,
                                customer_phone: customer.phone,
                                delivery_address: customer.address
                            }
                        })
                    });
                } catch {
                    db.prepare("UPDATE orders SET status = 'payment_setup_failed' WHERE id = ?").run(orderId);
                    return jsonResponse(response, 502, { error: "Could not connect to Paystack. Please try again." });
                }

                const gatewayData = await gatewayResponse.json().catch(() => ({}));
                if (!gatewayResponse.ok || !gatewayData.status || !gatewayData.data?.authorization_url) {
                    db.prepare("UPDATE orders SET status = 'payment_setup_failed' WHERE id = ?").run(orderId);
                    return jsonResponse(response, 502, {
                        error: gatewayData.message || "Paystack could not start your payment. Please try again."
                    });
                }
                db.prepare("UPDATE orders SET status = 'awaiting_payment' WHERE id = ?").run(orderId);
                return jsonResponse(response, 200, { authorizationUrl: gatewayData.data.authorization_url });
            }

            if (request.method === "GET" && url.pathname === "/payment/return") {
                const reference = url.searchParams.get("reference") || "";
                response.writeHead(303, { Location: `/order.html?reference=${encodeURIComponent(reference)}` });
                return response.end();
            }

            if (request.method === "GET" && url.pathname === "/api/payments/verify") {
                const reference = url.searchParams.get("reference") || "";
                const order = db.prepare("SELECT id, amount_kobo, status FROM orders WHERE reference = ?").get(reference);
                if (!order) return jsonResponse(response, 404, { error: "Order reference was not found." });
                if (order.status === "paid") return jsonResponse(response, 200, { paid: true });
                if (!env.PAYSTACK_SECRET_KEY) {
                    return jsonResponse(response, 503, { error: "Payment verification is not available." });
                }

                const verification = await paystackFetch(
                    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
                    { headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } }
                );
                const result = await verification.json().catch(() => ({}));
                const transaction = result.data;
                if (!verification.ok || !result.status || !transaction) {
                    return jsonResponse(response, 502, { error: "We could not verify the payment yet. Please retry." });
                }
                if (transaction.status !== "success") {
                    return jsonResponse(response, 200, { paid: false, message: "Payment has not been confirmed." });
                }
                if (transaction.reference !== reference || transaction.amount !== order.amount_kobo ||
                    transaction.currency !== "NGN") {
                    return jsonResponse(response, 400, { error: "Payment details do not match this order." });
                }
                db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
                return jsonResponse(response, 200, { paid: true });
            }

            if (request.method === "POST" && url.pathname === "/api/refund-requests") {
                const body = await readJson(request);
                const reference = String(body.reference || "").trim();
                const email = String(body.email || "").trim().toLowerCase();
                const message = String(body.message || "").trim();
                if (!reference || !validEmail(email) || message.length < 5 || message.length > 1000) {
                    return jsonResponse(response, 400, { error: "Enter your payment reference, email, and a short reason." });
                }
                const order = db.prepare("SELECT id, customer_email, status FROM orders WHERE reference = ?").get(reference);
                if (!order || order.customer_email !== email || order.status !== "paid") {
                    return jsonResponse(response, 404, { error: "We could not match a paid order to those details." });
                }
                const existing = db.prepare(
                    "SELECT ticket_id FROM customer_requests WHERE order_id = ? AND kind = 'refund'"
                ).get(order.id);
                if (existing) {
                    return jsonResponse(response, 200, {
                        ticketId: existing.ticket_id,
                        supportEmail,
                        message: "A refund request for this order is already awaiting review."
                    });
                }
                const ticketId = `DR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
                db.prepare(`INSERT INTO customer_requests
                    (ticket_id, kind, order_id, customer_email, message, created_at)
                    VALUES (?, 'refund', ?, ?, ?, ?)`)
                    .run(ticketId, order.id, email, message, new Date().toISOString());
                return jsonResponse(response, 201, {
                    ticketId,
                    supportEmail,
                    message: "Your refund request is saved for customer-care review. No refund has been issued yet."
                });
            }

            if (request.method === "POST" && url.pathname === "/api/support-requests") {
                const body = await readJson(request);
                const email = String(body.email || "").trim().toLowerCase();
                const message = String(body.message || "").trim();
                if (!validEmail(email) || message.length < 5 || message.length > 1000) {
                    return jsonResponse(response, 400, { error: "Enter a valid email and a message (5 to 1000 characters)." });
                }
                const ticketId = `DR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
                db.prepare(`INSERT INTO customer_requests
                    (ticket_id, kind, customer_email, message, created_at)
                    VALUES (?, 'support', ?, ?, ?)`)
                    .run(ticketId, email, message, new Date().toISOString());
                return jsonResponse(response, 201, { ticketId, supportEmail });
            }

            if (request.method === "GET" && url.pathname === "/api/admin/requests") {
                const adminToken = env.ADMIN_TOKEN || "";
                const suppliedToken = (request.headers.authorization || "").replace(/^Bearer\s+/i, "");
                const expectedBuffer = Buffer.from(adminToken);
                const suppliedBuffer = Buffer.from(suppliedToken);
                if (!adminToken) {
                    return jsonResponse(response, 503, { error: "Staff inbox is not configured." });
                }
                if (expectedBuffer.length !== suppliedBuffer.length ||
                    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
                    return jsonResponse(response, 401, { error: "Staff access is not authorized." });
                }
                const requests = db.prepare(`SELECT ticket_id AS ticketId, kind, order_id AS orderId,
                    customer_email AS email, message, status, created_at AS createdAt
                    FROM customer_requests ORDER BY created_at DESC LIMIT 200`).all();
                return jsonResponse(response, 200, { requests });
            }

            if (request.method === "GET") {
                const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
                const filePath = path.resolve(ROOT, `.${pathname}`);
                const relativePath = path.relative(ROOT, filePath);
                const allowedExtensions = new Set([".html", ".css", ".js", ".jpg", ".jpeg", ".png", ".webp"]);
                if (relativePath.startsWith("..") || path.isAbsolute(relativePath) ||
                    !allowedExtensions.has(path.extname(filePath).toLowerCase())) {
                    return jsonResponse(response, 404, { error: "Not found." });
                }
                try {
                    const contents = await fs.promises.readFile(filePath);
                    const contentTypes = {
                        ".html": "text/html; charset=utf-8",
                        ".css": "text/css; charset=utf-8",
                        ".js": "text/javascript; charset=utf-8",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".png": "image/png",
                        ".webp": "image/webp"
                    };
                    response.writeHead(200, {
                        "Content-Type": contentTypes[path.extname(filePath).toLowerCase()],
                        "X-Content-Type-Options": "nosniff"
                    });
                    return response.end(contents);
                } catch {
                    return jsonResponse(response, 404, { error: "Not found." });
                }
            }

            return jsonResponse(response, 404, { error: "Not found." });
        } catch (error) {
            const status = error instanceof SyntaxError || error instanceof ValidationError ||
                error.message === "Request is too large." ? 400 : 500;
            return jsonResponse(response, status, {
                error: status === 400 ? error.message : "The request could not be completed."
            });
        }
    });

    return { server, db };
}

if (require.main === module) {
    const { server } = createApplication();
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, () => {
        console.log(`David Restaurant is available at http://localhost:${port}`);
    });
}

module.exports = { createApplication };