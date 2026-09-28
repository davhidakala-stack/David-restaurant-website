# David Restaurant checkout

## Local setup

Use Node.js 24 or newer. Copy `.env.example` to `.env`, then set:

- `PAYSTACK_SECRET_KEY` to the secret key from the Paystack dashboard. Keep this only in `.env` or your host's secret manager; never put it in HTML or browser JavaScript.
- `ADMIN_TOKEN` to a long, random staff-only token.
- `PUBLIC_BASE_URL` to the exact public HTTPS origin when deploying, for example `https://orders.example.com`.
- `SUPPORT_EMAIL` to the customer-care inbox.

Generate a staff token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it after `ADMIN_TOKEN=` in `.env`. Do not use the example placeholder as the token. Restart the server after changing `.env`.

Start the site with `npm start` (in Windows PowerShell, use `npm.cmd start`) and open `http://localhost:3000`. The static files must be served by this Node server; opening HTML files directly will not provide checkout APIs. Use Paystack test keys while testing, then switch to live credentials only after the account and deployment are ready.

The server validates item names and prices against its own catalog, initializes Paystack hosted checkout, and verifies the transaction amount and currency before confirming an order. Customer requests are stored in `data/restaurant.sqlite`.

## Customer requests and refunds

Customers can send support messages and request a refund for an order that has a verified payment. Requests can be reviewed at `/staff.html` using the `ADMIN_TOKEN`. Refund requests are not automatic: verify the customer and order, apply the restaurant's published cancellation/refund policy, and issue any approved refund from the Paystack dashboard. Then contact the customer-care address with the outcome.

Configure a persistent database location and a database backup plan when deploying. Configure HTTPS and use a strong staff token. Never commit `.env` or the production database.# David-restaurant-website
