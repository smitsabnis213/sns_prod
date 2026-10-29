# Buddyyaa backend

Fastify (v4), MongoDB/Mongoose, JWT authentication, Socket.IO tracking, and an authenticated AdminJS panel. The shared catalogue is separate from per-Buddy inventory. A Buddy account is the single fulfillment, stock-owner, and delivery identity; the legacy `Branch` schema is not used by checkout.

## Local setup

Requirements: Node.js 20 or newer and a MongoDB deployment. A standalone MongoDB instance is supported through atomic inventory updates and idempotent reservation records; replica-set transactions are not required.

1. Copy `.env.example` to `.env` and set `MONGO_URI`.
2. Generate separate secrets (at least 32 characters) for access tokens, refresh tokens, and AdminJS sessions. Do not use the example placeholders in production.
3. Seed the shared catalogue and create the first administrator:

   ```powershell
   npm install
   npm run seed
   $env:ADMIN_BOOTSTRAP_NAME = "Platform Admin"
   $env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.test"
   $env:ADMIN_BOOTSTRAP_PASSWORD = "replace-with-a-unique-12-plus-character-password"
   npm run admin:create
   Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD
   ```

   Admin creation refuses to overwrite an existing account. No default administrator is created.
4. Start MongoDB, then run `npm run dev` or `npm start`. AdminJS is at `/admin`; the API root is `/`.

Phone-only customer login is deliberately disabled unless `NODE_ENV` is not `production` and `CUSTOMER_DEV_LOGIN=true`. That local convenience is not OTP authentication and must not be enabled for a production customer-facing deployment. No OTP provider is configured.

## Creating Buddies and setting stock

Sign in through `/auth/admin/login` to obtain an Admin bearer token, or use the AdminJS session at `/admin`.

1. Create a Buddy with `POST /api/admin/buddies` (name, phone, email, password of at least 12 characters, address, and location). New accounts are disabled pending approval.
2. Approve and activate through `PATCH /api/admin/buddies/:id/status` with `{ "isApproved": true, "isActive": true }`, or edit the Buddy in AdminJS.
3. Add inventory using `PUT /api/admin/inventory` with `{ "buddyId": "...", "productId": "...", "availableQuantity": 12 }`, or the AdminJS “Set Buddy stock” action. Stock is per Buddy/product.
4. Buddy login is `POST /auth/buddy/login`. Approved Buddies can update their availability and location with `PATCH /buddies/me`, and set available stock for their own existing active products with `PATCH /buddies/me/inventory`. They cannot edit reserved quantities or reservation records.

The catalogue seed does not create Buddies or assign inventory. Use the Admin panel/API to provision real fulfillment data.

## Validation

Run `npm test`. Tests use a temporary MongoDB server; no application database or production records are modified.

Order creation uses atomic per-inventory-document conditional updates plus an order-linked reservation ledger. Partial basket reservations are compensated and recoverable `reserving` orders are reconciled at startup. A deployment crash during a multi-document operation can temporarily leave an incomplete reservation until the next startup recovery; use a MongoDB replica set and transactions if strict cross-document atomicity is required at higher scale.

See [API.md](./API.md) for the complete route inventory and Socket.IO contract.
